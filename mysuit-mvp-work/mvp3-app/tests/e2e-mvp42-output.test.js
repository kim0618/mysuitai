const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const root = path.resolve(__dirname, '../..');
const logs = path.join(root, 'logs');
const outputs = path.join(root, 'outputs');
const shots = path.join(root, 'screenshots');
for (const dir of [logs, outputs, shots]) fs.mkdirSync(dir, { recursive: true });
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

(async () => {
  const started = Date.now();
  const events = [];
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
    const context = await browser.newContext({ viewport: { width: 1680, height: 1150 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('request', request => {
      if (request.method() !== 'POST') return;
      const raw = request.postData() || '';
      const params = Object.fromEntries(new URLSearchParams(raw));
      const keys = Object.keys(params);
      events.push({ type: 'request', atMs: Date.now() - started, method: request.method(), url: request.url(), keys,
        methodName: params.METHOD_NAME || null, projectName: params.PROJECT_NAME || null,
        formId: params.FORM_ID || null, loadType: params.LOAD_TYPE || null,
        hasChangeItemData: Boolean(params.CHANGE_ITEM_DATA), hasChangeDataset: Boolean(params.CHANGE_DATASET),
        hasFabricJson: keys.some(key => /^(FABRIC_JSON|CANVAS_JSON|PAGE_DATA|RENDER_PATCHES|LEFT|TOP)$/i.test(key)), bodyBytes: Buffer.byteLength(raw) });
    });
    page.on('response', response => {
      if (response.request().method() === 'POST') events.push({ type: 'response', atMs: Date.now() - started,
        status: response.status(), url: response.url(), contentType: response.headers()['content-type'] || null });
    });
    page.on('websocket', socket => events.push({ type: 'websocket', atMs: Date.now() - started, url: socket.url() }));
    page.on('dialog', dialog => dialog.dismiss().catch(() => {}));

    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#viewer')?.contentWindow?.location?.href?.includes('/UView5/index.jsp'), { timeout: 30000 });
    const frame = page.frames().find(value => value.url().includes('/UView5/index.jsp'));
    await frame.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length === 180, { timeout: 30000 });
    await frame.waitForFunction(() => {
      const item = canvasModule.getCanvas(0).getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      return item && Math.abs(item.left - 357.0000007687047) < 0.01 && item.top === 62;
    }, { timeout: 15000 });
    const position = await frame.evaluate(() => {
      const item = canvasModule.getCanvas(0).getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      return { id: item.id, left: item.left, top: item.top, objectCount: canvasModule.getCanvas(0).getObjects().length };
    });
    await page.screenshot({ path: path.join(shots, 'mvp42-viewer-position-patched.png'), fullPage: true });

    const exportStarted = Date.now();
    const pdfResponsePromise = page.waitForResponse(response => response.request().method() === 'POST' &&
      response.headers()['content-type']?.includes('application/pdf'), { timeout: 30000 });
    await frame.evaluate(() => { canvasModule.captureAll(); mainModule.callService('savePDF'); });
    const pdfResponse = await pdfResponsePromise;
    const serverPdf = path.join(outputs, 'mvp42-server-output.pdf');
    const replay = await context.request.post(pdfResponse.url(), {
      data: pdfResponse.request().postData() || '',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' }
    });
    fs.writeFileSync(serverPdf, await replay.body());
    await page.waitForTimeout(500);
    const exportMs = Date.now() - exportStarted;

    const direct = await context.newPage();
    await direct.goto('http://127.0.0.1:3100/mysuit/UView5/index.jsp?projectName=sample&formName=sample', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await direct.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length === 180, { timeout: 30000 });
    const directBefore = await direct.evaluate(() => {
      const item = canvasModule.getCanvas(0).getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      return { left: item.left, top: item.top };
    });
    await direct.evaluate(() => {
      const item = canvasModule.getCanvas(0).getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      item.set({ left: 357.0000007687047, top: 62 }); item.setCoords(); canvasModule.getCanvas(0).renderAll();
    });
    const printStarted = Date.now();
    const browserPdf = path.join(outputs, 'mvp42-browser-print.pdf');
    await direct.pdf({ path: browserPdf, printBackground: true, preferCSSPageSize: true });
    const browserPrintMs = Date.now() - printStarted;
    for (const [pdf, name] of [[serverPdf, 'mvp42-server-output.png'], [browserPdf, 'mvp42-browser-print.png']]) {
      const preview = await context.newPage();
      await preview.goto(`file://${pdf}`, { waitUntil: 'load', timeout: 30000 });
      await preview.waitForTimeout(1500);
      await preview.screenshot({ path: path.join(shots, name), fullPage: true });
      await preview.close();
    }

    const result = { capturedAt: new Date().toISOString(), position, directBefore, exportMs, browserPrintMs,
      serverPdf: { path: path.relative(root, serverPdf), bytes: fs.statSync(serverPdf).size, sha256: sha256(serverPdf), classification: 'MYSUIT_SERVER_PDF' },
      browserPrint: { path: path.relative(root, browserPdf), bytes: fs.statSync(browserPdf).size, sha256: sha256(browserPdf), classification: 'BROWSER_PRINT_NOT_SERVER_PDF' },
      events, conclusion: { fabricCoordinatesPresentInPdfRequest: events.some(e => e.type === 'request' && e.hasFabricJson),
        renderPatchKeyPresent: events.some(e => e.type === 'request' && e.methodName === 'savePDF' && (e.keys || []).some(k => /render.?patch/i.test(k))) } };
    fs.writeFileSync(path.join(logs, 'mvp42-pdf-network.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
