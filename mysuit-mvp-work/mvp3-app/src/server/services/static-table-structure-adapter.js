const fs = require('fs');
const path = require('path');
const config = require('../config');
const { readForm, writeForm, diff } = require('./form-patch-service');
const { sha256File, assertHash } = require('./integrity-service');
const { makeCandidateName, copyProject, removeCandidate } = require('./project-copy-service');
const formContext = require('./form-context-service');
const { span } = require('./static-table-model-service');

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function findTable(parsed, sourceTableId) { const values = parsed.pages.flatMap((page) => page.items.filter((item) => item?.id === sourceTableId)); if (values.length !== 1 || values[0].className !== 'UBTable') fail('STATIC_TABLE_STRUCTURE_MISMATCH', 'Static UBTable을 정확히 하나 찾을 수 없습니다.'); return values[0]; }
const cellsOf = (table) => table.table.flat().filter((w) => w?.cell);
function signature(table) { const cells = cellsOf(table).sort((a, b) => a.cell.id.localeCompare(b.cell.id)); return { id: table.id, rowCount: table.rowCount, columnCount: table.columnCount, cellIds: cells.map((w) => w.cell.id), texts: cells.map((w) => w.cell.text) }; }
const setSpan = (w, key, value) => { w[key] = value; w.cell[key] = value; };

