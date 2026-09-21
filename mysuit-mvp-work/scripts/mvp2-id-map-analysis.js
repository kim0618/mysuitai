const fs = require('fs');
const zlib = require('zlib');

const formPath = process.argv[2];
const runtimeObjectsPath = process.argv[3];
const outputPath = process.argv[4];
if (!formPath || !runtimeObjectsPath || !outputPath) throw new Error('usage: node mvp2-id-map-analysis.js <form> <runtime-objects.json> <output>');

const outer = JSON.parse(zlib.inflateSync(Buffer.from(fs.readFileSync(formPath, 'ascii').replace(/\s/g, ''), 'base64')).toString('utf8'));
const pages = outer.pages.map(JSON.parse);
const definitions = [];
function walk(value, location, seen) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (typeof value.id === 'string') definitions.push({ id: value.id, band: value.band || null, className: value.className || null, location });
  if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, `${location}/${index}`, seen));
  else Object.entries(value).forEach(([key, entry]) => walk(entry, `${location}/${key}`, seen));
}
pages.forEach((page, index) => walk(page, `pages/${index}`, new Set()));

const runtime = JSON.parse(fs.readFileSync(runtimeObjectsPath, 'utf8'));
function mapObject(object) {
  if (!object.id) return { viewerId: null, mapped: false };
  const matches = definitions.filter(def => object.id === def.id || object.id.startsWith(`${def.id}_`));
  matches.sort((a, b) => b.id.length - a.id.length);
  const source = matches[0] || null;
  if (!source) return { viewerId: object.id, className: object.className, mapped: false };
  const remainder = object.id.slice(source.id.length).replace(/^_/, '');
  const row = remainder.match(/(?:^|_)ROW(\d+)$/);
  const bandInViewer = source.band && remainder.includes(source.band) ? source.band : null;
  return {
    viewerId: object.id,
    className: object.className,
    sourceObjectId: source.id,
    sourceClassName: source.className,
    sourceLocation: source.location,
    declaredBandId: source.band,
    bandIdObservedInViewer: bandInViewer,
    rowIndex: row ? Number(row[1]) : null,
    mapped: true,
    mappingStrength: bandInViewer ? 'source+band+row' : 'source-prefix'
  };
}
const mapped = runtime.filter(object => object.id).map(mapObject);
const samples = mapped.filter(entry => entry.mapped).slice(0, 15);
const result = {
  formPath,
  runtimeObjectsPath,
  definitionCount: definitions.length,
  runtimeIdCount: mapped.length,
  mappedCount: mapped.filter(entry => entry.mapped).length,
  unmappedCount: mapped.filter(entry => !entry.mapped).length,
  strongMappedCount: mapped.filter(entry => entry.mappingStrength === 'source+band+row').length,
  samples
};
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
