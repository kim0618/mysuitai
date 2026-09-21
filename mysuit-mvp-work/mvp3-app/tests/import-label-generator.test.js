const test = require('node:test');
const assert = require('node:assert/strict');
const { createIdContext, createImportedLabel } = require('../src/server/import/import-label-generator');

const prototype = { id: 'LB8872', className: 'UBLabel', band: '', x: 1, y: 2, width: 3, height: 4, text: 'old', fontSize: 32, fontWeight: 'bold', textAlign: 'center', dataSet: '', column: '', systemFunction: '', fontFamily: '굴림', borderSide: ['none'] };
const element = { id: 'title', type: 'text', x: 10, y: 20, width: 300, height: 40, text: '월간 보고서', style: { fontSize: 20, bold: false, textAlign: 'left' } };

test('clones a prototype into a static imported label', () => {
  const label = createImportedLabel({ prototype, element, idContext: createIdContext(new Set(['IMPLB0001'])) });
  assert.notEqual(label, prototype);
  assert.equal(label.id, 'IMPLB0002');
  assert.equal(decodeURIComponent(label.text), element.text);
  assert.deepEqual([label.x, label.y, label.width, label.height], [10, 20, 300, 40]);
  assert.deepEqual([label.fontSize, label.fontWeight, label.textAlign], [20, 'normal', 'left']);
  assert.deepEqual([label.dataSet, label.column, label.systemFunction], ['', '', '']);
  assert.equal(prototype.text, 'old');
});

test('rejects a bound prototype', () => assert.throws(() => createImportedLabel({ prototype: { ...prototype, dataSet: 'dataset_0' }, element, idContext: createIdContext() }), (error) => error.code === 'IMPORT_TEMPLATE_INVALID'));
