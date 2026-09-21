const test = require('node:test'), assert = require('node:assert/strict');
const { Readable } = require('stream');
const importer = require('../src/server/import/import-project-service');
const { readForm } = require('../src/server/services/form-patch-service');
const service = require('../src/server/services/structure-operation-service');
const history = require('../src/server/services/history-service');
const routes = require('../src/server/routes/structure-operation-routes');
const route = routes.routeStructureOperations || routes;

// Two items whose 순번 cell spans two lines, then a plain row.
const dim = { version: '1.3', page: { width: 794, height: 1123 }, elements: [{ id: 'items', type: 'table', x: 20, y: 40, width: 300, height: 100, columns: [{ id: 'c0', width: 60 }, { id: 'c1', width: 120 }, { id: 'c2', width: 120 }], rows: [
  { height: 20, cells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 1, text: '10' }, { row: 0, col: 1, text: 'A1' }, { row: 0, col: 2, text: 'A2' }] },
  { height: 20, cells: [{ row: 1, col: 1, text: 'B1' }, { row: 1, col: 2, text: 'B2' }] },
  { height: 20, cells: [{ row: 2, col: 0, rowSpan: 2, colSpan: 1, text: '20' }, { row: 2, col: 1, text: 'C1' }, { row: 2, col: 2, text: 'C2' }] },
  { height: 20, cells: [{ row: 3, col: 1, text: 'D1' }, { row: 3, col: 2, text: 'D2' }] },
  { height: 20, cells: [{ row: 4, col: 0, text: 'P0' }, { row: 4, col: 1, text: 'P1' }, { row: 4, col: 2, text: 'P2' }] },
] }] };
let project, scope, key;
test.before(() => { project = importer.createImportedProject(dim, { projectName: importer.makeImportProjectName(new Date(), '1.3') }); scope = { layoutDraftId: `test_batch_${process.pid}`, projectName: project.projectName, formName: project.formName }; key = `tbl:static:${readForm(project.formPath).pages[0].items.find((x) => x.className === 'UBTable').id}`; });
test.after(() => { try { service.clear(scope); history.clear(scope); } finally { importer.removeImportedProject(project.projectName); } });

function call(body) {
  return new Promise((resolve) => {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]); Object.assign(req, { url: '/api/structure-operations/batch', method: 'PUT' });
    const res = { status: 0, writeHead(status) { this.status = status; }, end(text) { resolve({ status: this.status, body: JSON.parse(text) }); } };
    route(req, res);
  });
}
const common = () => ({ logicalTableKey: key, compositeTableKey: key.replace('tbl:', 'ctbl:') });

test('a batch of structure operations is one history event', async () => {
  const before = history.get(scope).events.length;
  const res = await call({ ...scope, label: '행 2개 높이 변경', operations: [{ ...common(), operation: 'resizeRow', logicalRowKey: `${key}|row:0`, afterHeight: 24 }, { ...common(), operation: 'resizeRow', logicalRowKey: `${key}|row:1`, afterHeight: 24 }] });
  assert.equal(res.status, 200); assert.equal(res.body.operations.length, 2);
  const events = history.get(scope).events;
  assert.equal(events.length, before + 1); assert.equal(events.at(-1).label, '행 2개 높이 변경');
  assert.equal(service.list(scope).filter((x) => x.operation === 'resizeRow').length, 2);
});

test('a failing operation rolls the whole batch back', async () => {
  const opsBefore = JSON.stringify(service.list(scope)), eventsBefore = history.get(scope).events.length;
  const res = await call({ ...scope, operations: [{ ...common(), operation: 'resizeRow', logicalRowKey: `${key}|row:4`, afterHeight: 30 }, { ...common(), operation: 'moveRows', logicalRowKeys: [`${key}|row:1`], toRowIndex: 3 }] });
  assert.equal(res.status, 409); assert.equal(res.body.code, 'ROWSPAN_DEPENDENCY');
  assert.equal(JSON.stringify(service.list(scope)), opsBefore);
  assert.equal(history.get(scope).events.length, eventsBefore);
});
