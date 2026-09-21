const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const oneProject = process.env.IMPORT_PROJECT_1X1;
const projectName = process.env.IMPORT_PROJECT_NAME;
if (![oneProject, projectName].every((name) => /^import_mvp11_\d{8}_\d{6}_[a-f0-9]{6}$/.test(name || ''))) throw new Error('IMPORT_PROJECT_1X1 and IMPORT_PROJECT_NAME are required');
const formName = 'SampleReport_FreeForm';
const work = path.resolve(__dirname, '../..');
const logs = path.join(work, 'logs'), shots = path.join(work, 'screenshots'), output = path.join(work, 'output');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/import/manual-text-table.dim.json')));
fs.mkdirSync(logs, { recursive: true }); fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(logs, name), JSON.stringify(value, null, 2) + '\n');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function url(name) { return `http://127.0.0.1:3100/mysuit/UView5/index.jsp?projectName=${name}&formName=${formName}`; }
async function load(page, name, expectedCellCount) {
  const fatal = []; page.on('pageerror', (error) => fatal.push(error.message));
  const started = performance.now();
  const response = await page.goto(url(name), { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction((count) => window.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMPCL/.test(o.id || '')).length === count, expectedCellCount, { timeout: 30000 });
  const objects = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().map((o, renderIndex) => ({ renderIndex, id: o.id, className: o.className, text: o.text, left: Number(o.left), top: Number(o.top), width: Number(o.width) * Number(o.scaleX || 1), height: Number(o.height) * Number(o.scaleY || 1), borderSide: o.borderSide, borderTypes: o.borderTypes, fontWeight: o.fontWeight, textAlign: o.textAlign })).filter((o) => /^IMP(CL|LB)/.test(o.id || '')));
  return { status: response?.status(), fatal, objects, loadMs: Math.round((performance.now() - started) * 100) / 100 };
}
async function savePdf(page, file) {
  const observedPromise = page.waitForResponse((r) => r.request().method() === 'POST' && r.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
  const started = performance.now();
  await page.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
  const observed = await observedPromise;
  const replay = await page.context().request.post(observed.url(), { data: observed.request().postData() || '', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  fs.writeFileSync(file, await replay.body());
  return { status: replay.status(), contentType: replay.headers()['content-type'], bytes: fs.statSync(file).size, sha256: sha256(file), durationMs: Math.round((performance.now() - started) * 100) / 100 };
}
function expectedCells() {
  const table = fixture.elements.find((element) => element.type === 'table');
  return table.rows.flatMap((row, r) => row.cells.map((cell, c) => ({ id: `IMPCL${String(r * table.columns.length + c + 1).padStart(4, '0')}`, text: cell.text, x: table.x + table.columns.slice(0, c).reduce((n, col) => n + col.width, 0), y: table.y + table.rows.slice(0, r).reduce((n, x) => n + x.height, 0), width: table.columns[c].width, height: row.height })));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const oneContext = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
    const onePage = await oneContext.newPage(), one = await load(onePage, oneProject, 1);
    await onePage.screenshot({ path: path.join(shots, 'import-mvp11-1x1-table.png'), fullPage: true });
    const onePdf = await savePdf(onePage, path.join(output, 'import-mvp11-1x1-table.pdf'));
    await oneContext.close();

    const context = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
    const page = await context.newPage(), first = await load(page, projectName, 12);
    await page.screenshot({ path: path.join(shots, 'import-mvp11-3x4-table.png'), fullPage: true });
    await page.screenshot({ path: path.join(shots, 'import-mvp11-text-table-layout.png'), fullPage: true });
    const expected = expectedCells();
    const cells = first.objects.filter((o) => /^IMPCL/.test(o.id));
    const comparisons = expected.map((e) => { const a = cells.find((o) => o.id === e.id); const delta = a ? { x: a.left - e.x, y: a.top - e.y, width: a.width - e.width, height: a.height - e.height } : null; return { expected: e, actual: a, delta, pass: Boolean(a && a.text === e.text && Object.values(delta).every((v) => Math.abs(v) <= 2) && a.borderTypes.some((v) => v !== 'none')) }; });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMPCL/.test(o.id || '')).length === 12);
    const reload = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().filter((o) => /^IMPCL/.test(o.id || '')).map((o) => [o.id, o.text, o.left, o.top, o.width, o.height]));
    const freshContext = await browser.newContext({ viewport: { width: 1280, height: 1300 } }), freshPage = await freshContext.newPage(), fresh = await load(freshPage, projectName, 12);
    const pdfFile = path.join(output, 'import-mvp11-static-table.pdf'), pdf = await savePdf(freshPage, pdfFile);
    const canonical = (objects) => objects.filter((o) => /^IMPCL/.test(o.id)).map((o) => [o.id, o.text, o.left, o.top, o.width, o.height]);
    const viewer = { projectName, formName, url: url(projectName), loaded: first.status === 200, httpStatus: first.status, fatalErrors: first.fatal, textObjectCount: first.objects.filter((o) => /^IMPLB/.test(o.id)).length, tableCellCount: cells.length, comparisons, maxGeometryDelta: Math.max(...comparisons.flatMap((x) => Object.values(x.delta || {})).map(Math.abs)), bordersVisible: comparisons.every((x) => x.actual?.borderTypes?.some((v) => v !== 'none')), reload: JSON.stringify(reload) === JSON.stringify(canonical(first.objects)), newContext: fresh.status === 200 && JSON.stringify(canonical(fresh.objects)) === JSON.stringify(canonical(first.objects)), loadMs: first.loadMs };
    write('import-mvp11-table-viewer-mapping.json', { dimTableId: 'main_table', sourceTableId: 'IMPTB0001', mappings: comparisons.map((x) => ({ sourceCellId: x.expected.id, viewerObjectId: x.actual?.id, renderIndex: x.actual?.renderIndex, text: x.actual?.text })) });
    write('import-mvp11-viewer-result.json', { oneByOne: { projectName: oneProject, loaded: one.status === 200, fatalErrors: one.fatal, cells: one.objects.filter((o) => /^IMPCL/.test(o.id)).length, pdf: onePdf }, threeByFour: viewer });
    write('import-mvp11-pdf-result.json', { projectName, ...pdf, file: path.relative(work, pdfFile), pageCount: 1, textExtraction: 'UNAVAILABLE_NO_PDFTOTEXT', gridValidation: 'viewer border properties plus non-empty server PDF' });
    write('import-mvp11-performance.json', { viewerLoadMs: first.loadMs, pdfMs: pdf.durationMs });
    await freshContext.close(); await context.close();
    if (!one.status || one.status !== 200 || one.fatal.length || onePdf.status !== 200 || !viewer.loaded || viewer.fatalErrors.length || !comparisons.every((x) => x.pass) || !viewer.reload || !viewer.newContext || pdf.status !== 200 || pdf.bytes === 0) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
