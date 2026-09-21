const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const adapter = require('../src/server/services/static-table-structure-adapter');
const { readForm } = require('../src/server/services/form-patch-service');
const importer = require('../src/server/import/import-project-service');
const capability = require('../src/server/services/capability-service');
const service = require('../src/server/services/structure-operation-service');

// Order-form shaped table: every item uses two lines and its 순번 cell spans both (rowSpan 2 in column 0).
// The last row is a plain row; the header row has a colSpan across columns 1-2.
function itemTable() {
  const rows = [
    [{ id: 'H0' }, { id: 'H1', colSpan: 2 }, null, { id: 'H3' }],
    [{ id: 'N10', rowSpan: 2 }, { id: 'A1' }, { id: 'A2' }, { id: 'A3' }],
    [null, { id: 'B1' }, { id: 'B2' }, { id: 'B3' }],
    [{ id: 'N20', rowSpan: 2 }, { id: 'C1' }, { id: 'C2' }, { id: 'C3' }],
    [null, { id: 'D1' }, { id: 'D2' }, { id: 'D3' }],
    [{ id: 'P0' }, { id: 'P1' }, { id: 'P2' }, { id: 'P3' }],
  ];
  const width = 50, height = 20;
  return { id: 'T1', className: 'UBTable', x: 0, y: 0, width: width * 4, height: height * rows.length, rowCount: rows.length, columnCount: 4, table: rows.map((row, r) => row.map((spec, c) => { const w = { x: c * width, y: r * height, width, height, rowHeight: height, columnWidth: width }; if (!spec) return { ...w, status: 'MC' }; const rs = spec.rowSpan || 1, cs = spec.colSpan || 1; return { ...w, width: width * cs, height: height * rs, ...(rs > 1 || cs > 1 ? { status: 'MS', rowSpan: rs, colSpan: cs } : {}), cell: { id: spec.id, text: spec.id, x: c * width, y: r * height, width: width * cs, height: height * rs, ...(rs > 1 ? { rowSpan: rs } : {}), ...(cs > 1 ? { colSpan: cs } : {}) } }; })) };
}
const clone = (value) => JSON.parse(JSON.stringify(value));
const texts = (table) => table.table.map((row) => row.filter((w) => w.cell).map((w) => w.cell.text).join(','));

test('movability reflects actual merge ranges, not the presence of a merge in the row', () => {
  const layout = adapter.layout(itemTable(), []);
  assert.deepEqual(layout.rowMoves, [
    { up: false, down: false }, // header ↔ first item line would split the 순번 merge
    { up: false, down: true },  // first line ↔ second line stays inside the merge
    { up: true, down: false },
    { up: false, down: true },
    { up: true, down: false },  // second line of the last item ↔ plain row would split it
    { up: false, down: false },
  ]);
  // rowSpans never block column moves; the header colSpan (columns 1-2) blocks only swaps that cut through it.
  assert.deepEqual(layout.columnMoves, [{ left: false, right: false }, { left: false, right: true }, { left: true, right: false }, { left: false, right: false }]);
});

test('a row swap inside a merge keeps the anchor on top and moves every other cell with its row', () => {
  const { table } = adapter.transform(clone(itemTable()), [{ operation: 'moveRow', rowIndex: 1, toRowIndex: 2, rowCellIds: ['N10', 'A1', 'A2', 'A3'] }], 'T1');
  assert.deepEqual(texts(table).slice(1, 3), ['N10,B1,B2,B3', 'A1,A2,A3']);
  const anchor = table.table[1][0];
  assert.equal(anchor.cell.id, 'N10'); assert.equal(anchor.y, 20); assert.equal(anchor.height, 40);
  assert.equal(table.table[2][0].status, 'MC');
  // The same logical row can move back afterwards although the anchor now sits in the other row object.
  const back = adapter.transform(clone(itemTable()), [{ operation: 'moveRow', rowIndex: 1, toRowIndex: 2, rowCellIds: ['N10', 'A1', 'A2', 'A3'] }, { operation: 'moveRow', rowIndex: 1, toRowIndex: 1, rowCellIds: ['N10', 'A1', 'A2', 'A3'] }], 'T1');
  assert.deepEqual(texts(back.table), texts(itemTable()));
});

test('a row move that would split a merge is refused with a plain message', () => {
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveRow', rowIndex: 2, toRowIndex: 3 }], 'T1'), (e) => e.code === 'ROWSPAN_DEPENDENCY' && /병합된 셀이 나뉘게/.test(e.message) && !/의존성/.test(e.message));
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveColumn', columnIndex: 0, toVisualIndex: 1 }], 'T1'), (e) => e.code === 'COLSPAN_DEPENDENCY' && /병합된 셀이 나뉘게/.test(e.message));
});

