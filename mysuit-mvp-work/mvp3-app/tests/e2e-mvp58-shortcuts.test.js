const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const base = 'http://127.0.0.1:3100';
const scope = { layoutDraftId: 'pre_ai_v11_shortcuts', projectName: 'sample', formName: 'sample' };
const query = new URLSearchParams(scope);
const log = path.resolve(__dirname, '../../logs/pre-ai-v11-shortcut-test.json');
const clean = async () => {
  for (const endpoint of ['structure-operations', 'history'])
    await fetch(`${base}/api/${endpoint}?${query}`, { method: 'DELETE' }).catch(() => {});
};

(async () => {
  let browser, changeSetId;
  try {
    await clean();
    browser = await chromium.launch({
      executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
    await page.goto(`${base}/?layoutDraftId=${scope.layoutDraftId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mvp58 && document.getElementById('viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.().length === 180, { timeout: 30000 });
    changeSetId = await page.evaluate(() => mvpHistoryBridge.getState().changeSetId);
    await fetch(`${base}/api/change-sets/${changeSetId}/patches`, { method: 'DELETE' });
    await page.evaluate(() => mvpHistoryBridge.refresh());
    await page.click('#review-toggle');
    const frame = page.frames().find(x => x.url().includes('/UView5/index.jsp'));
    await frame.waitForSelector('canvas.upper-canvas', { timeout: 30000 });
    const point = await frame.evaluate(() => {
      const canvas = canvasModule.getCanvas(0);
      // Resolve the current editable page-title fixture by geometry, not a legacy object ID or mutable text.
      const candidates = canvas.getObjects().filter(x => typeof x.text === 'string' && Number(x.top) < 180);
      const object = candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
      if (!object) throw new Error('editable title fixture missing');
      const element = document.querySelector('canvas.upper-canvas');
      const rect = element.getBoundingClientRect(), viewport = canvas.viewportTransform;
      const scaleX = rect.width / element.width, scaleY = rect.height / element.height;
      return {
        x: rect.left + (object.left + object.width / 2) * viewport[0] * scaleX,
        y: rect.top + (object.top + object.height / 2) * viewport[3] * scaleY,
        text: object.text.trim(), id: object.id,
      };
    });
    const iframe = await page.locator('#viewer').boundingBox();
    await page.mouse.dblclick(iframe.x + point.x, iframe.y + point.y);
    const input = frame.locator('#mvp44-inline');
    await input.waitFor();
    const original = await input.inputValue(), cursorBefore = await page.evaluate(() => __mvp58.state.cursor);
    await input.fill('Native Undo Probe');
    await input.press('Control+Z');
    const nativeValue = await input.inputValue(), cursorAfterNative = await page.evaluate(() => __mvp58.state.cursor);
    if (nativeValue !== original || cursorAfterNative !== cursorBefore)
      throw new Error(JSON.stringify({ original, nativeValue, cursorBefore, cursorAfterNative }));
    await input.fill('PRE-AI v1.1 Shortcut');
    await input.press('Enter');
    await page.waitForFunction(() => __mvp58.state.cursor === 1);
    await page.locator('#review-toggle').focus();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(() => __mvp58.state.cursor === 0);
    await page.waitForFunction(() => !document.querySelector('#history-redo').disabled);
    await page.locator('#review-toggle').focus();
    await page.keyboard.press('Control+Shift+Z');
    await page.waitForFunction(() => __mvp58.state.cursor === 1);
    await page.locator('#review-toggle').focus();
    await page.keyboard.press('Control+Z');
    await page.waitForFunction(() => __mvp58.state.cursor === 0);
    await page.waitForFunction(() => !document.querySelector('#history-redo').disabled);
    await page.locator('#review-toggle').focus();
    await page.keyboard.press('Control+Y');
    await page.waitForFunction(() => __mvp58.state.cursor === 1);
    const result = {
      success: true,
      target: { id: point.id, currentText: point.text },
      nativeInputUndo: { original, after: nativeValue, historyCursorBefore: cursorBefore, historyCursorAfter: cursorAfterNative, pass: true },
      documentHistory: { ctrlZ: true, ctrlShiftZ: true, ctrlY: true, finalCursor: 1 },
    };
    fs.writeFileSync(log, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (changeSetId) await fetch(`${base}/api/change-sets/${changeSetId}/patches`, { method: 'DELETE' }).catch(() => {});
    await clean();
    if (browser) await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
