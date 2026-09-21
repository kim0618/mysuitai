const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const adapter = require('../src/server/services/static-table-structure-adapter');
const { readForm } = require('../src/server/services/form-patch-service');
const images = require('../src/server/services/image-asset-service');
const mapper = require('../src/server/utils/property-mapper');
const { validatePatch } = require('../src/server/schemas/patch-schema');
const registry = require('../src/server/services/operation-registry');

// Read-only HWPX import fixture (인사기록부): 8 static tables with vertical/horizontal merges and one UBImage.
const SOURCE = path.join(__dirname, '../samples/editing-v2/hwpx-personnel.form.ubjf');
const table = id => readForm(SOURCE).pages[0].items.find(item => item.id === id);
const firstIds = t => t.table.map(row => row.find(w => w.cell)?.cell.id);
function candidate() { const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'editing-v2-')), 'form.ubjf'); fs.copyFileSync(SOURCE, file); return file; }
const apply = (sourceTableId, operations) => { const file = candidate(); const result = adapter.apply({ sourceFormPath: SOURCE, candidateFormPath: file, sourceTableId, operations }); return { result, table: readForm(file).pages[0].items.find(item => item.id === sourceTableId) }; };

test('layout without operations reproduces the imported geometry exactly', () => {
  for (const item of readForm(SOURCE).pages[0].items.filter(x => x.className === 'UBTable')) {
    const layout = adapter.layout(item, []), cells = new Map(item.table.flat().filter(w => w.cell).map(w => [w.cell.id, w]));
    for (const c of layout.cells) { const w = cells.get(c.id); assert.deepEqual([c.x, c.y, c.width, c.height], [w.x, w.y, w.width, w.height], `${item.id}:${c.id}`); }
  }
});

test('moveRow keeps cell identity and moves by stable base row index', () => {
  const before = firstIds(table('IMPTB0003')), { table: moved, result } = apply('IMPTB0003', [{ operation: 'moveRow', rowIndex: 2, toRowIndex: 3 }, { operation: 'moveRow', rowIndex: 2, toRowIndex: 4 }]);
  assert.deepEqual(firstIds(moved), [before[0], before[1], before[3], before[4], before[2], before[5]]);
  assert.deepEqual(result.signature.cellIds, result.originalSignature.cellIds);
  assert.equal(moved.height, table('IMPTB0003').height);
});

test('removeRow drops exactly that row and keeps geometry consistent', () => {
  const { table: t, result } = apply('IMPTB0004', [{ operation: 'removeRow', rowIndex: 3 }]);
  assert.equal(t.rowCount, 5); assert.equal(t.table.length, 5); assert.equal(result.removedCellIds.length, 3);
  assert.equal(t.height, table('IMPTB0004').height - table('IMPTB0004').table[3][0].rowHeight);
  t.table.forEach((row, r) => assert.equal(row[0].y, t.table.slice(0, r).reduce((n, x) => n + x[0].rowHeight, 0)));
});

test('row operations crossing a vertical merge fail closed', () => {
  // IMPTB0002 rows 1..4 are covered by vertical merges; moving the title row into them would split a merge.
  assert.throws(() => apply('IMPTB0002', [{ operation: 'moveRow', rowIndex: 0, toRowIndex: 1 }]), { code: 'ROWSPAN_DEPENDENCY' });
  // IMPTB0001 row 0 starts four-row merges: it can neither be hidden nor deleted.
  assert.throws(() => apply('IMPTB0001', [{ operation: 'removeRow', rowIndex: 0 }]), { code: 'ROWSPAN_DEPENDENCY' });
  assert.throws(() => apply('IMPTB0001', [{ operation: 'hideRow', rowIndex: 0 }]), { code: 'ROWSPAN_DEPENDENCY' });
});

test('permutations inside a merge keep the anchor at the block origin', () => {
  // Rows 1..3 of IMPTB0001 lie inside the logo/title merges that start on row 0.
  const { table: t } = apply('IMPTB0001', [{ operation: 'moveRow', rowIndex: 1, toRowIndex: 3 }]);
  const anchor = t.table[0][0];
  assert.equal(anchor.cell.id, 'IMPCL0001'); assert.equal(anchor.height, t.height);
  // Removing a covered row shrinks the merge instead of orphaning it.
  const { table: shrunk } = apply('IMPTB0001', [{ operation: 'removeRow', rowIndex: 3 }]);
  assert.equal(shrunk.table[0][0].rowSpan, 3); assert.equal(shrunk.table[0][0].cell.rowSpan, 3); assert.equal(shrunk.table[0][0].height, shrunk.height);
});