test('column moves ignore row merges and carry width, contents and identity', () => {
  // Without the header colSpan only rowSpans remain, and they never block a column move.
  const source = itemTable(); source.table = source.table.slice(1); source.rowCount = source.table.length; source.height = 100;
  source.table.forEach((row) => { row[3].columnWidth = 80; row[3].width = 80; if (row[3].cell) row[3].cell.width = 80; }); source.width = 230;
  assert.deepEqual(adapter.layout(source, []).columnMoves.map((m) => [m.left, m.right]), [[false, true], [true, true], [true, true], [true, false]]);
  const { table } = adapter.transform(clone(source), [{ operation: 'moveColumn', columnIndex: 3, toVisualIndex: 2 }], 'T1');
  assert.equal(table.table[0][2].cell.id, 'A3'); assert.equal(table.table[0][2].columnWidth, 80); assert.equal(table.table[0][2].x, 100);
  assert.equal(table.table[0][0].cell.id, 'N10'); assert.equal(table.table[0][0].height, 40);
  // With the header colSpan (columns 1-2), a move that cuts through it is refused.
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveColumn', columnIndex: 3, toVisualIndex: 2 }], 'T1'), { code: 'COLSPAN_DEPENDENCY' });
  const personnel = readForm(path.join(__dirname, '../samples/editing-v2/hwpx-personnel.form.ubjf')).pages[0].items.find((x) => x.id === 'IMPTB0005');
  assert.ok(adapter.layout(personnel, []).columnMoves.some((m) => m.right));
});

// Service level: an imported project with the same merge shape.
const dim = { version: '1.3', page: { width: 794, height: 1123 }, elements: [{ id: 'items', type: 'table', x: 20, y: 40, width: 300, height: 100, columns: [{ id: 'c0', width: 60 }, { id: 'c1', width: 120 }, { id: 'c2', width: 120 }], rows: [
  { height: 20, cells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 1, text: '10' }, { row: 0, col: 1, text: 'A1' }, { row: 0, col: 2, text: 'A2' }] },
  { height: 20, cells: [{ row: 1, col: 1, text: 'B1' }, { row: 1, col: 2, text: 'B2' }] },
  { height: 20, cells: [{ row: 2, col: 0, rowSpan: 2, colSpan: 1, text: '20' }, { row: 2, col: 1, text: 'C1' }, { row: 2, col: 2, text: 'C2' }] },
  { height: 20, cells: [{ row: 3, col: 1, text: 'D1' }, { row: 3, col: 2, text: 'D2' }] },
  { height: 20, cells: [{ row: 4, col: 0, text: 'P0' }, { row: 4, col: 1, text: 'P1' }, { row: 4, col: 2, text: 'P2' }] },
] }] };
let project, scope, key;
test.before(() => { project = importer.createImportedProject(dim, { projectName: importer.makeImportProjectName(new Date(), '1.3') }); scope = { layoutDraftId: `test_static_move_${process.pid}`, projectName: project.projectName, formName: project.formName }; key = `tbl:static:${readForm(project.formPath).pages[0].items.find((x) => x.className === 'UBTable').id}`; });
test.after(() => { try { service.clear(scope); } finally { importer.removeImportedProject(project.projectName); } });

test('capability no longer blocks moveRow for a row that merely sits inside a merge; hide stays guarded', () => {
  const caps = capability.getCapabilities(scope, 'LOGICAL_ROW', { logicalRowKey: `${key}|row:0` });
  assert.equal(caps.capabilities.moveRow.allowed, true);
  assert.equal(caps.capabilities.moveRow.constraints.mergeRule, 'MOVE_MUST_NOT_SPLIT_MERGE');
  assert.equal(caps.capabilities.hideRow.allowed, false); assert.equal(caps.capabilities.hideRow.reason, 'ROWSPAN_DEPENDENCY');
});

test('moveRow succeeds inside a merge and fails closed across one', () => {
  const common = { ...scope, logicalTableKey: key, compositeTableKey: key.replace('tbl:', 'ctbl:') };
  const inside = service.upsert({ ...common, operation: 'moveRow', logicalRowKey: `${key}|row:0`, toRowIndex: 1 });
  assert.equal(inside.fromRowIndex, 0);
  assert.throws(() => service.upsert({ ...common, operation: 'moveRow', logicalRowKey: `${key}|row:1`, toRowIndex: 2 }), (e) => e.code === 'ROWSPAN_DEPENDENCY' && e.status === 409);
  assert.equal(service.list(scope).length, 1);
  service.clear(scope);
});

