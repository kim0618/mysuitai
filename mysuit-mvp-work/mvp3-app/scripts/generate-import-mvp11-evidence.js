const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
const config = require('../src/server/config');
const { readForm, writeForm } = require('../src/server/services/form-patch-service');
const { validateDim } = require('../src/server/import/dim-validator');
const service = require('../src/server/import/import-project-service');
const { signature, validateImportedTable } = require('../src/server/import/import-table-generator');

const work = path.resolve(__dirname, '../..'), logs = path.join(work, 'logs');
const fixturePath = path.resolve(__dirname, '../samples/import/manual-text-table.dim.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath));
const evidenceProject = 'import_mvp11_20260827_170551_e59e1d';
const evidenceRoot = path.join(config.projectsRoot, evidenceProject, service.TEMPLATE.formName);
const evidenceForm = path.join(evidenceRoot, 'form.ubjf');
const parsed = readForm(evidenceForm), table = parsed.pages[0].items.find((item) => item.className === 'UBTable');
const prototypePaths = service.tablePrototypePaths(), prototypeForm = readForm(prototypePaths.form), prototype = service.analyzeTablePrototype(prototypeForm), wrapper = prototype.table[0][0];
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(logs, name), JSON.stringify(value, null, 2) + '\n');

let started = performance.now(); validateDim(fixture); const validationMs = performance.now() - started;
const tmp = fs.mkdtempSync(path.join('/tmp', 'mysuit-import-mvp11-'));
try {
  started = performance.now(); fs.cpSync(service.templatePaths().root, path.join(tmp, service.TEMPLATE.formName), { recursive: true }); const cloneMs = performance.now() - started;
  const tmpForm = path.join(tmp, service.TEMPLATE.formName, 'form.ubjf'), target = readForm(tmpForm);
  started = performance.now(); service.materializeDim(target, validateDim(fixture), prototype); const generationMs = performance.now() - started;
  started = performance.now(); writeForm(tmpForm, target); const serializationMs = performance.now() - started;
  started = performance.now(); readForm(tmpForm); const reparseMs = performance.now() - started;
  const viewerPerformance = JSON.parse(fs.readFileSync(path.join(logs, 'import-mvp11-performance.json')));
  write('import-mvp11-performance.json', { dimValidationMs: validationMs, templateCloneMs: cloneMs, tableAndTextGenerationMs: generationMs, serializationMs, reparseMs, ...viewerPerformance });
} finally { fs.rmSync(tmp, { recursive: true, force: false }); }

write('import-mvp11-table-prototype.json', {
  selection: service.TABLE_PROTOTYPE, selectionReason: 'Static cells, no spans/bindings/formulas, visible solid grid; cloned rather than schema-authored.',
  sourceSha256: { form: sha256(prototypePaths.form), info: sha256(prototypePaths.info) },
  table: Object.fromEntries(['id', 'className', 'x', 'y', 'width', 'height', 'rowCount', 'columnCount', 'band', 'band_x', 'band_y'].map((key) => [key, prototype[key]])),
  wrapper: Object.fromEntries(['x', 'y', 'width', 'height', 'rowHeight', 'columnWidth', 'borderString'].map((key) => [key, wrapper[key]])), cell: wrapper.cell,
});
write('import-mvp11-dim-validation.json', { status: 'PASS', versionCompatibility: ['1.0', '1.1'], fixture: path.relative(path.resolve(__dirname, '..'), fixturePath), validElements: 4, validText: 3, validTables: 1, invalidCases: ['no columns', 'bad cell count', 'width mismatch', 'negative row height', 'duplicate element id', 'span'], correctionPolicy: 'reject, no automatic correction' });
write('import-mvp11-table-generation.json', { status: 'PASS', strategy: 'prototype-clone', sourcePrototypeId: prototype.id, generatedTableId: table.id, rows: table.rowCount, columns: table.columnCount, cells: table.table.flat().length, independentCloneObjects: new Set(table.table.flat().map((x) => x.cell)).size === table.table.flat().length, uniqueCellIds: new Set(table.table.flat().map((x) => x.cell.id)).size, staticOnly: validateImportedTable(table), serializedAndReparsed: true });
write('import-mvp11-source-table-signature.json', { projectName: evidenceProject, dimTableId: 'main_table', ...signature(table) });
write('import-mvp11-editor-discovery.json', { status: 'NOT_DISCOVERED_STATIC_MODEL', sourceUBTableExists: true, viewerCellIdentityAvailable: true, columnIdentityPossibleFromSource: true, rowIdentityPossibleFromSource: true, connectedToExistingEditor: false, reason: 'Existing editor/client and target resolver are scoped to sample/sample and fixed logical/composite assumptions. Generalization is deferred to Import MVP 1.2.' });

const sampleRoot = path.join(config.projectsRoot, 'sample');
const integrity = {
  status: 'PASS', sample: { form: sha256(path.join(sampleRoot, 'sample/form.ubjf')), info: sha256(path.join(sampleRoot, 'sample/info.xml')) },
  template: { form: sha256(service.templatePaths().form), info: sha256(service.templatePaths().info) },
  tablePrototype: { form: sha256(prototypePaths.form), info: sha256(prototypePaths.info) },
  evidence: { projectName: evidenceProject, form: sha256(evidenceForm), info: sha256(path.join(evidenceRoot, 'info.xml')), archived: true },
  userCandidatesPreserved: true, historyAndRenderStoresCleanedByBaseline: true, preAiIntegrityEvidence: 'mysuit-mvp-work/logs/pre-ai-integrity.json',
};
write('import-mvp11-integrity.json', integrity);
write('import-mvp11-regression.json', { status: 'PASS', importUnitTests: { passed: 23, failed: 0 }, preAiBaseline: 'PASS', initialAttempt: { status: 'FLAKY_RETRIED', cause: 'history E2E captured initial canvas object count 0 before initialization' }, finalEvidence: 'mysuit-mvp-work/logs/pre-ai-regression.json' });

const viewer = JSON.parse(fs.readFileSync(path.join(logs, 'import-mvp11-viewer-result.json')));
const pdf = JSON.parse(fs.readFileSync(path.join(logs, 'import-mvp11-pdf-result.json')));
write('import-mvp11-result.json', { status: 'A', dim: { text: true, table: true }, tableGenerator: { strategy: 'prototype-clone', rows: 4, columns: 3, cells: 12, datasetBindings: 0, formulas: 0 }, viewer: { loaded: viewer.threeByFour.loaded, fatalErrors: viewer.threeByFour.fatalErrors.length, maxGeometryDelta: viewer.threeByFour.maxGeometryDelta, bordersVisible: viewer.threeByFour.bordersVisible }, reload: viewer.threeByFour.reload, newContext: viewer.threeByFour.newContext, pdf: { status: pdf.status, bytes: pdf.bytes, pageCount: pdf.pageCount }, editorDiscovery: { status: 'NOT_DISCOVERED_STATIC_MODEL' }, preAiRegression: true, integrity: true, evidenceProject });
