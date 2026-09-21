const path = require('path');
const config = require('../config');
const contextService = require('./form-context-service');
const { readForm } = require('./form-patch-service');

function fail(code, message, status = 404) { throw Object.assign(new Error(message), { code, status }); }
const span = (wrapper, key) => (wrapper?.cell ? Math.max(1, Number(wrapper[key] ?? wrapper.cell[key] ?? 1) || 1) : 1);
// Merge coverage grid: every covered position points at its anchor (row, column).
function coverage(table) {
  const owner = table.table.map((row) => row.map(() => null));
  table.table.forEach((row, r) => row.forEach((wrapper, c) => {
    if (!wrapper?.cell) return;
    for (let dr = 0; dr < span(wrapper, 'rowSpan'); dr++) for (let dc = 0; dc < span(wrapper, 'colSpan'); dc++) if (owner[r + dr]) owner[r + dr][c + dc] = { r, c };
  }));
  return owner;
}
function mergeFlags(table) {
  const owner = coverage(table), verticalRows = new Set(), horizontalColumns = new Set();
  table.table.forEach((row, r) => row.forEach((wrapper, c) => {
    if (!wrapper?.cell) return;
    const rs = span(wrapper, 'rowSpan'), cs = span(wrapper, 'colSpan');
    if (rs > 1) for (let i = 0; i < rs; i++) verticalRows.add(r + i);
    if (cs > 1) for (let i = 0; i < cs; i++) horizontalColumns.add(c + i);
  }));
  return { owner, verticalRows, horizontalColumns };
}
// Canonical track sizes: a wrapper that is not a multi-row/column anchor carries the single track size.
function tracks(table) {
  const rowHeights = table.table.map((row) => { const w = row.find((x) => span(x, 'rowSpan') === 1) || row[0]; return Number(w.rowHeight ?? w.height); });
  const columnWidths = table.table[0].map((_, c) => { const w = table.table.map((row) => row[c]).find((x) => span(x, 'colSpan') === 1) || table.table[0][c]; return Number(w.columnWidth ?? w.width); });
  return { rowHeights, columnWidths };
}
function modelOf(table, pageIndex) {
  if (!Array.isArray(table.table) || table.table.length !== table.rowCount || table.table.some((row) => row.length !== table.columnCount)) fail('STATIC_TABLE_STRUCTURE_MISMATCH', 'Imported UBTable rectangularity가 일치하지 않습니다.', 409);
  const tableKey = `tbl:static:${table.id}`, { verticalRows, horizontalColumns } = mergeFlags(table), { rowHeights, columnWidths } = tracks(table);
  const cells = table.table.flatMap((row, rowIndex) => row.map((wrapper, columnIndex) => (wrapper?.cell ? { sourceCellId: wrapper.cell.id, sourceTableId: table.id, rowIndex, columnIndex, rowSpan: span(wrapper, 'rowSpan'), colSpan: span(wrapper, 'colSpan'), x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height, viewerObjectId: wrapper.cell.id, renderInstanceKey: `p${pageIndex}|c0|src:${wrapper.cell.id}|band:FREEFORM|row:0|idx:{renderIndex}` } : null)).filter(Boolean));
  const columns = columnWidths.map((width, columnIndex) => ({ logicalColumnKey: `${tableKey}|col:${columnIndex}`, columnIndex, width, horizontalMerge: horizontalColumns.has(columnIndex), sourceCellIds: cells.filter((cell) => cell.columnIndex === columnIndex).map((cell) => cell.sourceCellId), viewerObjectIds: cells.filter((cell) => cell.columnIndex <= columnIndex && cell.columnIndex + cell.colSpan > columnIndex).map((cell) => cell.viewerObjectId) }));
  const rows = rowHeights.map((height, rowIndex) => ({ logicalRowKey: `${tableKey}|row:${rowIndex}`, rowIndex, rowRole: 'STATIC_ROW', height, verticalMerge: verticalRows.has(rowIndex), sourceCellIds: cells.filter((cell) => cell.rowIndex === rowIndex).map((cell) => cell.sourceCellId), viewerObjectIds: cells.filter((cell) => cell.rowIndex <= rowIndex && cell.rowIndex + cell.rowSpan > rowIndex).map((cell) => cell.viewerObjectId) }));
  return { schemaVersion: 2, tableType: 'STATIC_SINGLE', tableKey, compositeTableKey: `ctbl:static:${table.id}`, sourceTableIds: [table.id], sourceTableId: table.id, pageIndex, x: table.x, y: table.y, width: table.width, height: table.height, columnCount: table.columnCount, rowCount: table.rowCount, merged: verticalRows.size > 0 || horizontalColumns.size > 0, cells, columns, rows };
}
function discoverAll(scope) {
  const context = contextService.resolve(scope);
  if (context.kind !== 'STATIC_SINGLE') fail('STATIC_TABLE_NOT_AVAILABLE', 'Imported Static Form이 아닙니다.', 409);
  const parsed = readForm(path.join(config.projectsRoot, context.projectName, context.formName, 'form.ubjf'));
  const tables = parsed.pages.flatMap((page, pageIndex) => page.items.filter((item) => item?.className === 'UBTable').map((table) => modelOf(table, pageIndex)));
  if (!tables.length) fail('STATIC_TABLE_STRUCTURE_MISMATCH', 'Imported Form에 UBTable이 없습니다.', 409);
  return tables;
}
// A key may be a sourceTableId, logical table key, composite key or a row/column key of that table.
function tableIdOf(key) { const m = /^(?:c?tbl:static:)?([A-Za-z][A-Za-z0-9_]*)/.exec(String(key || '')); return m ? m[1] : null; }
function discover(scope, key = scope?.logicalTableKey || scope?.compositeTableKey || scope?.sourceTableId) {
  const tables = discoverAll(scope);
  if (!key) { if (tables.length === 1) return tables[0]; fail('STATIC_TABLE_AMBIGUOUS', '편집할 표를 지정해야 합니다.', 409); }
  const found = tables.find((table) => table.sourceTableId === tableIdOf(key));
  if (!found) fail('UNSUPPORTED_LOGICAL_TABLE', 'Imported Table을 찾을 수 없습니다.', 404);
  return found;
}
// Preview layout of every table after the draft's recorded structure operations (same transform as save).
function layouts(scope, tables = discoverAll(scope)) {
  const { layout, findTable } = require('./static-table-structure-adapter'), operations = require('./structure-operation-service').list(scope), context = contextService.resolve(scope), parsed = readForm(path.join(config.projectsRoot, context.projectName, context.formName, 'form.ubjf'));
  return Object.fromEntries(tables.map((table) => [table.sourceTableId, layout(findTable(parsed, table.sourceTableId), operations.filter((op) => op.sourceTableId === table.sourceTableId))]));
}
module.exports = { discover, discoverAll, layouts, tableIdOf, span, mergeFlags, tracks };
