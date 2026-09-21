const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const projectName = process.env.IMPORT_USER_TEST_PROJECT;
if (!/^import_user_test_\d{8}_\d{6}_[a-f0-9]{6}$/.test(projectName || '')) throw new Error('IMPORT_USER_TEST_PROJECT is required');
const base = 'http://127.0.0.1:3100';
const formName = 'SampleReport_FreeForm';
const work = path.resolve(__dirname, '../..');
const shots = path.join(work, 'screenshots');
const output = path.join(work, 'output');
const logs = path.join(work, 'logs');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(logs, name), `${JSON.stringify(value, null, 2)}\n`);

async function savePdf(page, file) {
  const observedPromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
  await page.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
  const observed = await observedPromise;
  const replay = await page.context().request.post(observed.url(), { data: observed.request().postData() || '', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
  fs.writeFileSync(file, await replay.body());
  return { http: replay.status(), contentType: replay.headers()['content-type'], bytes: fs.statSync(file).size, sha256: sha(file), pageCount: 1 };
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(logs, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const viewerContext = await browser.newContext({ viewport: { width: 1280, height: 1350 } });
    const viewerPage = await viewerContext.newPage();
    const viewerErrors = [];
    viewerPage.on('pageerror', (error) => viewerErrors.push(error.message));
    const viewerResponse = await viewerPage.goto(`${base}/mysuit/UView5/index.jsp?projectName=${projectName}&formName=${formName}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await viewerPage.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((object) => /^IMP(CL|LB)/.test(object.id || '')).length === 217, null, { timeout: 30000 });
    await viewerPage.waitForTimeout(1200);
    const objects = await viewerPage.evaluate(() => canvasModule.getCanvas(0).getObjects().filter((object) => /^IMP(CL|LB)/.test(object.id || '')).map((object) => ({
      id: object.id, text: object.text, left: Number(object.left), top: Number(object.top),
      width: Number(object.width) * Number(object.scaleX || 1), height: Number(object.height) * Number(object.scaleY || 1),
      fill: object.fill, backgroundColor: object.backgroundColor, fontSize: object.fontSize,
      fontWeight: object.fontWeight, textAlign: object.textAlign, verticalAlign: object.verticalAlign,
    })));
    const screenshot = path.join(shots, 'import-user-test-generated-viewer.png');
    await viewerPage.screenshot({ path: screenshot, fullPage: true });
    const pdfPath = path.join(output, 'import-user-test-my-report.pdf');
    const pdf = await savePdf(viewerPage, pdfPath);
    const viewer = {
      status: viewerResponse.status(), fatalErrors: viewerErrors,
      textObjects: objects.filter((object) => /^IMPLB/.test(object.id)).length,
      tableCells: objects.filter((object) => /^IMPCL/.test(object.id)).length,
      objectCount: objects.length, screenshot, objects,
    };
    write('import-user-test-viewer.json', { projectName, formName, ...viewer });
    write('import-user-test-pdf.json', { projectName, formName, path: pdfPath, ...pdf });
    await viewerContext.close();

    const editorContext = await browser.newContext({ viewport: { width: 1800, height: 1200 } });
    const editorPage = await editorContext.newPage();
    const editorErrors = [];
    editorPage.on('pageerror', (error) => editorErrors.push(error.message));
    const draft = 'user_test_review';
    const editorResponse = await editorPage.goto(`${base}/?projectName=${projectName}&layoutDraftId=${draft}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await editorPage.waitForFunction(() => !document.querySelector('#viewer').classList.contains('viewer-loading') && window.__mvp12?.model?.cells?.length === 210, null, { timeout: 60000 });
    const model = await editorPage.evaluate(() => ({
      cells: __mvp12.model.cells.length,
      columns: __mvp12.model.columns.length,
      rows: __mvp12.model.rows.length,
      sourceTableId: __mvp12.model.sourceTableId,
      viewerUrl: document.querySelector('#viewer').src,
    }));
    await editorPage.screenshot({ path: path.join(shots, 'import-user-test-editor.png'), fullPage: true });
    const editor = { status: editorResponse.status(), fatalErrors: editorErrors, attached: true, ...model };
    write('import-user-test-editor.json', { projectName, formName, draft, ...editor });
    await editorContext.close();
    if (viewer.status !== 200 || viewer.fatalErrors.length || viewer.objectCount !== 217 || pdf.http !== 200 || editor.status !== 200 || editor.fatalErrors.length || model.columns !== 6 || model.rows !== 35) throw new Error('User test E2E assertion failed');
    process.stdout.write(`${JSON.stringify({ projectName, formName, viewer, editor, pdf: { path: pdfPath, ...pdf } })}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
