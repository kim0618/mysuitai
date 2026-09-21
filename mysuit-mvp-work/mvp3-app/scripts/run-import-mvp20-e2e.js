const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const projectName = process.env.IMPORT_MVP20_PROJECT;
if (!/^import_mvp20_\d{8}_\d{6}_[a-f0-9]{6}$/.test(projectName || '')) throw new Error('IMPORT_MVP20_PROJECT is required');
const base = 'http://127.0.0.1:3100';
const formName = 'SampleReport_FreeForm';
const work = path.resolve(__dirname, '../..');
const screenshots = path.join(work, 'screenshots');
const output = path.join(work, 'output');
const logs = path.join(work, 'logs');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(logs, name), `${JSON.stringify(value, null, 2)}\n`);

async function savePdf(page, file) {
  const observedPromise = page.waitForResponse((r) => r.request().method() === 'POST' && r.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
  await page.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
  const observed = await observedPromise;
  const replay = await page.context().request.post(observed.url(), { data: observed.request().postData() || '', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  fs.writeFileSync(file, await replay.body());
  return { http: replay.status(), contentType: replay.headers()['content-type'], bytes: fs.statSync(file).size, sha256: sha(file), pageCount: 1 };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1300 } });
    const page = await context.newPage();
    const fatalErrors = [];
    page.on('pageerror', (error) => fatalErrors.push(error.message));
    const response = await page.goto(`${base}/mysuit/UView5/index.jsp?projectName=${projectName}&formName=${formName}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMP(CL|LB)/.test(o.id || '')).length === 15, null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const objects = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().filter((o) => /^IMP(CL|LB)/.test(o.id || '')).map((o) => ({ id: o.id, text: o.text, left: Number(o.left), top: Number(o.top), width: Number(o.width) * Number(o.scaleX || 1), height: Number(o.height) * Number(o.scaleY || 1) })));
    await page.screenshot({ path: path.join(screenshots, 'import-mvp20-generated-viewer.png'), fullPage: true });
    const pdf = await savePdf(page, path.join(output, 'import-mvp20-image-generated.pdf'));
    write('import-mvp20-viewer-result.json', { projectName, http: response?.status(), fatalErrors, pageVisible: true, textObjects: objects.filter((o) => /^IMPLB/.test(o.id)).length, tableCells: objects.filter((o) => /^IMPCL/.test(o.id)).length, objects });
    write('import-mvp20-pdf-result.json', pdf);
    await context.close();

    const editorContext = await browser.newContext({ viewport: { width: 1800, height: 1200 } });
    const editorPage = await editorContext.newPage();
    const editorErrors = [];
    editorPage.on('pageerror', (error) => editorErrors.push(error.message));
    const editorResponse = await editorPage.goto(`${base}/?projectName=${projectName}&layoutDraftId=import_mvp20_editor_smoke`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await editorPage.waitForFunction(() => !document.querySelector('#viewer').classList.contains('viewer-loading') && window.__mvp12?.model?.cells?.length === 12, null, { timeout: 30000 });
    await editorPage.click('#review-toggle');
    await editorPage.frameLocator('#viewer').locator('canvas.upper-canvas').click({ position: { x: 397, y: 70 } });
    await editorPage.waitForFunction(() => document.querySelector('#source-id').textContent === 'IMPLB0001');
    await editorPage.screenshot({ path: path.join(screenshots, 'import-mvp20-editor-selected.png'), fullPage: true });
    const model = await editorPage.evaluate(() => ({ cells: __mvp12.model.cells.length, columns: __mvp12.model.columns.length, rows: __mvp12.model.rows.length, selectedSourceId: document.querySelector('#source-id').textContent }));
    write('import-mvp20-editor-smoke.json', { status: 'PASS', http: editorResponse.status(), fatalErrors: editorErrors, ...model });
    await editorContext.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
