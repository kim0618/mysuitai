const crypto = require('crypto');
const path = require('path');
const { descendants, first, textContent, attr } = require('./xml');
const { StyleResolver } = require('./style-resolver');
const { hwpxError } = require('./hwpx-errors');

const num = (node, name, fallback = 0) => { const value = Number(attr(node, name)); return Number.isFinite(value) ? value : fallback; };
const directText = (node) => descendants(node, 't').map(textContent).join('').replace(/\r/g, '');
function paragraphText(node) { let out = ''; function visit(value) { for (const child of value?.children || []) { if (['tbl', 'pic'].includes(child.local)) continue; if (child.local === 't') out += textContent(child); else visit(child); } } visit(node); return out.replace(/\r/g, ''); }
const idSafe = (value) => String(value ?? '').replace(/[^A-Za-z0-9_-]/g, '_');
function dimensions(node) { const size = first(node, 'sz') || first(node, 'orgSz') || first(node, 'curSz') || first(node, 'cellSz'); return { width: num(size, 'width'), height: num(size, 'height') }; }
function position(node) { const pos = first(node, 'pos') || first(node, 'offset'); return { x: num(pos, 'x'), y: num(pos, 'y') }; }
function solveColumns(count, constraints, total) {
  const matrix = Array.from({ length: count }, () => Array(count + 1).fill(0)), prior = total / count;
  for (const { col, span, width } of constraints) for (let i = col; i < col + span; i++) { for (let j = col; j < col + span; j++) matrix[i][j] += 1; matrix[i][count] += width; }
  // A strong table-width equation stabilizes underdetermined HWP logical grids.
  for (let i = 0; i < count; i++) { for (let j = 0; j < count; j++) matrix[i][j] += 10; matrix[i][count] += 10 * total; matrix[i][i] += 1e-6; matrix[i][count] += 1e-6 * prior; }
  for (let col = 0; col < count; col++) { let pivot = col; for (let row = col + 1; row < count; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row; [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]]; const divisor = matrix[col][col]; if (Math.abs(divisor) < 1e-10) continue; for (let j = col; j <= count; j++) matrix[col][j] /= divisor; for (let row = 0; row < count; row++) if (row !== col) { const factor = matrix[row][col]; for (let j = col; j <= count; j++) matrix[row][j] -= factor * matrix[col][j]; } }
  const solved = matrix.map((row) => row[count]), usable = solved.every((value) => Number.isFinite(value) && value > 0);
  if (!usable) return Array(count).fill(prior); const scale = total / solved.reduce((a, b) => a + b, 0); return solved.map((value) => value * scale);
}

