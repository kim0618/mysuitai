const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const { readHwpxPackage } = require('../src/server/hwpx/package-reader');
const { analyzeHwpx, importHwpx, signature } = require('../src/server/hwpx/hwpx-import-service');
const projectService = require('../src/server/import/import-project-service');
const { readForm } = require('../src/server/services/form-patch-service');
const { parseXml } = require('../src/server/hwpx/xml');
const { StyleResolver } = require('../src/server/hwpx/style-resolver');

function zip(entries) {
  const local = [], central = []; let offset = 0;
  for (const [name, raw] of Object.entries(entries)) {
    const n = Buffer.from(name), data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw), lh = Buffer.alloc(30), ch = Buffer.alloc(46);
    lh.writeUInt32LE(0x04034b50); lh.writeUInt16LE(20, 4); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(n.length, 26);
    ch.writeUInt32LE(0x02014b50); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(offset, 42);
    local.push(lh, n, data); central.push(ch, n); offset += lh.length + n.length + data.length;
  }
  const centralSize = central.reduce((n, b) => n + b.length, 0), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
const header = `<?xml version="1.0"?><hh:head xmlns:hh="urn:head"><hh:charProperties><hh:charPr id="1" height="1800" textColor="112233"><hh:bold/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="2"><hh:align horizontal="CENTER"/></hh:paraPr></hh:paraProperties><hh:borderFills><hh:borderFill id="3"><hh:left type="SOLID" color="000000"/><hh:right type="SOLID" color="000000"/><hh:top type="SOLID" color="000000"/><hh:bottom type="SOLID" color="000000"/><hh:fillBrush><hh:winBrush faceColor="EEEEEE"/></hh:fillBrush></hh:borderFill></hh:borderFills></hh:head>`;
const table = (id) => `<p:tbl id="${id}" rowCnt="2" colCnt="2"><p:sz width="20000" height="8000"/><p:tr><p:tc borderFillIDRef="3"><p:cellAddr colAddr="0" rowAddr="0"/><p:cellSpan colSpan="2" rowSpan="2"/><p:cellSz width="20000" height="8000"/><p:subList vertAlign="CENTER"><p:p paraPrIDRef="2"><p:run charPrIDRef="1"><p:t>병합 ${id}</p:t></p:run></p:p></p:subList></p:tc></p:tr></p:tbl>`;
const section = `<?xml version="1.0"?><p:sec xmlns:p="urn:section" xmlns:c="urn:core"><p:pagePr width="59528" height="84188"/><p:p paraPrIDRef="2"><p:run charPrIDRef="1"><p:t>인사기록부</p:t></p:run></p:p>${table('a')}${table('b')}<p:pic><p:offset x="1000" y="2000"/><p:orgSz width="3000" height="4000"/><c:img binaryItemIDRef="img1"/></p:pic></p:sec>`;
const manifest = `<opf:package xmlns:opf="urn:opf"><opf:manifest><opf:item id="img1" href="BinData/image1.gif" media-type="image/gif"/></opf:manifest></opf:package>`;
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');
function fixture(overrides = {}) { return zip({ mimetype: 'application/hwp+zip', 'version.xml': '<v:version xmlns:v="urn:v"/>', 'Contents/header.xml': header, 'Contents/content.hpf': manifest, 'Contents/section0.xml': section, 'Contents/BinData/image1.gif': GIF, ...overrides }); }

test('package reader validates signature, required parts and prefix-independent XML', () => { const pkg = readHwpxPackage(fixture()); assert.equal(pkg.sections.length, 1); assert.equal(pkg.mimeType, 'application/hwp+zip'); assert.throws(() => readHwpxPackage(Buffer.from('bad')), (e) => e.code === 'HWPX_PACKAGE_INVALID'); const entries = { mimetype: 'application/hwp+zip', 'version.xml': '<v/>', 'Contents/content.hpf': '<p/>', 'Contents/section0.xml': '<s/>' }; assert.throws(() => readHwpxPackage(zip(entries)), (e) => e.code === 'HWPX_REQUIRED_PART_MISSING'); });
test('malformed XML is rejected with stable error', () => { assert.throws(() => readHwpxPackage(fixture({ 'Contents/header.xml': '<a><b></a>' })), (e) => e.code === 'HWPX_XML_PARSE_FAILED'); });
test('style resolver maps font, bold, alignment, border and background', () => { const style = new StyleResolver(parseXml(header)).resolve('1', '2', '3', 'CENTER'); assert.equal(style.fontSize, 18); assert.equal(style.bold, true); assert.equal(style.textAlign, 'center'); assert.equal(style.verticalAlign, 'middle'); assert.equal(style.backgroundColor, '#EEEEEE'); assert.equal(style.border.left.visible, true); });
test('semantic parser and mapper preserve tables, compound merges, image and deterministic signatures', () => { const runs = [analyzeHwpx(fixture()), analyzeHwpx(fixture()), analyzeHwpx(fixture())]; assert.equal(runs[0].semantic.tables.length, 2); assert.equal(runs[0].semantic.tables[0].cells[0].rowSpan, 2); assert.equal(runs[0].dim.elements.filter((e) => e.type === 'table').length, 2); assert.equal(runs[0].dim.elements.filter((e) => e.type === 'image').length, 1); assert.equal(runs[0].dim.assets[0].sha256.length, 64); assert.deepEqual(runs.map((r) => r.signatures), [runs[0].signatures, runs[0].signatures, runs[0].signatures]); assert.equal(signature(runs[0].dim), runs[0].signatures.dim); });
test('missing image binary fails closed', () => { const entries = { mimetype: 'application/hwp+zip', 'version.xml': '<v/>', 'Contents/header.xml': header, 'Contents/content.hpf': manifest, 'Contents/section0.xml': section }; assert.throws(() => analyzeHwpx(zip(entries)), (e) => e.code === 'HWPX_ASSET_NOT_FOUND'); });
test('HWPX flows through the existing project generator without HWPX-specific UBJF generation', () => { const result = importHwpx(fixture()); try { const form = readForm(result.project.formPath), items = form.pages[0].items; assert.equal(items.filter((x) => x.className === 'UBTable').length, 2); assert.equal(items.filter((x) => x.className === 'UBImage').length, 1); assert.equal(items.filter((x) => x.className === 'UBLabel').length, 1); assert.equal(result.project.sourceType, 'HWPX'); } finally { projectService.removeImportedProject(result.project.projectName); } });
