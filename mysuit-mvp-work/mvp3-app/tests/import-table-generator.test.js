const test = require('node:test');
const assert = require('node:assert/strict');
const { readForm } = require('../src/server/services/form-patch-service');
const { collectIds, createIdContext } = require('../src/server/import/import-label-generator');
const { tablePrototypePaths, analyzeTablePrototype } = require('../src/server/import/import-project-service');
const { createImportedTable, validateImportedTable } = require('../src/server/import/import-table-generator');

const prototypeForm = readForm(tablePrototypePaths().form);
const prototype = analyzeTablePrototype(prototypeForm);

function element(rows = 1, columns = 1) {
  const widths = Array(columns).fill(60);
  const heights = Array(rows).fill(24);
  return {
    id: 'table', type: 'table', x: 80, y: 160,
    width: widths.reduce((a, b) => a + b, 0), height: heights.reduce((a, b) => a + b, 0),
    columns: widths.map((width, index) => ({ id: `c${index}`, width })),
    rows: heights.map((height, r) => ({ height, cells: widths.map((_, c) => ({ text: `R${r}C${c}` })) })),
  };
}

test('clones a real 1x1 UBTable prototype as a static table', () => {
  const table = createImportedTable({ prototype, element: element(), idContext: createIdContext(collectIds(prototypeForm.pages)), targetBand: '' });
  assert.equal(table.className, 'UBTable');
  assert.equal(table.rowCount, 1);
  assert.equal(table.columnCount, 1);
  assert.equal(table.table[0][0].cell.id, 'IMPCL0001');
  assert.equal(decodeURIComponent(table.table[0][0].cell.text), 'R0C0');
  assert.ok(table.table[0][0].borderString.includes('borderType:SOLD'));
  assert.equal(validateImportedTable(table), true);
});

test('creates a rectangular 3x4 table with relative cell geometry and unique IDs', () => {
  const table = createImportedTable({ prototype, element: element(4, 3), idContext: createIdContext(), targetBand: '' });
  assert.deepEqual(table.table.map((row) => row.map((wrapper) => [wrapper.x, wrapper.y])), [
    [[0, 0], [60, 0], [120, 0]], [[0, 24], [60, 24], [120, 24]],
    [[0, 48], [60, 48], [120, 48]], [[0, 72], [60, 72], [120, 72]],
  ]);
  assert.equal(new Set(table.table.flat().map((wrapper) => wrapper.cell.id)).size, 12);
  assert.equal(validateImportedTable(table), true);
});