// Editable view of a UBTable: row objects keep their base index (stable identity) and track sizes live in
// row/column arrays, so moving rows or columns never mixes sizes with the wrappers that happen to sit there.
function open(table) {
  const rows = table.table.map((wrappers, base) => { const w = wrappers.find((x) => span(x, 'rowSpan') === 1) || wrappers[0]; return { base, wrappers, height: Number(w.rowHeight ?? w.height) }; });
  const widths = table.table[0].map((_, c) => { const column = table.table.map((row) => row[c]), w = column.find((x) => span(x, 'colSpan') === 1) || column[0]; return Number(w.columnWidth ?? w.width); });
  const owner = new Map(), members = new Map();
  table.table.forEach((wrappers, r) => wrappers.forEach((w, c) => { if (!w?.cell) return; const list = []; for (let dr = 0; dr < span(w, 'rowSpan'); dr++) for (let dc = 0; dc < span(w, 'colSpan'); dc++) { const x = table.table[r + dr]?.[c + dc]; if (x) { owner.set(x, w); list.push(x); } } members.set(w, list); }));
  return { table, rows, widths, columns: widths.map((_, c) => c), owner, members, removed: new Set() };
}
function position(state, wrapper) { for (let r = 0; r < state.rows.length; r++) { const c = state.rows[r].wrappers.indexOf(wrapper); if (c >= 0) return { r, c }; } return null; }
// Current extent of each merge block (rows/columns it occupies after earlier moves).
function blocks(state) {
  return [...state.members].filter(([anchor]) => span(anchor, 'rowSpan') > 1 || span(anchor, 'colSpan') > 1).map(([anchor, list]) => { const at = list.map((w) => position(state, w)).filter(Boolean); return { anchor, r0: Math.min(...at.map((p) => p.r)), r1: Math.max(...at.map((p) => p.r)), c0: Math.min(...at.map((p) => p.c)), c1: Math.max(...at.map((p) => p.c)) }; });
}
// A permutation of the range [lo,hi] keeps every merge contiguous only if the range is inside the merge or clear of it.
// Only merges that span the moved axis matter: a rowSpan never blocks column moves and a colSpan never blocks row moves.
function permutable(state, axis, lo, hi) {
  return blocks(state).every((b) => { const [a, z] = axis === 'row' ? [b.r0, b.r1] : [b.c0, b.c1]; return a === z || (lo >= a && hi <= z) || hi < a || lo > z; });
}
const MOVE_BLOCKED = { row: '병합된 셀이 나뉘게 되어 이 방향으로 행을 옮길 수 없습니다.', column: '병합된 셀이 나뉘게 되어 이 방향으로 열을 옮길 수 없습니다.' };
function assertPermutable(state, axis, lo, hi) { if (!permutable(state, axis, lo, hi)) fail(axis === 'row' ? 'ROWSPAN_DEPENDENCY' : 'COLSPAN_DEPENDENCY', MOVE_BLOCKED[axis]); }
// Which adjacent swaps are structurally possible for each current row/column position.
function movability(state) {
  return {
    rowMoves: state.rows.map((_, p) => ({ up: p > 0 && permutable(state, 'row', p - 1, p), down: p < state.rows.length - 1 && permutable(state, 'row', p, p + 1) })),
    columnMoves: state.columns.map((_, p) => ({ left: p > 0 && permutable(state, 'column', p - 1, p), right: p < state.columns.length - 1 && permutable(state, 'column', p, p + 1) })),
  };
}
// Logical groups: the smallest runs of rows (or columns) closed under the merges spanning that axis. A group is the
// unit a user selects and moves; a plain row is its own group, an item whose 순번 spans two lines is one group.
// A merge covering the whole axis (a title row across every column) stays contiguous under any order, so it groups nothing.
function groups(state, axis) {
  const count = axis === 'row' ? state.rows.length : state.columns.length, reach = Array.from({ length: count }, (_, i) => i);
  for (const b of blocks(state)) { const [a, z] = axis === 'row' ? [b.r0, b.r1] : [b.c0, b.c1]; if (a !== z && !(a === 0 && z === count - 1)) for (let i = a; i <= z; i++) reach[i] = Math.max(reach[i], z); }
  const out = []; for (let start = 0; start < count;) { let end = reach[start]; for (let i = start; i <= end; i++) end = Math.max(end, reach[i]); out.push([start, end]); start = end + 1; }
  return out;
}
// Moves a set of rows/columns (by stable base index) so the first lands at position 'to' of the final order. The
// permutation is applied at once and accepted only if every merge still occupies a contiguous run afterwards.
function moveSet(state, axis, bases, to) {
  const list = axis === 'row' ? state.rows : state.columns, key = (x) => (axis === 'row' ? x.base : x), picked = new Set(bases);
  if (!bases.length || picked.size !== bases.length) fail(axis === 'row' ? 'INVALID_ROW_MOVE' : 'INVALID_VISUAL_INDEX', axis === 'row' ? '이동할 행이 올바르지 않습니다.' : '이동할 열이 올바르지 않습니다.');
  const order = list.map((x, i) => i), moving = order.filter((i) => picked.has(key(list[i]))), rest = order.filter((i) => !picked.has(key(list[i])));
  if (moving.length !== picked.size) fail(axis === 'row' ? 'INVALID_LOGICAL_ROW' : 'INVALID_COLUMN', axis === 'row' ? 'Row가 없습니다.' : 'Column이 없습니다.');
  if (!Number.isInteger(to) || to < 0 || to > rest.length) fail(axis === 'row' ? 'INVALID_ROW_MOVE' : 'INVALID_VISUAL_INDEX', axis === 'row' ? '행 이동 위치가 올바르지 않습니다.' : '열 이동 위치가 올바르지 않습니다.');
  const next = [...rest.slice(0, to), ...moving, ...rest.slice(to)];
  if (next.every((v, i) => v === i)) fail(axis === 'row' ? 'INVALID_ROW_MOVE' : 'INVALID_VISUAL_INDEX', axis === 'row' ? '행 이동 위치가 올바르지 않습니다.' : '열 이동 위치가 올바르지 않습니다.');
  if (axis === 'row') { const rows = next.map((i) => state.rows[i]); state.rows.splice(0, state.rows.length, ...rows); }
  else { const widths = next.map((i) => state.widths[i]), columns = next.map((i) => state.columns[i]); for (const row of state.rows) { const wrappers = next.map((i) => row.wrappers[i]); row.wrappers.splice(0, row.wrappers.length, ...wrappers); } state.widths.splice(0, state.widths.length, ...widths); state.columns.splice(0, state.columns.length, ...columns); }
  for (const b of blocks(state)) { const members = state.members.get(b.anchor).map((w) => position(state, w)).filter(Boolean), lines = new Set(members.map((p) => (axis === 'row' ? p.r : p.c))), [a, z] = axis === 'row' ? [b.r0, b.r1] : [b.c0, b.c1]; if (z - a + 1 !== lines.size) fail(axis === 'row' ? 'ROWSPAN_DEPENDENCY' : 'COLSPAN_DEPENDENCY', MOVE_BLOCKED[axis]); }
  reanchor(state);
}
// After a permutation inside a merge the anchor must return to the block's top-left position.
function reanchor(state) {
  for (const b of blocks(state)) { const at = position(state, b.anchor); if (at.r === b.r0 && at.c === b.c0) continue; const other = state.rows[b.r0].wrappers[b.c0]; state.rows[at.r].wrappers[at.c] = other; state.rows[b.r0].wrappers[b.c0] = b.anchor; }
}
function rowAt(state, base) { const at = state.rows.findIndex((row) => row.base === base); if (at < 0) fail('INVALID_LOGICAL_ROW', 'Row가 없습니다.'); return at; }
function columnAt(state, base) { const at = state.columns.indexOf(base); if (at < 0) fail('INVALID_COLUMN', 'Column이 없습니다.'); return at; }
function anchorsIn(state, list, key) { return list.filter((w) => w?.cell && span(w, key) > 1); }
function operate(state, op) {
  const { rows, widths } = state, column = (c) => rows.map((row) => row.wrappers[c]);
  if (op.operation === 'resizeColumn') { const at = columnAt(state, op.columnIndex), width = Math.round(op.afterWidth); if (width < 20 || width > 600) fail('INVALID_COLUMN_WIDTH', 'Column 너비가 올바르지 않습니다.'); widths[at] = width; }
  else if (op.operation === 'hideColumn') { const at = columnAt(state, op.columnIndex); if (anchorsIn(state, column(at), 'colSpan').length) fail('COLSPAN_DEPENDENCY', '병합 셀이 시작되는 열은 숨길 수 없습니다.'); widths[at] = 0; for (const w of column(at)) if (w?.cell) w.cell.visible = false; }
  else if (op.operation === 'moveColumn') {
    const from = columnAt(state, op.columnIndex), to = Number(op.toVisualIndex); if (!Number.isInteger(to) || to < 0 || to >= widths.length || to === from) fail('INVALID_VISUAL_INDEX', '열 이동 위치가 올바르지 않습니다.');
    assertPermutable(state, 'column', Math.min(from, to), Math.max(from, to));
    for (const row of rows) { const [w] = row.wrappers.splice(from, 1); row.wrappers.splice(to, 0, w); } const [width] = widths.splice(from, 1); widths.splice(to, 0, width); const [base] = state.columns.splice(from, 1); state.columns.splice(to, 0, base); reanchor(state);
  }
  else if (op.operation === 'resizeRow') { const height = Math.round(op.afterHeight); if (height < 12 || height > 200) fail('INVALID_ROW_HEIGHT', 'Row 높이가 올바르지 않습니다.'); rows[rowAt(state, op.rowIndex)].height = height; }
  else if (op.operation === 'hideRow') { const row = rows[rowAt(state, op.rowIndex)]; if (anchorsIn(state, row.wrappers, 'rowSpan').length) fail('ROWSPAN_DEPENDENCY', '병합 셀이 시작되는 행은 숨길 수 없습니다.'); row.height = 0; for (const w of row.wrappers) if (w?.cell) w.cell.visible = false; }
  else if (op.operation === 'moveRow') {
    const from = rowAt(state, op.rowIndex), to = Number(op.toRowIndex); if (!Number.isInteger(to) || to < 0 || to >= rows.length || to === from) fail('INVALID_ROW_MOVE', '행 이동 위치가 올바르지 않습니다.');
    // Multi-row merge anchors are pinned to their block's top row (see reanchor), so they are not row identity.
    const anchorsById = new Map([...state.members.keys()].map((w) => [w.cell.id, w])), own = (ids) => ids.filter((id) => span(anchorsById.get(id), 'rowSpan') === 1).sort();
    if (Array.isArray(op.rowCellIds) && JSON.stringify(own(rows[from].wrappers.filter((w) => w?.cell && state.owner.get(w) === w).map((w) => w.cell.id))) !== JSON.stringify(own(op.rowCellIds))) fail('STATIC_TABLE_IDENTITY_CHANGED', '이동할 행의 Cell identity가 다릅니다.');
    assertPermutable(state, 'row', Math.min(from, to), Math.max(from, to));
    const [row] = rows.splice(from, 1); rows.splice(to, 0, row); reanchor(state);
  }
  else if (op.operation === 'moveRows') moveSet(state, 'row', (op.rowIndexes || []).map(Number), Number(op.toRowIndex));
  else if (op.operation === 'moveColumns') moveSet(state, 'column', (op.columnIndexes || []).map(Number), Number(op.toVisualIndex));
  else if (op.operation === 'removeRow') {
    if (rows.length <= 1) fail('INVALID_ROW_REMOVE', '마지막 행은 삭제할 수 없습니다.');
    const at = rowAt(state, op.rowIndex), row = rows[at];
    if (anchorsIn(state, row.wrappers, 'rowSpan').length) fail('ROWSPAN_DEPENDENCY', '병합 셀이 시작되는 행은 삭제할 수 없습니다.');
    for (const w of row.wrappers) if (w?.cell && (w.cell.dataType || w.cell.dataSet || w.cell.column || w.cell.parameter)) fail('BOUND_ROW_REMOVE_REJECTED', '데이터가 연결된 행은 삭제할 수 없습니다.');
    // Covered positions shrink their vertical merge; anchors of horizontal merges leave with the row.
    for (const w of row.wrappers) { const anchor = state.owner.get(w); if (anchor && anchor !== w && !row.wrappers.includes(anchor)) { setSpan(anchor, 'rowSpan', span(anchor, 'rowSpan') - 1); state.members.set(anchor, state.members.get(anchor).filter((x) => x !== w)); } if (w?.cell) state.removed.add(w.cell.id); if (state.members.has(w)) state.members.delete(w); }
    rows.splice(at, 1);
  }
  else if (op.operation === 'moveTable') { const t = state.table; t.x = Math.round(op.after.left); t.y = Math.round(op.after.top); if ('band_x' in t) t.band_x = t.x; if ('band_y' in t) t.band_y = t.y; }
  else if (op.operation === 'resizeTableWidth') { const target = Math.round(op.afterWidth), current = widths.reduce((n, v) => n + v, 0); let used = 0; widths.forEach((width, c) => { widths[c] = c === widths.length - 1 ? target - used : Math.round(width * target / current); used += widths[c]; }); }
  else if (op.operation === 'hideTable') { state.table.visible = false; for (const w of cellsOf(state.table)) w.cell.visible = false; }
  else fail('UNSUPPORTED_SOURCE_STRUCTURE_OPERATION', `${op.operation}은 Static Table에서 지원하지 않습니다.`);
}
function close(state) {
  const { table, rows, widths } = state, sum = (list, from, count) => list.slice(from, from + count).reduce((n, v) => n + v, 0), heights = rows.map((row) => row.height);
  table.table = rows.map((row) => row.wrappers); table.rowCount = rows.length;
  table.table.forEach((wrappers, r) => wrappers.forEach((w, c) => {
    const x = sum(widths, 0, c), y = sum(heights, 0, r), width = w.cell ? sum(widths, c, span(w, 'colSpan')) : widths[c], height = w.cell ? sum(heights, r, span(w, 'rowSpan')) : heights[r];
    if (!Number.isFinite(width) || !Number.isFinite(height)) fail('STATIC_TABLE_GEOMETRY_INVALID', 'Row geometry가 올바르지 않습니다.');
    Object.assign(w, { rowIndex: r, columnIndex: c, x, y, width, height, rowHeight: heights[r], columnWidth: widths[c] });
    if (w.cell) Object.assign(w.cell, { x, y, width, height });
  }));
  table.width = widths.reduce((n, v) => n + v, 0); table.height = heights.reduce((n, v) => n + v, 0);
  return table;
}
function transform(table, operations, sourceTableId) {
  const state = open(table), applied = [];
  for (const op of operations) { if (op.sourceTableId && op.sourceTableId !== sourceTableId) fail('STATIC_TABLE_TARGET_MISMATCH', 'Operation Table identity가 다릅니다.'); operate(state, op); applied.push(op); }
  const moves = { ...movability(state), rowGroups: groups(state, 'row'), columnGroups: groups(state, 'column') };
  close(state);
  return { table, applied, removed: state.removed, rowOrder: state.rows.map((row) => row.base), columnOrder: state.columns, ...moves };
}
// In-memory layout used by the editor preview; the same transform produces the saved candidate.
function layout(sourceTable, operations) {
  const { table, removed, rowOrder, columnOrder, rowMoves, columnMoves, rowGroups, columnGroups } = transform(JSON.parse(JSON.stringify(sourceTable)), operations, sourceTable.id);
  return { sourceTableId: table.id, x: table.x, y: table.y, width: table.width, height: table.height, visible: table.visible !== false, rowOrder, columnOrder, rowMoves, columnMoves, rowGroups, columnGroups, rowHeights: table.table.map((row) => row[0].rowHeight), columnWidths: table.table[0].map((w) => w.columnWidth), removedCellIds: [...removed], cells: cellsOf(table).map((w) => ({ id: w.cell.id, x: w.x, y: w.y, width: w.width, height: w.height, visible: table.visible !== false && w.cell.visible !== false && w.width > 0 && w.height > 0 })) };
}
function apply({ sourceFormPath, candidateFormPath, sourceTableId, operations }) {
  if (path.resolve(sourceFormPath) === path.resolve(candidateFormPath)) fail('SOURCE_OVERWRITE_BLOCKED', 'Imported Base에는 쓸 수 없습니다.');
  const sourceHash = sha256File(sourceFormPath), source = readForm(sourceFormPath), parsed = readForm(candidateFormPath), before = JSON.parse(JSON.stringify(parsed.pages)), sourceTable = findTable(source, sourceTableId), table = findTable(parsed, sourceTableId), original = signature(sourceTable);
  const { applied, removed } = transform(table, operations, sourceTableId);
  // Identity: surviving cells keep their ids and text; only explicitly removed rows may drop cells.
  const expected = cellsOf(sourceTable).filter((w) => !removed.has(w.cell.id)).sort((a, b) => a.cell.id.localeCompare(b.cell.id)), actual = signature(table);
  if (JSON.stringify(actual.cellIds) !== JSON.stringify(expected.map((w) => w.cell.id)) || JSON.stringify(actual.texts) !== JSON.stringify(expected.map((w) => w.cell.text))) fail('STATIC_TABLE_IDENTITY_CHANGED', 'Cell identity/text가 변경되었습니다.');
  writeForm(candidateFormPath, parsed);
  const reparsed = readForm(candidateFormPath), saved = findTable(reparsed, sourceTableId);
  if (JSON.stringify(signature(saved)) !== JSON.stringify(signature(table))) fail('FORM_REPARSE_FAILED', 'Static Table 저장 후 signature가 다릅니다.');
  assertHash(sourceFormPath, sourceHash);
  return { success: true, appliedOperations: applied, sourceTableId, removedCellIds: [...removed], originalSignature: original, signature: signature(saved), structuralDiff: diff(before, reparsed.pages), originalFormSha256: sourceHash, candidateSha256: sha256File(candidateFormPath) };
}
function createCandidate({ projectName, formName, sourceTableId, operations }) {
  const context = formContext.resolve({ projectName, formName }); if (context.kind !== 'STATIC_SINGLE') fail('STATIC_TABLE_NOT_AVAILABLE', 'Imported Static Form만 지원합니다.');
  const name = makeCandidateName(projectName, 'mvp12'), sourceForm = context.form, formHash = sha256File(sourceForm), infoHash = sha256File(context.info); let root;
  try { root = copyProject(projectName, name); const candidateForm = path.join(root, formName, 'form.ubjf'), result = apply({ sourceFormPath: sourceForm, candidateFormPath: candidateForm, sourceTableId, operations }); fs.writeFileSync(path.join(root, 'mvp12-structure-metadata.json'), JSON.stringify({ projectName, formName, sourceTableId, operations, result }, null, 2) + '\n'); assertHash(sourceForm, formHash); assertHash(context.info, infoHash); return { candidateProjectName: name, formName, candidateRoot: root, candidateForm, previewUrl: `/mysuit/UView5/index.jsp?projectName=${name}&formName=${formName}`, result }; }
  catch (error) { if (root) try { removeCandidate(name); } catch (_) {} assertHash(sourceForm, formHash); throw error; }
}
module.exports = { findTable, signature, transform, layout, apply, createCandidate };
