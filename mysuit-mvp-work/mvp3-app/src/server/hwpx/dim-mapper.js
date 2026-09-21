const { createPageConverter } = require('./unit-converter');
const { hwpxError } = require('./hwpx-errors');

const round = (value) => Math.round(value * 1000) / 1000;
function fit(value, min, max) { return Math.max(min, Math.min(max, value)); }
function geometry(item, converter, defaults) {
  // Existing UBTable parse-back validation uses exact arithmetic. Integer DIM
  // geometry avoids IEEE-754 accumulation differences in row/column totals.
  const x = fit(Math.round(converter.x(item.x || 0)), 0, converter.page.width - 1), y = fit(Math.round(converter.y(item.y || 0)), 0, converter.page.height - 1);
  const width = fit(Math.round(converter.x(item.width || defaults.width)), 1, converter.page.width - x), height = fit(Math.round(converter.y(item.height || defaults.height)), 1, converter.page.height - y);
  return { x, y, width, height };
}
function distribute(total, values) {
  const source = values.reduce((a, b) => a + b, 0), out = values.map((value) => Math.max(1, Math.round(total * value / source)));
  let delta = total - out.reduce((a, b) => a + b, 0);
  for (let i = out.length - 1; delta !== 0; i = (i - 1 + out.length) % out.length) { if (delta > 0) { out[i]++; delta--; } else if (out[i] > 1) { out[i]--; delta++; } }
  return out;
}
function textStyle(style = {}) { return { fontSize: fit(round(style.fontSize || 12), 1, 200), bold: Boolean(style.bold), textAlign: style.textAlign || 'left', ...(style.verticalAlign ? { verticalAlign: style.verticalAlign } : {}), ...(style.textColor ? { textColor: style.textColor } : {}), ...(style.backgroundColor ? { backgroundColor: style.backgroundColor } : {}) }; }
function cellStyle(style = {}) { return { ...textStyle(style), verticalAlign: style.verticalAlign || 'middle', ...(style.border ? { border: style.border } : {}) }; }

function semanticToDim(model) {
  try {
    const converter = createPageConverter(model.page), elements = [];
    for (const p of model.paragraphs) elements.push({ id: p.id, type: 'text', ...geometry(p, converter, { width: model.page.width, height: 1200 }), text: p.text, style: textStyle(p.style) });
    for (const table of model.tables) {
      const g = geometry(table, converter, { width: model.page.width, height: table.rowCount * 2400 });
      const columnWidths = distribute(g.width, table.colWidths), rowHeights = distribute(g.height, table.rowHeights);
      const columns = columnWidths.map((width, i) => ({ id: `c${i}`, width }));
      const rows = rowHeights.map((height, row) => ({ height, cells: table.cells.filter((cell) => cell.row === row).sort((a, b) => a.col - b.col).map((cell) => ({ id: cell.id, row: cell.row, col: cell.col, rowSpan: cell.rowSpan, colSpan: cell.colSpan, text: cell.text, style: cellStyle(cell.style) })) }));
      elements.push({ id: table.id, type: 'table', ...g, columns, rows });
    }
    for (const image of model.images) elements.push({ id: image.id, type: 'image', ...geometry(image, converter, { width: 7200, height: 9600 }), source: { kind: 'asset', ref: image.assetId }, fit: 'contain' });
    return { version: '1.3', page: converter.page, assets: model.assets.map(({ bytes, packagePath, ...asset }) => asset), elements };
  } catch (error) { if (error.code?.startsWith('HWPX_')) throw error; throw hwpxError('HWPX_DIM_MAPPING_FAILED', 'HWPX semantic model을 DIM 1.3으로 변환할 수 없습니다.', { cause: error.message }); }
}

module.exports = { semanticToDim, textStyle, cellStyle };
