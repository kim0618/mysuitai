const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const config = require('../src/server/config');
const formContext = require('../src/server/services/form-context-service');
const modelService = require('../src/server/services/static-table-model-service');
const resolver = require('../src/server/services/target-resolver');
const capability = require('../src/server/services/capability-service');
const changes = require('../src/server/services/changeset-service');
const history = require('../src/server/services/history-service');
const render = require('../src/server/services/render-patch-service');
const structure = require('../src/server/services/structure-operation-service');
const adapter = require('../src/server/services/static-table-structure-adapter');
const { readForm } = require('../src/server/services/form-patch-service');
const { sha256File } = require('../src/server/services/integrity-service');
const { removeCandidate } = require('../src/server/services/project-copy-service');

const projectName = 'import_mvp11_20260827_170551_e59e1d', formName = 'SampleReport_FreeForm';
const scope = { layoutDraftId: `mvp12_unit_${process.pid}`, projectName, formName };
const sampleScope = { layoutDraftId: `mvp12_unit_${process.pid}`, projectName: 'sample', formName: 'sample' };
const baseForm = path.join(config.projectsRoot, projectName, formName, 'form.ubjf');

test.after(() => { for (const s of [scope, sampleScope]) { try { render.clear(s); } catch (_) {} try { structure.clear(s); } catch (_) {} try { history.clear(s); } catch (_) {} } });

test('resolves safe original/imported FormContext and rejects arbitrary projects', () => {
  assert.equal(formContext.resolve(scope).kind, 'STATIC_SINGLE');
  assert.equal(formContext.resolve(sampleScope).kind, 'COMPOSITE_SAMPLE');
  assert.throws(() => formContext.resolve({ projectName: 'sample_mvp4_fake', formName: 'sample' }), (e) => e.code === 'SOURCE_PROJECT_NOT_FOUND');
});

test('discovers one 3x4 static table with exclusive column/row/table identities', () => {
  const model = modelService.discover(scope);
  assert.deepEqual([model.columnCount, model.rowCount, model.cells.length], [3, 4, 12]);
  assert.ok(model.columns.every((column) => column.sourceCellIds.length === 4));
  assert.ok(model.rows.every((row) => row.sourceCellIds.length === 3));
  assert.equal(new Set(model.columns.flatMap((x) => x.sourceCellIds)).size, 12);
  assert.equal(new Set(model.rows.flatMap((x) => x.sourceCellIds)).size, 12);
});

test('resolves imported OBJECT, column, row and table targets', () => {
  const model = modelService.discover(scope);
  assert.equal(resolver.resolve('OBJECT', { viewerObjectId: 'IMPLB0001', runtimeText: '월간 실적 보고서' }, scope).sourceObjectId, 'IMPLB0001');
  assert.equal(resolver.resolve('LOGICAL_COLUMN', { logicalColumnKey: model.columns[1].logicalColumnKey }, scope).memberCellIds.length, 4);
  assert.equal(resolver.resolve('LOGICAL_ROW', { logicalRowKey: model.rows[1].logicalRowKey }, scope).memberCellIds.length, 3);
  assert.equal(resolver.resolve('COMPOSITE_TABLE', { compositeTableKey: model.compositeTableKey }, scope).memberCellIds.length, 12);
});

test('reports structural capabilities from shape rather than IMPORTED origin', () => {
  const model = modelService.discover(scope);
  const object = capability.getCapabilities(scope, 'OBJECT', { viewerObjectId: 'IMPLB0001', runtimeText: '월간 실적 보고서' });
  const column = capability.getCapabilities(scope, 'LOGICAL_COLUMN', { logicalColumnKey: model.columns[0].logicalColumnKey });
  const row = capability.getCapabilities(scope, 'LOGICAL_ROW', { logicalRowKey: model.rows[0].logicalRowKey });
  const table = capability.getCapabilities(scope, 'COMPOSITE_TABLE', { compositeTableKey: model.compositeTableKey });
  assert.equal(object.capabilities.updateText.allowed, true);
  assert.equal(column.capabilities.resizeColumn.allowed, true);
  assert.equal(row.capabilities.resizeRow.allowed, true);
  assert.equal(table.capabilities.resizeTableWidth.allowed, true);
  assert.equal(table.capabilities.collapseTable.allowed, false);
});

test('isolates source/render/structure/history stores by project+form+draft', () => {
  changes.create(scope); changes.create(sampleScope);
  const model = modelService.discover(scope);
  structure.upsert({ ...scope, operation: 'resizeColumn', logicalTableKey: model.tableKey, columnIndex: 0, afterWidth: 220 });
  assert.equal(structure.list(scope).length, 1); assert.equal(structure.list(sampleScope).length, 0);
  assert.equal(history.get(scope).events.length, 0); assert.equal(history.get(sampleScope).events.length, 0);
});

test('rejects an invalid imported operation without changing store or history', () => {
  const model = modelService.discover(scope), beforeOps = structure.list(scope), beforeHistory = history.get(scope);
  assert.throws(() => structure.upsert({ ...scope, operation: 'resizeColumn', logicalTableKey: model.tableKey, columnIndex: 1, afterWidth: 900 }), (e) => e.code === 'INVALID_COLUMN_WIDTH');
  assert.deepEqual(structure.list(scope), beforeOps);
  assert.deepEqual(history.get(scope), beforeHistory);
});

test('materializes resizeColumn+resizeRow+moveTable to candidate without touching Imported Base', () => {
  const before = sha256File(baseForm), model = modelService.discover(scope);
  const result = adapter.createCandidate({ projectName, formName, sourceTableId: model.sourceTableId, operations: [
    { operation: 'resizeColumn', sourceTableId: model.sourceTableId, columnIndex: 0, afterWidth: 240 },
    { operation: 'resizeRow', sourceTableId: model.sourceTableId, rowIndex: 1, afterHeight: 52 },
    { operation: 'moveTable', sourceTableId: model.sourceTableId, after: { left: 102, top: 185 } },
  ] });
  try { const parsed = readForm(result.candidateForm), table = adapter.findTable(parsed, model.sourceTableId); assert.deepEqual([table.x, table.y, table.width, table.height], [102, 185, 660, 172]); assert.equal(table.table[1][0].height, 52); assert.equal(new Set(table.table.flat().map((w) => w.cell.id)).size, 12); assert.equal(sha256File(baseForm), before); }
  finally { removeCandidate(result.candidateProjectName); }
});
