const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

function fail(message) { throw new Error(message); }
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
function readForm(file) {
  const encoded = fs.readFileSync(file, 'ascii').replace(/\s/g, '');
  const compressed = Buffer.from(encoded, 'base64');
  const decoded = zlib.inflateSync(compressed).toString('utf8');
  const root = JSON.parse(decoded);
  if (!Array.isArray(root.pages)) fail('form root.pages is not an array');
  const pages = root.pages.map((entry, index) => {
    if (typeof entry !== 'string') fail(`root.pages[${index}] is not a JSON string`);
    return JSON.parse(entry);
  });
  return { root, pages, encoded, compressed, decoded };
}
function writeForm(file, parsed) {
  const outputRoot = { ...parsed.root, pages: parsed.pages.map(page => JSON.stringify(page)) };
  const compressed = zlib.deflateSync(Buffer.from(JSON.stringify(outputRoot), 'utf8'));
  const base64 = compressed.toString('base64');
  const wrapped = base64.match(/.{1,76}/g).join('\r\n') + '\r\n';
  fs.writeFileSync(file, wrapped, 'ascii');
}
function findObjects(pages, objectId) {
  const found = [];
  pages.forEach((page, pageIndex) => {
    if (!Array.isArray(page.items)) fail(`page ${pageIndex} has no items array`);
    page.items.forEach((item, itemIndex) => {
      if (item && item.id === objectId) found.push({ pageIndex, itemIndex, item });
    });
  });
  return found;
}
function semanticDiff(beforePages, afterPages) {
  const changes = [];
  function walk(a, b, keyPath) {
    if (Object.is(a, b)) return;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
      changes.push({ path: keyPath, before: a, after: b });
      return;
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) walk(a[key], b[key], `${keyPath}/${key}`);
  }
  walk(beforePages, afterPages, 'pages');
  return changes;
}
function decodedText(value) {
  try { return decodeURIComponent(value); } catch (_) { return value; }
}

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const index = arg.indexOf('=');
  return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)];
}));
const mode = args.mode || 'dry-run';
const source = path.resolve(String(args.source || ''));
const candidate = path.resolve(String(args.candidate || ''));
const objectId = String(args['object-id'] || 'LB6417');
const expectedBefore = String(args['expected-before'] || '  연도별 실적보고서');
const after = String(args.after || 'MVP 원본 수정 테스트');
const logPath = args.log ? path.resolve(String(args.log)) : null;

if (!source || !candidate) fail('--source and --candidate are required');
if (source === candidate) fail('source and candidate paths must differ');
if (!fs.existsSync(source)) fail(`source does not exist: ${source}`);

const sourceBufferBefore = fs.readFileSync(source);
const sourceShaBefore = sha256(sourceBufferBefore);
const sourceParsed = readForm(source);
const sourceFound = findObjects(sourceParsed.pages, objectId);
if (sourceFound.length !== 1) fail(`expected exactly one ${objectId}, found ${sourceFound.length}`);
const sourceItem = sourceFound[0].item;
const actualBefore = decodedText(sourceItem.text);
if (actualBefore !== expectedBefore) fail(`unexpected text for ${objectId}: ${JSON.stringify(actualBefore)}`);

const bandId = sourceItem.band;
const page = sourceParsed.pages[sourceFound[0].pageIndex];
const bandMatches = page.items.filter(item => item && item.id === bandId);
if (bandMatches.length !== 1) fail(`expected exactly one band ${bandId}, found ${bandMatches.length}`);
if (!Array.isArray(bandMatches[0].bandItems) || !bandMatches[0].bandItems.includes(objectId)) {
  fail(`${objectId} is not listed in ${bandId}.bandItems`);
}

const result = {
  mode,
  source,
  candidate,
  sourceShaBefore,
  sourceSize: sourceBufferBefore.length,
  format: {
    outerEncoding: 'Base64 ASCII with CRLF wrapping',
    compression: 'zlib/DEFLATE',
    serialization: 'outer JSON whose pages entries are JSON strings'
  },
  objectId,
  bandId,
  objectCount: sourceParsed.pages.reduce((sum, current) => sum + current.items.length, 0),
  objectMatchCount: sourceFound.length,
  before: actualBefore,
  after,
  sourceUnchanged: true
};

if (mode === 'dry-run') {
  result.valid = true;
} else if (mode === 'apply') {
  if (fs.existsSync(candidate)) fail(`candidate already exists: ${candidate}`);
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
  fs.copyFileSync(source, candidate);
  const sourceInfo = path.join(path.dirname(source), 'info.xml');
  const candidateInfo = path.join(path.dirname(candidate), 'info.xml');
  if (fs.existsSync(sourceInfo)) fs.copyFileSync(sourceInfo, candidateInfo);
  result.candidateShaBefore = sha256(fs.readFileSync(candidate));
  if (result.candidateShaBefore !== sourceShaBefore) fail('candidate copy hash differs from source');

  const candidateParsed = readForm(candidate);
  const beforePages = JSON.parse(JSON.stringify(candidateParsed.pages));
  const found = findObjects(candidateParsed.pages, objectId);
  if (found.length !== 1) fail(`candidate expected exactly one ${objectId}, found ${found.length}`);
  if (decodedText(found[0].item.text) !== expectedBefore) fail('candidate before text mismatch');
  found[0].item.text = encodeURIComponent(after);
  const expectedDiff = semanticDiff(beforePages, candidateParsed.pages);
  if (expectedDiff.length !== 1 || expectedDiff[0].path !== `pages/${found[0].pageIndex}/items/${found[0].itemIndex}/text`) {
    fail(`unexpected semantic diff: ${JSON.stringify(expectedDiff)}`);
  }
  writeForm(candidate, candidateParsed);

  const reparsed = readForm(candidate);
  const reFound = findObjects(reparsed.pages, objectId);
  if (reFound.length !== 1 || decodedText(reFound[0].item.text) !== after) fail('saved candidate verification failed');
  const savedDiff = semanticDiff(sourceParsed.pages, reparsed.pages);
  if (savedDiff.length !== 1 || savedDiff[0].path !== expectedDiff[0].path) fail('saved candidate has unexpected changes');
  result.changedObjectCount = 1;
  result.semanticDiff = savedDiff;
  result.candidateShaAfter = sha256(fs.readFileSync(candidate));
  result.candidateSizeAfter = fs.statSync(candidate).size;
  result.reparseValid = true;
} else if (mode === 'verify') {
  if (!fs.existsSync(candidate)) fail(`candidate does not exist: ${candidate}`);
  const candidateParsed = readForm(candidate);
  const found = findObjects(candidateParsed.pages, objectId);
  if (found.length !== 1 || decodedText(found[0].item.text) !== after) fail('candidate verification failed');
  const changes = semanticDiff(sourceParsed.pages, candidateParsed.pages);
  if (changes.length !== 1 || !changes[0].path.endsWith('/text')) fail('candidate semantic diff is not text-only');
  result.candidateShaAfter = sha256(fs.readFileSync(candidate));
  result.changedObjectCount = 1;
  result.semanticDiff = changes;
  result.reparseValid = true;
} else {
  fail(`unsupported mode: ${mode}`);
}

result.sourceShaAfter = sha256(fs.readFileSync(source));
result.sourceUnchanged = result.sourceShaAfter === sourceShaBefore;
if (!result.sourceUnchanged) fail('SOURCE HASH CHANGED');
if (logPath) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
