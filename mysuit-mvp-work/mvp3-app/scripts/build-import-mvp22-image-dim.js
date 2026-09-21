const fs = require('fs');
const path = require('path');
const source = path.resolve(__dirname, '../samples/import/image-analysis-mvp21.freeze.dim.json');
const output = path.resolve(__dirname, '../samples/import/image-analysis-mvp22.dim.json');
const dim = JSON.parse(fs.readFileSync(source, 'utf8'));
dim.version = '1.2';
for (const element of dim.elements) {
  if (element.type === 'text') {
    element.style.verticalAlign = 'middle';
    element.style.textColor = element.id.endsWith('_label') || element.id === 'invoice_number' ? '#767676' : '#323232';
    element.style.backgroundColor = ['balance_label', 'balance_value'].includes(element.id) ? '#F5F5F5' : '#FFFFFF';
    continue;
  }
  element.rows.forEach((row, rowIndex) => row.cells.forEach((cell, columnIndex) => {
    const header = rowIndex === 0;
    cell.style = {
      fontSize: header ? 12 : 11,
      bold: header,
      textAlign: columnIndex === 0 ? 'left' : 'right',
      verticalAlign: header ? 'middle' : 'top',
      textColor: header ? '#FFFFFF' : '#3A3A3A',
      backgroundColor: header ? '#3A3A3A' : '#FFFFFF',
      border: {
        top: { visible: false }, right: { visible: false }, bottom: { visible: false }, left: { visible: false },
      },
    };
  }));
}
fs.writeFileSync(output, `${JSON.stringify(dim, null, 2)}\n`);
process.stdout.write(`${output}\n`);
