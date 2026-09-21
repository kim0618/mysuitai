const path = require('path');
const { readZip } = require('./zip-package');
const { parseXml } = require('./xml');
const { hwpxError } = require('./hwpx-errors');

const REQUIRED = ['mimetype', 'version.xml', 'Contents/header.xml', 'Contents/content.hpf'];
function naturalSection(a, b) { return Number(a.match(/section(\d+)/i)?.[1] || 0) - Number(b.match(/section(\d+)/i)?.[1] || 0); }
function readHwpxPackage(input) {
  const entries = readZip(input);
  for (const part of REQUIRED) if (!entries.has(part)) throw hwpxError('HWPX_REQUIRED_PART_MISSING', `필수 HWPX part가 없습니다: ${part}`, { part });
  const mime = entries.get('mimetype').toString('utf8').trim();
  if (mime !== 'application/hwp+zip') throw hwpxError('HWPX_PACKAGE_INVALID', 'HWPX mimetype이 올바르지 않습니다.', { actual: mime });
  const sections = [...entries.keys()].filter((name) => /^Contents\/section\d+\.xml$/i.test(name)).sort(naturalSection);
  if (!sections.length) throw hwpxError('HWPX_REQUIRED_PART_MISSING', 'HWPX section이 없습니다.', { part: 'Contents/section*.xml' });
  const xml = new Map();
  for (const name of ['Contents/header.xml', 'Contents/content.hpf', ...sections, ...[...entries.keys()].filter((x) => /(?:^|\/)settings\.xml$/i.test(x))]) xml.set(name, parseXml(entries.get(name).toString('utf8'), name));
  return { entries, xml, sections, header: xml.get('Contents/header.xml'), manifest: xml.get('Contents/content.hpf'), mimeType: mime, fileName: Buffer.isBuffer(input) ? null : path.basename(input) };
}

module.exports = { REQUIRED, readHwpxPackage };
