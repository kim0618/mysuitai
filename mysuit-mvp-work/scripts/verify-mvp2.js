const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const root = '/home/tjd618/mysuit-ai-viewer';
const logs = path.join(root, 'mysuit-mvp-work/logs');
const screenshots = path.join(root, 'mysuit-mvp-work/screenshots');
const originalUrl = 'http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample';
const candidateUrl = 'http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample_mvp2';
const executablePath = '/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const cleanupOnly = process.argv.includes('--cleanup-check');
const expectedOriginal = '  연도별 실적보고서';
const expectedCandidate = 'MVP 원본 수정 테스트';

fs.mkdirSync(logs, { recursive: true });
fs.mkdirSync(screenshots, { recursive: true });
const writeJson = (name, value) => fs.writeFileSync(path.join(logs, name), JSON.stringify(value, null, 2) + '\n');

async function inspect(context, url, screenshotName) {
  const page = await context.newPage();
  const consoleEntries = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', message => consoleEntries.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || null }));
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => {
    try {
      const canvas = window.canvasModule?.getCanvas?.(0) || window.canvasModule?.getCanvas?.();
      const hasDom = document.querySelector('canvas[id^="ubicanvas"], .lower-canvas, .canvas-container');
      return hasDom && canvas && typeof canvas.getObjects === 'function' && canvas.getObjects().length > 0;
    } catch (_) { return false; }
  }, { timeout: 30000 });
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => {
    const canvas = window.canvasModule.getCanvas(0) || window.canvasModule.getCanvas();
    const objects = canvas.getObjects().map((object, index) => ({
      index,
      id: object.id ?? null,
      itemId: object.itemId ?? null,
      type: object.type ?? null,
      className: object.className ?? null,
      text: typeof object.text === 'string' ? object.text : null,
      left: object.left ?? null,
      top: object.top ?? null,
      width: object.width ?? null,
      height: object.height ?? null
    }));
    const derived = objects.filter(object => object.id?.startsWith('LB6417_'));
    return {
      objectCount: objects.length,
      objects,
      target: derived[0] || null,
      derivedInstances: derived,
      canvasCount: document.querySelectorAll('canvas[id^="ubicanvas"], canvas.lower-canvas').length
    };
  });
  await page.screenshot({ path: path.join(screenshots, screenshotName), fullPage: true });
  return {
    url,
    httpStatus: response?.status() ?? null,
    ...data,
    consoleEntries,
    pageErrors,
    failedRequests,
    runtimeMutationUsed: false,
    screenshot: screenshotName,
    page
  };
}

(async () => {
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const result = { startedAt: new Date().toISOString(), cleanupOnly };
  try {
    if (cleanupOnly) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const original = await inspect(context, originalUrl, 'mvp2-after-cleanup.png');
      delete original.page;
      result.originalAfterCleanup = original;
      result.success = original.httpStatus === 200 && original.target?.text === expectedOriginal && original.objectCount === 180;
      await context.close();
    } else {
      const candidateContext1 = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const candidateFirst = await inspect(candidateContext1, candidateUrl, 'mvp2-candidate-render.png');
      await candidateFirst.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await candidateFirst.page.waitForFunction(() => {
        try {
          const hasDom = document.querySelector('canvas[id^="ubicanvas"], .lower-canvas, .canvas-container');
          return hasDom && (window.canvasModule?.getCanvas?.(0) || window.canvasModule?.getCanvas?.()).getObjects().length > 0;
        }
        catch (_) { return false; }
      }, { timeout: 30000 });
      await candidateFirst.page.waitForTimeout(500);
      const refreshed = await candidateFirst.page.evaluate(() => {
        const objects = (window.canvasModule.getCanvas(0) || window.canvasModule.getCanvas()).getObjects();
        const target = objects.find(object => object.id?.startsWith('LB6417_'));
        return { objectCount: objects.length, id: target?.id || null, text: target?.text || null, top: target?.top ?? null };
      });
      await candidateFirst.page.screenshot({ path: path.join(screenshots, 'mvp2-candidate-refresh.png'), fullPage: true });
      delete candidateFirst.page;
      await candidateContext1.close();

      const candidateContext2 = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const candidateNewContext = await inspect(candidateContext2, candidateUrl, 'mvp2-candidate-new-context.png');
      delete candidateNewContext.page;
      await candidateContext2.close();

      const originalContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
      const original = await inspect(originalContext, originalUrl, 'mvp2-original-unaffected.png');
      delete original.page;
      await originalContext.close();

      result.candidateFirst = candidateFirst;
      result.candidateRefresh = refreshed;
      result.candidateNewContext = candidateNewContext;
      result.original = original;
      result.success = candidateFirst.httpStatus === 200 &&
        candidateFirst.target?.text === expectedCandidate && candidateFirst.objectCount === 180 &&
        refreshed.text === expectedCandidate && refreshed.objectCount === 180 &&
        candidateNewContext.target?.text === expectedCandidate && candidateNewContext.objectCount === 180 &&
        original.target?.text === expectedOriginal && original.objectCount === 180 &&
        candidateFirst.pageErrors.length === 0 && candidateFirst.failedRequests.length === 0 &&
        original.pageErrors.length === 0 && original.failedRequests.length === 0;
      writeJson('mvp2-candidate-objects.json', candidateFirst.objects);
    }
  } catch (error) {
    result.success = false;
    result.error = { message: error.message, stack: error.stack || null };
  } finally {
    result.finishedAt = new Date().toISOString();
    writeJson(cleanupOnly ? 'mvp2-cleanup-result.json' : 'mvp2-rerender-result.json', result);
    await browser.close();
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.success ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
