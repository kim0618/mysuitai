const path = require('path');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const projectName = 'import_mvp11_20260827_170551_e59e1d';
const output = path.resolve(__dirname, '../../screenshots/import-mvp20-source.png');
const url = `http://127.0.0.1:3100/mysuit/UView5/index.jsp?projectName=${projectName}&formName=SampleReport_FreeForm`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1300 } });
    const fatalErrors = [];
    page.on('pageerror', (error) => fatalErrors.push(error.message));
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => {
      const objects = window.canvasModule?.getCanvas?.(0)?.getObjects?.() || [];
      return objects.some((object) => /^IMPCL/.test(object.id || ''));
    }, { timeout: 30000 });
    await page.waitForTimeout(1000);
    const objectCount = await page.evaluate(() => window.canvasModule.getCanvas(0).getObjects().length);
    await page.screenshot({ path: output, fullPage: true });
    process.stdout.write(`${JSON.stringify({ httpStatus: response?.status(), fatalErrors, objectCount, output })}\n`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