function manifestItems(pkg) {
  const map = new Map();
  for (const node of descendants(pkg.manifest, 'item')) {
    const id = attr(node, 'id'), href = attr(node, 'href'); if (id && href) map.set(String(id), { href: href.replace(/^\.\//, ''), mediaType: attr(node, 'media-type', attr(node, 'mediaType')) });
  }
  return map;
}
function resolveAsset(pkg, ref, manifest) {
  const item = manifest.get(String(ref)); let name = item?.href || String(ref || '');
  const candidates = [name, `Contents/${name}`, `BinData/${name}`, `Contents/BinData/${name}`].map((x) => x.replace(/\\/g, '/'));
  const entry = candidates.find((x) => pkg.entries.has(x)) || [...pkg.entries.keys()].find((x) => path.basename(x) === path.basename(name));
  if (!entry) throw hwpxError('HWPX_ASSET_NOT_FOUND', 'HWPX image binary를 찾을 수 없습니다.', { reference: ref, href: name });
  const bytes = pkg.entries.get(entry), ext = path.extname(entry).toLowerCase(), mimeType = item?.mediaType || ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif' }[ext]);
  if (!mimeType || !['image/png', 'image/jpeg', 'image/gif'].includes(mimeType)) throw hwpxError('HWPX_ASSET_INVALID', '지원하지 않는 HWPX image 형식입니다.', { entry, mimeType });
  return { id: `asset_${idSafe(ref || path.basename(entry, ext))}`, fileName: path.basename(entry), mimeType, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), size: bytes.length, relativePath: path.basename(entry), packagePath: entry, bytes };
}

function parseParagraph(node, styles, index, flowY) {
  const runs = descendants(node, 'run').filter((run) => paragraphText(run).trim()), text = paragraphText(node); if (!text.trim()) return null;
  const representative = runs[0], charId = attr(representative, 'charPrIDRef', attr(node, 'charPrIDRef')), paraId = attr(node, 'paraPrIDRef');
  const pos = position(node), size = dimensions(node), style = styles.resolve(charId, paraId);
  if (new Set(runs.map((run) => attr(run, 'charPrIDRef')).filter(Boolean)).size > 1) styles.fidelity.push({ object: `paragraph_${index}`, status: 'PARTIAL', reason: 'MULTIPLE_TEXT_RUN_STYLES_REPRESENTATIVE_USED' });
  return { id: `paragraph_${index}`, text, x: pos.x, y: pos.y || flowY, width: size.width, height: size.height || Math.max(900, style.fontSize * 100), style };
}

function parseTable(node, styles, index, flowY) {
  try {
    const rowCount = num(node, 'rowCnt'), colCount = num(node, 'colCnt'); if (!(rowCount > 0 && colCount > 0)) throw new Error('invalid rowCnt/colCnt');
    const pos = position(node), declared = dimensions(node), rowHeights = Array(rowCount).fill(0), colWidths = Array(colCount).fill(0), columnConstraints = [], cells = [];
    for (const tc of descendants(node, 'tc')) {
      const address = first(tc, 'cellAddr'), span = first(tc, 'cellSpan'), size = first(tc, 'cellSz');
      const row = num(address, 'rowAddr', num(tc, 'rowAddr', -1)), col = num(address, 'colAddr', num(tc, 'colAddr', -1)), rowSpan = num(span, 'rowSpan', 1), colSpan = num(span, 'colSpan', 1);
      if (row < 0 || col < 0 || row + rowSpan > rowCount || col + colSpan > colCount || rowSpan < 1 || colSpan < 1) throw hwpxError('HWPX_CELL_GEOMETRY_INVALID', 'HWPX cell span이 grid를 벗어났습니다.', { table: index, row, col, rowSpan, colSpan });
      const width = num(size, 'width'), height = num(size, 'height');
      // Some producers serialize a negative signed HWPUNIT cell height as uint32
      // (for example -1282 becomes 4294966014). It cannot be real geometry and
      // must not dominate row inference; sibling cells or the table box recover it.
      const saneWidth = width > 0 && (!declared.width || width <= declared.width) ? width : 0;
      const saneHeight = height > 0 && (!declared.height || height <= declared.height) ? height : 0;
      for (let c = col; c < col + colSpan; c++) if (saneWidth) colWidths[c] = Math.max(colWidths[c], saneWidth / colSpan); for (let r = row; r < row + rowSpan; r++) if (saneHeight) rowHeights[r] = Math.max(rowHeights[r], saneHeight / rowSpan);
      if (saneWidth) columnConstraints.push({ col, span: colSpan, width: saneWidth });
      const p = first(tc, 'p'), run = p && descendants(p, 'run').find((x) => directText(x).trim()), subList = first(tc, 'subList');
      cells.push({ id: `table_${index}_cell_${row}_${col}`, row, col, rowSpan, colSpan, text: directText(tc), style: styles.resolve(attr(run, 'charPrIDRef'), attr(p, 'paraPrIDRef'), attr(tc, 'borderFillIDRef'), attr(subList, 'vertAlign')) });
    }
    if (!cells.length) throw new Error('table has no cells');
    const fallbackWidth = (declared.width || 45000) / colCount, fallbackHeight = (declared.height || rowCount * 2400) / rowCount;
    for (let i = 0; i < colCount; i++) if (!(colWidths[i] > 0)) colWidths[i] = fallbackWidth; for (let i = 0; i < rowCount; i++) if (!(rowHeights[i] > 0)) rowHeights[i] = fallbackHeight;
    if (declared.width > 0 && columnConstraints.length) colWidths.splice(0, colWidths.length, ...solveColumns(colCount, columnConstraints, declared.width));
    return { id: `table_${index}`, rowCount, colCount, x: pos.x, y: pos.y || flowY, width: declared.width || colWidths.reduce((a, b) => a + b, 0), height: declared.height || rowHeights.reduce((a, b) => a + b, 0), colWidths, rowHeights, cells };
  } catch (error) { if (error.code?.startsWith('HWPX_')) throw error; throw hwpxError('HWPX_TABLE_PARSE_FAILED', 'HWPX table을 파싱할 수 없습니다.', { table: index, cause: error.message }); }
}

function parseHwpxSemantic(pkg) {
  const styles = new StyleResolver(pkg.header), manifest = manifestItems(pkg), pageNode = pkg.sections.map((name) => first(pkg.xml.get(name), 'pagePr')).find(Boolean);
  const pageSize = pageNode && (first(pageNode, 'pageSz') || pageNode), page = { width: num(pageSize, 'width', 59528), height: num(pageSize, 'height', 84188) };
  const paragraphs = [], tables = [], images = [], assets = [], tableMap = new Map(); const assetIds = new Set(); let flowY = 1800;
  for (const sectionName of pkg.sections) {
    const section = pkg.xml.get(sectionName), tableNodes = descendants(section, 'tbl'), nestedP = new Set(tableNodes.flatMap((table) => descendants(table, 'p')));
    for (const p of descendants(section, 'p')) if (!nestedP.has(p)) { const value = parseParagraph(p, styles, paragraphs.length, flowY); if (value) { paragraphs.push(value); flowY = Math.max(flowY, value.y + value.height + 300); } }
    for (const table of tableNodes) { const value = parseTable(table, styles, tables.length, flowY); tables.push(value); tableMap.set(table, value); flowY = Math.max(flowY, value.y + value.height + 500); }
    for (const pic of descendants(section, 'pic')) {
      const imageNode = first(pic, 'img'), ref = attr(imageNode, 'binaryItemIDRef', attr(pic, 'binaryItemIDRef')); if (!ref) { styles.fidelity.push({ object: `image_${images.length}`, status: 'UNSUPPORTED', reason: 'IMAGE_REFERENCE_MISSING' }); continue; }
      const asset = resolveAsset(pkg, ref, manifest); if (!assetIds.has(asset.id)) { assets.push(asset); assetIds.add(asset.id); }
      const pos = position(pic), size = dimensions(pic); let x = pos.x, y = pos.y || flowY;
      const ownerNode = tableNodes.find((table) => descendants(table, 'pic').includes(pic)), owner = tableMap.get(ownerNode);
      if (owner) { const tc = descendants(ownerNode, 'tc').find((cell) => descendants(cell, 'pic').includes(pic)), address = first(tc, 'cellAddr'), span = first(tc, 'cellSpan'), col = num(address, 'colAddr'), row = num(address, 'rowAddr'), colSpan = num(span, 'colSpan', 1), rowSpan = num(span, 'rowSpan', 1), boxWidth = owner.colWidths.slice(col, col + colSpan).reduce((a, b) => a + b, 0), boxHeight = owner.rowHeights.slice(row, row + rowSpan).reduce((a, b) => a + b, 0); x = owner.x + owner.colWidths.slice(0, col).reduce((a, b) => a + b, 0) + Math.max(0, (boxWidth - size.width) / 2) + pos.x; y = owner.y + owner.rowHeights.slice(0, row).reduce((a, b) => a + b, 0) + Math.max(0, (boxHeight - size.height) / 2) + pos.y; }
      images.push({ id: `image_${images.length}`, assetId: asset.id, x, y, width: size.width || 7200, height: size.height || 9600 });
    }
    const unsupported = ['chart', 'ole', 'video', 'audio'].flatMap((kind) => descendants(section, kind).map(() => kind)); for (const kind of unsupported) styles.fidelity.push({ object: kind, status: 'IGNORED_SAFE', reason: 'UNSUPPORTED_OBJECT' });
  }
  return { version: 'HWPX_SEMANTIC_0.1', page, paragraphs, tables, images, styles: { fidelity: styles.fidelity }, assets };
}

module.exports = { parseHwpxSemantic, parseTable, parseParagraph, manifestItems, resolveAsset };
