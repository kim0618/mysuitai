const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const projectName = process.env.IMPORT_PROJECT_NAME;
if (!/^import_mvp10_\d{8}_\d{6}_[a-f0-9]{6}$/.test(projectName || '')) throw new Error('IMPORT_PROJECT_NAME is required');
const formName = 'SampleReport_FreeForm';
const work = path.resolve(__dirname, '../..');
const logs = path.join(work, 'logs'), shots = path.join(work, 'screenshots'), output = path.join(work, 'output');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../samples/import/manual-text-only.dim.json')));
const url = `http://127.0.0.1:3100/mysuit/UView5/index.jsp?projectName=${projectName}&formName=${formName}`;
fs.mkdirSync(logs, { recursive: true }); fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(output, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(logs, name), JSON.stringify(value, null, 2) + '\n');
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function load(page) {
  const fatal = [];
  page.on('pageerror', (error) => fatal.push(error.message));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length > 0, null, { timeout: 30000 });
  await page.waitForFunction(() => window.canvasModule.getCanvas(0).getObjects().filter((o) => o.className === 'UBLabel').length === 5, null, { timeout: 30000 });
  await page.waitForTimeout(300);
  const objects = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().map((o, renderIndex) => ({ o, renderIndex })).filter(({ o }) => o.className === 'UBLabel').map(({ o, renderIndex }) => ({ renderIndex, viewerObjectId: o.id, className: o.className, text: o.text, left: Number(o.left), top: Number(o.top), width: Number(o.width), height: Number(o.height), scaleX: Number(o.scaleX || 1), scaleY: Number(o.scaleY || 1), fontSize: Number(o.fontSize), fontWeight: o.fontWeight, textAlign: o.textAlign })));
  return { status: response?.status(), fatal, objects };
}

function compare(objects) {
  return fixture.elements.map((element, index) => {
    const actual = objects[index];
    const expected = { x: element.x, y: element.y, width: element.width, height: element.height, fontSize: element.style.fontSize, fontWeight: element.style.bold ? 'bold' : 'normal', textAlign: element.style.textAlign };
    const rendered = actual ? { x: actual.left, y: actual.top, width: actual.width * actual.scaleX, height: actual.height * actual.scaleY, fontSize: actual.fontSize, fontWeight: actual.fontWeight, textAlign: actual.textAlign } : null;
    const delta = rendered ? { x: rendered.x - expected.x, y: rendered.y - expected.y, width: rendered.width - expected.width, height: rendered.height - expected.height, fontSize: rendered.fontSize - expected.fontSize } : null;
    return { dimElementId: element.id, sourceObjectId: `IMPLB${String(index + 1).padStart(4, '0')}`, expectedText: element.text, actualText: actual?.text, viewerObjectId: actual?.viewerObjectId, renderInstanceKey: actual ? `p0|c0|src:IMPLB${String(index + 1).padStart(4, '0')}|band:FREEFORM|row:0|idx:${actual.renderIndex}` : null, expected, actual: rendered, delta, pass: Boolean(actual && actual.text === element.text && Math.abs(delta.x) <= 2 && Math.abs(delta.y) <= 2 && Math.abs(delta.width) <= 2 && Math.abs(delta.height) <= 2 && Math.abs(delta.fontSize) <= 0.01 && rendered.fontWeight === expected.fontWeight && rendered.textAlign === expected.textAlign) };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
    const page = await context.newPage(), first = await load(page), comparisons = compare(first.objects);
    await page.screenshot({ path: path.join(shots, 'import-mvp10-viewer.png'), fullPage: true });
    await page.screenshot({ path: path.join(shots, 'import-mvp10-text-layout.png'), fullPage: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => o.className === 'UBLabel').length === 5, null, { timeout: 30000 });
    const reloadObjects = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().filter((o) => o.className === 'UBLabel').map((o) => ({ id: o.id, text: o.text, left: o.left, top: o.top })));
    const freshContext = await browser.newContext({ viewport: { width: 1280, height: 1300 } }), freshPage = await freshContext.newPage(), fresh = await load(freshPage);
    const pdfResponse = freshPage.waitForResponse((r) => r.request().method() === 'POST' && r.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
    await freshPage.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
    const observed = await pdfResponse, replay = await freshPage.context().request.post(observed.url(), { data: observed.request().postData() || '', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
    const pdfFile = path.join(output, 'import-mvp10-text-only.pdf'); fs.writeFileSync(pdfFile, await replay.body());
    const viewerResult = { projectName, formName, url, loaded: first.status === 200, httpStatus: first.status, fatalErrors: first.fatal, expectedTextCount: 5, actualTextCount: first.objects.length, comparisons, geometryTolerance: 2, allMatched: comparisons.every((x) => x.pass), reload: { count: reloadObjects.length, identical: JSON.stringify(reloadObjects) === JSON.stringify(first.objects.map((o) => ({ id: o.viewerObjectId, text: o.text, left: o.left, top: o.top }))) }, newContext: { loaded: fresh.status === 200, count: fresh.objects.length, identical: JSON.stringify(fresh.objects.map((o) => [o.viewerObjectId, o.text, o.left, o.top])) === JSON.stringify(first.objects.map((o) => [o.viewerObjectId, o.text, o.left, o.top])) } };
    write('import-mvp10-viewer-result.json', viewerResult);
    write('import-mvp10-id-mapping.json', { projectName, mappings: comparisons.map(({ dimElementId, sourceObjectId, viewerObjectId, renderInstanceKey }) => ({ dimElementId, sourceObjectId, viewerObjectId, renderInstanceKey })) });
    write('import-mvp10-pdf-result.json', { projectName, status: replay.status(), contentType: replay.headers()['content-type'], bytes: fs.statSync(pdfFile).size, sha256: sha256(pdfFile), file: path.relative(work, pdfFile), textExtraction: 'pending_external_pdftotext_check' });
    write('import-mvp10-editor-smoke.json', { status: 'LIMITED_NOT_CONNECTED', importedViewerObjectSelection: 'viewer objects are event-capable but standalone UView has no editor UI', sourceEdit: false, reason: 'Existing Editor client URL, source APIs, history and resolver remain scoped to sample/sample; broad generalization is deferred to MVP 1.2.' });
    await freshContext.close(); await context.close();
    if (!viewerResult.loaded || first.fatal.length || !viewerResult.allMatched || !viewerResult.reload.identical || !viewerResult.newContext.identical || replay.status() !== 200 || fs.statSync(pdfFile).size === 0) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
