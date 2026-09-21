const test = require('node:test');
const assert = require('node:assert/strict');
const { colorToInteger, borderString, applyCellStyle, applyTextStyle } = require('../src/server/import/import-style-mapper');

test('maps vendor-independent colors and text style to UBLabel properties', () => {
  const label = {};
  applyTextStyle(label, { fontSize: 14, bold: true, textAlign: 'right', verticalAlign: 'bottom', textColor: '#333333', backgroundColor: '#FFFFFF' });
  assert.deepEqual(label, { fontSize: 14, fontWeight: 'bold', textAlign: 'right', verticalAlign: 'bottom', fontColor: 3355443, backgroundColor: 16777215 });
  assert.equal(colorToInteger('#404040'), 4210752);
});

test('writes each border side independently using proven MySuit encoding', () => {
  const value = borderString({ top: { visible: true, color: '#AAAAAA', width: 2 }, right: { visible: false }, bottom: { visible: true, color: '#000000', width: 1 }, left: { visible: false } });
  assert.match(value, /type:borderTop,borderType:SOLD,borderColor:11184810,borderThickness:2/);
  assert.match(value, /type:borderRight,borderType:none,borderColor:0,borderThickness:1/);
  assert.match(value, /type:borderBottom,borderType:SOLD,borderColor:0,borderThickness:1/);
});

test('sanitizes prototype style and applies explicit cell style', () => {
  const wrapper = { borderString: 'prototype-red-grid' }, cell = { fontColor: 16777215, backgroundColor: 13172736 };
  applyCellStyle(wrapper, cell, { fontSize: 11, bold: false, textAlign: 'left', verticalAlign: 'top', textColor: '#222222', backgroundColor: '#FFFFFF', border: {} });
  assert.equal(cell.fontColor, 2236962);
  assert.equal(cell.backgroundColor, 16777215);
  assert.equal(cell.verticalAlign, 'top');
  assert.ok(!wrapper.borderString.includes('SOLD'));
});
