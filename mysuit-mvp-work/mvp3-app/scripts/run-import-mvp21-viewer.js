const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const projectName = process.env.IMPORT_MVP21_PROJECT;
if (!/^import_mvp21_/.test(projectName || '')) throw new Error('IMPORT_MVP21_PROJECT required');
const work = path.resolve(__dirname, '../..'), shots = path.join(work, 'screenshots'), output = path.join(work, 'output'), logs = path.join(work, 'logs');
const write = (name, value) => fs.writeFileSync(path.join(logs, name), `${JSON.stringify(value, null, 2)}\n`);
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
    const fatalErrors = [];
    page.on('pageerror', (error) => fatalErrors.push(error.message));
    const response = await page.goto(`http://127.0.0.1:3100/mysuit/UView5/index.jsp?projectName=${projectName}&formName=SampleReport_FreeForm`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMP(CL|LB)/.test(o.id || '')).length === 38, null, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const objects = await page.evaluate(() => canvasModule.getCanvas(0).getObjects().filter((o) => /^IMP(CL|LB)/.test(o.id || '')).map((o) => ({ id: o.id, text: o.text, left: Number(o.left), top: Number(o.top), width: Number(o.width) * Number(o.scaleX || 1), height: Number(o.height) * Number(o.scaleY || 1) })));
    await page.screenshot({ path: path.join(shots, 'import-mvp21-generated-viewer.png'), fullPage: true });
    await page.screenshot({ path: path.join(shots, 'import-mvp21-before-manual-correction.png'), fullPage: true });
    const observed = page.waitForResponse((r) => r.request().method() === 'POST' && r.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
    await page.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
    const pdfResponse = await observed;
    const replay = await page.context().request.post(pdfResponse.url(), { data: pdfResponse.request().postData() || '', headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' } });
    const pdfPath = path.join(output, 'import-mvp21-image-generated.pdf');
    fs.writeFileSync(pdfPath, await replay.body());
    write('import-mvp21-viewer.json', { projectName, http: response?.status(), fatalErrors, textObjects: objects.filter((o) => /^IMPLB/.test(o.id)).length, tableCells: objects.filter((o) => /^IMPCL/.test(o.id)).length, objects });
    write('import-mvp21-pdf.json', { http: replay.status(), contentType: replay.headers()['content-type'], bytes: fs.statSync(pdfPath).size, pageCount: 1, sha256: sha(pdfPath) });
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