test('moveColumn under a full-width title merge is allowed and resize follows the base column', () => {
  const { table: t } = apply('IMPTB0003', [{ operation: 'moveColumn', columnIndex: 1, toVisualIndex: 2 }, { operation: 'resizeColumn', columnIndex: 1, afterWidth: 150 }]);
  assert.equal(t.table[0][0].cell.id, 'IMPCL0070'); assert.equal(t.table[0][0].cell.colSpan, 6);
  assert.equal(t.table[1][2].cell.id, 'IMPCL0072'); assert.equal(t.table[1][2].width, 150);
  assert.equal(t.table[0][0].width, t.width);
});

test('bound rows cannot be removed', () => {
  const file = candidate(), parsed = readForm(file), t = parsed.pages[0].items.find(x => x.id === 'IMPTB0004');
  Object.assign(t.table[3][0].cell, { dataType: '1', dataSet: 'ai_input', column: 'name' });
  const { writeForm } = require('../src/server/services/form-patch-service'), sourceCopy = candidate(); writeForm(sourceCopy, parsed); writeForm(file, parsed);
  assert.throws(() => adapter.apply({ sourceFormPath: sourceCopy, candidateFormPath: file, sourceTableId: 'IMPTB0004', operations: [{ operation: 'removeRow', rowIndex: 3 }] }), { code: 'BOUND_ROW_REMOVE_REJECTED' });
});

test('image source adapter exposes size, position, fit and replace', () => {
  const image = readForm(SOURCE).pages[0].items.find(x => x.className === 'UBImage');
  const support = mapper.supportedProperties({ item: image }, '');
  assert.deepEqual(support.properties, ['visible', 'width', 'height', 'left', 'top', 'scaleType', 'data']);
  assert.match(mapper.sourceValue(image, 'data'), /^inline:[a-f0-9]{64}$/);
  assert.equal(mapper.sourceValue(image, 'scaleType'), 0);
  assert.throws(() => mapper.validateValue('scaleType', 2), { code: 'INVALID_PROPERTY_VALUE' });
  const body = { viewerObjectId: 'IMPIMG0001', sourceObjectId: 'IMPIMG0001', bandId: '', rowIndex: 0, className: 'UBImage', scope: 'SOURCE_OBJECT_ALL_INSTANCES', operation: 'updateProperty', viewerProperty: 'left', sourceProperty: 'x', before: 36, after: 120 };
  assert.equal(validatePatch(body).className, 'UBImage');
  assert.throws(() => validatePatch({ ...body, viewerProperty: 'fontSize', sourceProperty: 'fontSize', before: 12, after: 14 }), { code: 'UNSUPPORTED_PROPERTY' });
  assert.ok(['moveObject', 'setImageFit', 'replaceImage', 'moveRow', 'removeRow'].every(op => registry.get(op)?.support.source));
});

test('table cells and band labels do not expose free positioning', () => {
  const cell = readForm(SOURCE).pages[0].items.find(x => x.id === 'IMPTB0003').table[1][0].cell;
  assert.equal(mapper.supportedProperties({ item: cell }, '').properties.includes('left'), false);
});

test('image assets are validated and content addressed', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
  const stored = images.store({ base64: png.toString('base64') });
  assert.match(stored.ref, /^asset:[a-f0-9]{64}$/); assert.equal(stored.mime, 'image/png');
  assert.deepEqual(images.read(stored.ref.slice(6)).bytes, png);
  assert.equal(images.store({ base64: png.toString('base64') }).ref, stored.ref);
  assert.equal(images.resolve(stored.ref, 'x'), encodeURIComponent(png.toString('base64')));
  assert.throws(() => images.store({ base64: Buffer.from('not an image').toString('base64') }), { code: 'INVALID_IMAGE' });
  assert.throws(() => images.store({ base64: Buffer.alloc(images.MAX_BYTES + 1, 0x89).toString('base64') }), { code: 'INVALID_IMAGE' });
  assert.throws(() => images.assertUsable(`asset:${'0'.repeat(64)}`), { code: 'IMAGE_ASSET_NOT_FOUND' });
  // Restoring the original is only possible while the source still holds that exact payload.
  assert.equal(images.resolve(images.inlineRef('abc'), 'abc'), 'abc');
  assert.throws(() => images.resolve(images.inlineRef('abc'), 'changed'), { code: 'FINAL_SOURCE_INVALID' });
});
