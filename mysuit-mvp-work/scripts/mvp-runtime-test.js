const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const root = '/home/tjd618/mysuit-ai-viewer';
const logs = path.join(root, 'mysuit-mvp-work/logs');
const screenshots = path.join(root, 'mysuit-mvp-work/screenshots');
const url = process.argv[2] || 'http://localhost:9990/MYSUIT/UView5/index.jsp?projectName=sample&formName=sample';
const executablePath = '/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';

fs.mkdirSync(logs, { recursive: true });
fs.mkdirSync(screenshots, { recursive: true });

const writeJson = (name, value) => {
  fs.writeFileSync(path.join(logs, name), JSON.stringify(value, null, 2) + '\n');
};

(async () => {
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const consoleEntries = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', message => consoleEntries.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => pageErrors.push({ message: error.message, stack: error.stack || null }));
  page.on('requestfailed', request => failedRequests.push({
    url: request.url(),
    method: request.method(),
    error: request.failure()?.errorText || null
  }));

  let result = { url, startedAt: new Date().toISOString() };
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    result.httpStatus = response?.status() ?? null;

    await page.waitForFunction(() => {
      const hasDom = document.querySelector('canvas[id^="ubicanvas"], .lower-canvas, .canvas-container');
      let instance = null;
      try {
        if (window.canvasModule && typeof window.canvasModule.getCanvas === 'function') {
          instance = window.canvasModule.getCanvas(0) || window.canvasModule.getCanvas();
        }
      } catch (_) {}
      return Boolean(hasDom && instance && typeof instance.getObjects === 'function' && instance.getObjects().length > 0);
    }, { timeout: 30000 });

    const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((canvas, index) => ({
      index,
      id: canvas.id || null,
      className: typeof canvas.className === 'string' ? canvas.className : canvas.className?.baseVal || null,
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      parentId: canvas.parentElement?.id || null,
      parentClass: canvas.parentElement?.className || null
    })));
    writeJson('runtime-canvases.json', canvases);

    const inspection = await page.evaluate(() => {
      const candidates = [];
      for (const key of Object.keys(window)) {
        try {
          const value = window[key];
          if (value && typeof value === 'object' && (
            typeof value.getObjects === 'function' ||
            Array.isArray(value.canvasInfoArray) ||
            typeof value.renderAll === 'function'
          )) {
            candidates.push({
              key,
              hasGetObjects: typeof value.getObjects === 'function',
              hasRenderAll: typeof value.renderAll === 'function',
              hasRequestRenderAll: typeof value.requestRenderAll === 'function',
              isArray: Array.isArray(value),
              constructorName: value.constructor?.name || null
            });
          }
        } catch (_) {}
      }
      const canvas = window.canvasModule.getCanvas(0) || window.canvasModule.getCanvas();
      const objects = canvas.getObjects();
      const summary = objects.map((object, index) => ({
        index,
        type: object.type ?? null,
        className: object.className ?? null,
        id: object.id ?? null,
        itemId: object.itemId ?? null,
        name: object.name ?? null,
        text: typeof object.text === 'string' ? object.text : null,
        left: object.left ?? null,
        top: object.top ?? null,
        width: object.width ?? null,
        height: object.height ?? null,
        selectable: object.selectable ?? null,
        evented: object.evented ?? null,
        visible: object.visible ?? null
      }));
      const targetIndex = objects.findIndex(object =>
        object.className === 'UBLabel' &&
        typeof object.text === 'string' &&
        object.text.trim().length > 0 &&
        !String(object.id || object.name || '').startsWith('editLblItem')
      );
      if (targetIndex < 0) throw new Error('No original UBLabel candidate with non-empty text');
      const target = objects[targetIndex];
      return {
        candidates,
        summary,
        targetIndex,
        target: summary[targetIndex],
        stats: {
          total: objects.length,
          UBLabel: objects.filter(o => o.className === 'UBLabel').length,
          UBImage: objects.filter(o => o.className === 'UBImage').length,
          UBSignature: objects.filter(o => o.className === 'UBSignature').length,
          textObjects: objects.filter(o => typeof o.text === 'string' && o.text.length > 0).length,
          withId: objects.filter(o => o.id != null && o.id !== '').length,
          withItemId: objects.filter(o => o.itemId != null && o.itemId !== '').length,
          withClassName: objects.filter(o => o.className != null && o.className !== '').length
        }
      };
    });
    writeJson('runtime-global-candidates.json', inspection.candidates);
    writeJson('runtime-page0-objects.json', inspection.summary);
    writeJson('selected-object-before.json', inspection.target);
    result.canvasCount = canvases.filter(c => c.id?.startsWith('ubicanvas') && c.className?.includes('lower-canvas')).length;
    result.inspection = inspection;

    await page.screenshot({ path: path.join(screenshots, 'before-change.png'), fullPage: true });

    const textChange = await page.evaluate(targetIndex => {
      const canvas = window.canvasModule.getCanvas(0) || window.canvasModule.getCanvas();
      const target = canvas.getObjects()[targetIndex];
      const beforeCount = canvas.getObjects().length;
      const backup = {
        text: target.text,
        left: target.left,
        top: target.top,
        selectable: target.selectable,
        evented: target.evented
      };
      target.set({ text: 'MVP 테스트' });
      if (typeof target.setCoords === 'function') target.setCoords();
      canvas.renderAll();
      window.__MY_SUIT_MVP = { canvas, target, targetIndex, backup };
      return {
        before: backup.text,
        after: target.text,
        beforeCount,
        afterCount: canvas.getObjects().length,
        changed: target.text === 'MVP 테스트'
      };
    }, inspection.targetIndex);
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshots, 'text-changed.png'), fullPage: true });

    const textRestore = await page.evaluate(() => {
      const { canvas, target, backup } = window.__MY_SUIT_MVP;
      target.set({ text: backup.text });
      if (typeof target.setCoords === 'function') target.setCoords();
      canvas.renderAll();
      return { restoredText: target.text, expectedText: backup.text, success: target.text === backup.text };
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshots, 'text-restored.png'), fullPage: true });

    const positionChange = await page.evaluate(() => {
      const { canvas, target, backup } = window.__MY_SUIT_MVP;
      const beforeCount = canvas.getObjects().length;
      const beforeTop = Number(target.top);
      const afterTop = beforeTop - 10;
      target.set({ top: afterTop });
      if (typeof target.setCoords === 'function') target.setCoords();
      canvas.renderAll();
      return {
        beforeTop,
        afterTop: Number(target.top),
        beforeCount,
        afterCount: canvas.getObjects().length,
        changed: Number(target.top) === afterTop,
        canvasViewportTransform: Array.isArray(canvas.viewportTransform) ? [...canvas.viewportTransform] : null,
        expectedRestoreTop: Number(backup.top)
      };
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshots, 'position-changed.png'), fullPage: true });

    const positionRestore = await page.evaluate(() => {
      const { canvas, target, backup } = window.__MY_SUIT_MVP;
      target.set({ top: backup.top });
      if (typeof target.setCoords === 'function') target.setCoords();
      canvas.renderAll();
      return {
        restoredTop: Number(target.top),
        expectedTop: Number(backup.top),
        success: Number(target.top) === Number(backup.top),
        objectCount: canvas.getObjects().length
      };
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshots, 'position-restored.png'), fullPage: true });

    const actualId = inspection.target.sourceObjectId ?? inspection.target.objectId ?? inspection.target.itemId ?? inspection.target.id ?? inspection.target.name ?? null;
    const patches = [
      {
        reportId: 'sample', baseVersion: null, pageIndex: 0,
        objectId: actualId, objectType: inspection.target.className,
        operation: 'updateProperty', property: 'text',
        before: textChange.before, after: textChange.after, temporary: true
      },
      {
        reportId: 'sample', baseVersion: null, pageIndex: 0,
        objectId: actualId, objectType: inspection.target.className,
        operation: 'updateProperty', property: 'top',
        before: positionChange.beforeTop, after: positionChange.afterTop, temporary: true
      }
    ];
    writeJson('runtime-patches.json', patches);
    result.textChange = textChange;
    result.textRestore = textRestore;
    result.positionChange = positionChange;
    result.positionRestore = positionRestore;
    result.patches = patches;
    result.success = textChange.changed && textChange.beforeCount === textChange.afterCount &&
      textRestore.success && positionChange.changed && positionChange.beforeCount === positionChange.afterCount &&
      positionRestore.success;
  } catch (error) {
    result.success = false;
    result.error = { message: error.message, stack: error.stack || null };
    const canvases = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((canvas, index) => ({
      index, id: canvas.id || null, className: canvas.className || null,
      width: canvas.width, height: canvas.height
    }))).catch(() => []);
    writeJson('runtime-canvases.json', canvases);
    await page.screenshot({ path: path.join(screenshots, 'runtime-failure.png'), fullPage: true }).catch(() => {});
  } finally {
    result.finishedAt = new Date().toISOString();
    result.console = consoleEntries;
    result.pageErrors = pageErrors;
    result.failedRequests = failedRequests;
    writeJson('runtime-result.json', result);
    writeJson('runtime-browser-errors.json', { console: consoleEntries, pageErrors, failedRequests });
    await browser.close();
  }

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.success ? 0 : 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
