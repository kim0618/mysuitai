const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDim } = require('../src/server/import/dim-validator');

function valid() {
  return { version: '1.0', page: { width: 794, height: 1123 }, elements: [{ id: 'title', type: 'text', x: 10, y: 20, width: 100, height: 30, text: 'title', style: { fontSize: 16, bold: true, textAlign: 'center' } }] };
}

function code(expected, mutate) {
  const dim = valid(); mutate(dim);
  assert.throws(() => validateDim(dim), (error) => error.code === expected);
}

test('accepts a valid DIM v1 document', () => assert.deepEqual(validateDim(valid()), valid()));
test('rejects an invalid version', () => code('IMPORT_DIM_INVALID', (x) => { x.version = '2.0'; }));
test('rejects a duplicate element id', () => code('IMPORT_DIM_DUPLICATE_ID', (x) => { x.elements.push({ ...x.elements[0] }); }));
test('rejects a negative width', () => code('IMPORT_DIM_INVALID', (x) => { x.elements[0].width = -1; }));
test('rejects an unsupported element', () => code('IMPORT_DIM_UNSUPPORTED_ELEMENT', (x) => { x.elements[0].type = 'image'; }));
test('rejects partial page overflow', () => code('IMPORT_DIM_OUT_OF_PAGE', (x) => { x.elements[0].x = 750; }));
test('rejects an invalid alignment', () => code('IMPORT_DIM_INVALID_STYLE', (x) => { x.elements[0].style.textAlign = 'justify'; }));

function tableDim() {
  return { version: '1.1', page: { width: 794, height: 1123 }, elements: [{
    id: 'table', type: 'table', x: 10, y: 20, width: 100, height: 40,
    columns: [{ id: 'a', width: 50 }, { id: 'b', width: 50 }],
    rows: [{ height: 20, cells: [{ text: 'a' }, { text: 'b' }] }, { height: 20, cells: [{ text: 'c' }, { text: 'd' }] }],
  }] };
}
test('accepts a valid DIM v1.1 table', () => assert.deepEqual(validateDim(tableDim()), tableDim()));
test('keeps DIM v1.0 text-only compatibility', () => assert.deepEqual(validateDim(valid()), valid()));
test('rejects table width mismatch', () => { const dim = tableDim(); dim.elements[0].columns[0].width = 49; assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_TABLE_WIDTH_MISMATCH'); });
test('rejects table cell count mismatch', () => { const dim = tableDim(); dim.elements[0].rows[0].cells.pop(); assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_TABLE_CELL_COUNT_MISMATCH'); });
test('rejects table spans', () => { const dim = tableDim(); dim.elements[0].rows[0].cells[0].rowSpan = 2; assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_TABLE_UNSUPPORTED_SPAN'); });
test('rejects a table with no columns', () => { const dim = tableDim(); dim.elements[0].columns = []; assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_TABLE_COLUMN_COUNT_MISMATCH'); });
test('rejects a negative row height', () => { const dim = tableDim(); dim.elements[0].rows[0].height = -1; assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_TABLE_INVALID'); });
test('rejects duplicate table element IDs', () => { const dim = tableDim(); dim.elements.push(structuredClone(dim.elements[0])); assert.throws(() => validateDim(dim), (e) => e.code === 'IMPORT_DIM_DUPLICATE_ID'); });

test('accepts DIM v1.2 text and per-cell style', () => {
  const dim = tableDim(); dim.version = '1.2';
  dim.elements[0].rows[0].cells[0].style = { fontSize: 12, bold: true, textAlign: 'left', verticalAlign: 'middle', textColor: '#ffffff', backgroundColor: '#404040', border: { bottom: { visible: true, color: '#AAAAAA', width: 2 }, top: { visible: false } } };
  const value = validateDim(dim);
  assert.equal(value.elements[0].rows[0].cells[0].style.textColor, '#FFFFFF');
});
test('rejects invalid v1.2 color', () => { const dim=tableDim();dim.version='1.2';dim.elements[0].rows[0].cells[0].style={textColor:'white'};assert.throws(()=>validateDim(dim),(e)=>e.code==='IMPORT_DIM_INVALID_COLOR') });
test('rejects invalid v1.2 vertical alignment', () => { const dim=tableDim();dim.version='1.2';dim.elements[0].rows[0].cells[0].style={verticalAlign:'center'};assert.throws(()=>validateDim(dim),(e)=>e.code==='IMPORT_DIM_INVALID_VERTICAL_ALIGN') });
test('rejects unsupported border width', () => { const dim=tableDim();dim.version='1.2';dim.elements[0].rows[0].cells[0].style={border:{top:{visible:true,width:3}}};assert.throws(()=>validateDim(dim),(e)=>e.code==='IMPORT_DIM_UNSUPPORTED_BORDER_STYLE') });
