#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { analyzeHwpx, importHwpx } = require('../src/server/hwpx/hwpx-import-service');

const input = process.argv[2], output = process.argv[3] || path.resolve(__dirname, '../output/hwpx-personnel-record');
if (!input) { console.error('Usage: node scripts/import-hwpx.js <input.hwpx> [output-prefix] [--project]'); process.exit(2); }
const result = process.argv.includes('--project') ? importHwpx(input) : analyzeHwpx(input); fs.mkdirSync(path.dirname(output), { recursive: true });
const semantic = JSON.parse(JSON.stringify(result.semantic, (key, value) => key === 'bytes' ? undefined : value));
for (const asset of result.semantic.assets) {
  const target = path.join(path.dirname(output), asset.relativePath);
  if (fs.existsSync(target)) {
    const existing = require('crypto').createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (existing !== asset.sha256) throw new Error(`Asset output collision: ${target}`);
  } else fs.writeFileSync(target, asset.bytes, { flag: 'wx' });
}
fs.writeFileSync(`${output}.semantic.json`, JSON.stringify(semantic, null, 2) + '\n'); fs.writeFileSync(`${output}.dim.json`, JSON.stringify(result.dim, null, 2) + '\n');
fs.writeFileSync(`${output}.assets.json`, JSON.stringify(result.dim.assets, null, 2) + '\n');
const inventory = semantic.tables.map((table) => ({ id: table.id, rows: table.rowCount, cols: table.colCount, logicalCellCount: table.cells.length, mergedMasterCount: table.cells.filter((cell) => cell.rowSpan > 1 || cell.colSpan > 1).length, textSummary: table.cells.map((cell) => cell.text).join(' ').slice(0, 200), geometry: { x: table.x, y: table.y, width: table.width, height: table.height } }));
console.log(JSON.stringify({ signatures: result.signatures, tables: inventory, images: semantic.images.length, project: result.project?.projectName || null }, null, 2));
