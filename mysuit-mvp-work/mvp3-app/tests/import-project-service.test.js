const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readForm } = require('../src/server/services/form-patch-service');
const { sha256File } = require('../src/server/services/integrity-service');
const service = require('../src/server/import/import-project-service');

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/import/manual-text-only.dim.json')));
const tableFixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/import/manual-text-table.dim.json')));

test('materializes five text-only labels without modifying the template', () => {
  const template = service.templatePaths(), before = [sha256File(template.form), sha256File(template.info)];
  const result = service.createImportedProject(fixture);
  try {
    const parsed = readForm(result.formPath), labels = parsed.pages[0].items;
    assert.equal(labels.length, 5);
    assert.ok(labels.every((item) => item.className === 'UBLabel' && !item.dataSet && !item.column && !item.systemFunction));
    assert.deepEqual(labels.map((item) => decodeURIComponent(item.text)), fixture.elements.map((item) => item.text));
    assert.deepEqual(labels.map((item) => [item.x, item.y, item.width, item.height]), fixture.elements.map((item) => [item.x, item.y, item.width, item.height]));
    assert.equal(new Set(labels.map((item) => item.id)).size, 5);
    assert.deepEqual([sha256File(template.form), sha256File(template.info)], before);
    assert.ok(fs.existsSync(path.join(result.root, 'import-meta.json')));
  } finally { service.removeImportedProject(result.projectName); }
});

test('materializes mixed text and a 3x4 source UBTable and reparses it', () => {
  const template = service.templatePaths(), prototype = service.tablePrototypePaths();
  const before = [template.form, template.info, prototype.form, prototype.info].map(sha256File);
  const result = service.createImportedProject(tableFixture);
  try {
    const parsed = readForm(result.formPath), items = parsed.pages[0].items;
    const labels = items.filter((item) => item.className === 'UBLabel');
    const tables = items.filter((item) => item.className === 'UBTable');
    assert.equal(labels.length, 3);
    assert.equal(tables.length, 1);
    assert.equal(tables[0].rowCount, 4);
    assert.equal(tables[0].columnCount, 3);
    assert.equal(tables[0].table.flat().length, 12);
    assert.equal(new Set(tables[0].table.flat().map((wrapper) => wrapper.cell.id)).size, 12);
    assert.ok(tables[0].table.flat().every((wrapper) => !wrapper.cell.dataSet && !wrapper.cell.column && !wrapper.cell.formula));
    assert.deepEqual([template.form, template.info, prototype.form, prototype.info].map(sha256File), before);
  } finally { service.removeImportedProject(result.projectName); }
});

test('invalid DIM fails before creating an incomplete project', () => {
  const before = new Set(fs.readdirSync(path.dirname(service.safeProjectPath(service.makeImportProjectName()))).filter((name) => /^import_mvp1[01]_/.test(name)));
  assert.throws(() => service.createImportedProject({ ...fixture, version: 'bad' }), (error) => error.code === 'IMPORT_DIM_INVALID');
  const after = new Set(fs.readdirSync(path.dirname(service.safeProjectPath(service.makeImportProjectName()))).filter((name) => /^import_mvp1[01]_/.test(name)));
  assert.deepEqual(after, before);
});

test('invalid table DIM is atomic and leaves prototype/template unchanged', () => {
  const watched = [...Object.values(service.templatePaths()).filter((x) => /\.(ubjf|xml)$/.test(x)), ...Object.values(service.tablePrototypePaths()).filter((x) => /\.(ubjf|xml)$/.test(x))];
  const beforeHashes = watched.map(sha256File);
  const beforeProjects = new Set(fs.readdirSync(path.dirname(service.safeProjectPath(service.makeImportProjectName()))).filter((name) => /^import_mvp11_/.test(name)));
  const invalid = structuredClone(tableFixture); invalid.elements.find((x) => x.type === 'table').rows[0].cells.pop();
  assert.throws(() => service.createImportedProject(invalid), (error) => error.code === 'IMPORT_TABLE_CELL_COUNT_MISMATCH');
  assert.deepEqual(watched.map(sha256File), beforeHashes);
  assert.deepEqual(new Set(fs.readdirSync(path.dirname(service.safeProjectPath(service.makeImportProjectName()))).filter((name) => /^import_mvp11_/.test(name))), beforeProjects);
});

test('supports an MVP 2.0 evidence project name and analyzer metadata options', () => {
  assert.match(service.safeProjectPath('import_mvp20_20260828_141814_abcdef'), /import_mvp20_20260828_141814_abcdef$/);
  assert.match(service.makeImportProjectName(new Date(2026, 7, 28, 14, 18, 14), '2.0'), /^import_mvp20_/);
  assert.match(service.safeProjectPath('import_mvp21_20260828_143548_abcdef'), /import_mvp21_20260828_143548_abcdef$/);
  assert.match(service.makeImportProjectName(new Date(2026, 7, 28, 14, 35, 48), '2.1'), /^import_mvp21_/);
  assert.match(service.safeProjectPath('import_mvp22_20260828_145028_abcdef'), /import_mvp22_20260828_145028_abcdef$/);
  assert.match(service.makeImportProjectName(new Date(2026, 7, 28, 14, 50, 28), '2.2'), /^import_mvp22_/);
});