test('static column moves are recorded per action, so a column can return to its original position', () => {
  const common = { ...scope, logicalTableKey: key, compositeTableKey: key.replace('tbl:', 'ctbl:') };
  service.upsert({ ...common, operation: 'moveColumn', columnIndex: 1, toVisualIndex: 2 });
  const back = service.upsert({ ...common, operation: 'moveColumn', columnIndex: 1, toVisualIndex: 1 });
  assert.equal(back.originalVisualIndex, 2);
  assert.equal(service.list(scope).filter((x) => x.operation === 'moveColumn').length, 2);
  const { layouts } = require('../src/server/services/static-table-model-service'), order = Object.values(layouts(scope))[0].columnOrder;
  assert.deepEqual(order, [0, 1, 2]);
  service.clear(scope);
});

// ---- Interaction 3.2: merge groups and set moves ------------------------------------------------------------------
test('groups close over merges spanning the axis, except merges covering the whole axis', () => {
  const layout = adapter.layout(itemTable(), []);
  assert.deepEqual(layout.rowGroups, [[0, 0], [1, 2], [3, 4], [5, 5]]);
  // The header colSpan covers columns 1-2 only, so those two columns form one group.
  assert.deepEqual(layout.columnGroups, [[0, 0], [1, 2], [3, 3]]);
  const titled = itemTable(); titled.table[0] = [{ x: 0, y: 0, width: 200, height: 20, rowHeight: 20, columnWidth: 50, status: 'MS', rowSpan: 1, colSpan: 4, cell: { id: 'TITLE', text: 'TITLE', x: 0, y: 0, width: 200, height: 20, colSpan: 4 } }, ...[1, 2, 3].map((c) => ({ x: c * 50, y: 0, width: 50, height: 20, rowHeight: 20, columnWidth: 50, status: 'MC' }))];
  assert.deepEqual(adapter.layout(titled, []).columnGroups, [[0, 0], [1, 1], [2, 2], [3, 3]]);
});

test('moveRows moves whole items as one step and refuses a result that splits a merge', () => {
  const { table } = adapter.transform(clone(itemTable()), [{ operation: 'moveRows', rowIndexes: [1, 2], toRowIndex: 3 }], 'T1');
  assert.deepEqual(texts(table), ['H0,H1,H3', 'N20,C1,C2,C3', 'D1,D2,D3', 'N10,A1,A2,A3', 'B1,B2,B3', 'P0,P1,P2,P3']);
  assert.equal(table.table[3][0].cell.id, 'N10'); assert.equal(table.table[3][0].height, 40);
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveRows', rowIndexes: [2], toRowIndex: 4 }], 'T1'), { code: 'ROWSPAN_DEPENDENCY' });
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveRows', rowIndexes: [1, 2], toRowIndex: 1 }], 'T1'), { code: 'INVALID_ROW_MOVE' });
  const cols = adapter.transform(clone(itemTable()), [{ operation: 'moveColumns', columnIndexes: [1, 2], toVisualIndex: 2 }], 'T1');
  assert.deepEqual(cols.columnOrder, [0, 3, 1, 2]);
  assert.throws(() => adapter.transform(clone(itemTable()), [{ operation: 'moveColumns', columnIndexes: [2], toVisualIndex: 3 }], 'T1'), { code: 'COLSPAN_DEPENDENCY' });
});

test('set moves are validated by the service and recorded as one operation', () => {
  const common = { ...scope, logicalTableKey: key, compositeTableKey: key.replace('tbl:', 'ctbl:') };
  const moved = service.upsert({ ...common, operation: 'moveRows', logicalRowKeys: [`${key}|row:0`, `${key}|row:1`], toRowIndex: 2 });
  assert.deepEqual(moved.rowIndexes, [0, 1]); assert.equal(moved.fromRowIndex, 0);
  assert.throws(() => service.upsert({ ...common, operation: 'moveRows', logicalRowKeys: [`${key}|row:1`], toRowIndex: 4 }), { code: 'ROWSPAN_DEPENDENCY' });
  const { layouts } = require('../src/server/services/static-table-model-service');
  assert.deepEqual(Object.values(layouts(scope))[0].rowOrder, [2, 3, 0, 1, 4]);
  assert.equal(service.list(scope).length, 1);
  service.clear(scope);
});
