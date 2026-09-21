const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const root = '/home/tjd618/mysuit-ai-viewer';
const shots = path.join(root, 'mysuit-mvp-work/screenshots');
const logs = path.join(root, 'mysuit-mvp-work/logs');
const base = process.env.MVP4_BASE_URL || 'http://127.0.0.1:3101';
const form = path.join(root, 'apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample/form.ubjf');
const info = path.join(path.dirname(form), 'info.xml');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function clickObject(page, id) {
  const frame = page.frames().find(value => value !== page.mainFrame());
  const geometry = await frame.evaluate(objectId => {
    const canvas = window.canvasModule.getCanvas(0);
    const object = canvas.getObjects().find(value => value.id === objectId);
    const element = document.querySelector('canvas.lower-canvas,canvas[id^="ubicanvas"]');
    const rect = element.getBoundingClientRect();
    const transform = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    return {
      x: rect.left + (object.left + object.width / 2) * transform[0] * (rect.width / element.width),
      y: rect.top + (object.top + object.height / 2) * transform[3] * (rect.height / element.height)
    };
  }, id);
  const frameBox = await page.locator('#viewer').boundingBox();
  await page.mouse.click(frameBox.x + geometry.x, frameBox.y + geometry.y);
  await page.waitForFunction(objectId => document.querySelector('#viewer-id').textContent === objectId, id);
}

(async () => {
  fs.mkdirSync(shots, { recursive: true });
  const integrity = { startedAt: new Date().toISOString(), formBefore: sha(form), infoBefore: sha(info) };
  const performance = {};
  const result = { startedAt: new Date().toISOString() };
  let browser;
  let candidateId;
  try {
    browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: 1680, height: 1150 } });
    const totalStarted = Date.now();
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Change Set cs_'), { timeout: 10000 });
    const originalFrame = page.frames().find(value => value !== page.mainFrame());
    await originalFrame.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length === 180 && document.querySelector('canvas.lower-canvas'), { timeout: 30000 });
    await page.click('#review-toggle');

    const selectStarted = Date.now();
    await clickObject(page, 'LB6417_UPHB2584_ROW0');
    await page.waitForFunction(() => !document.querySelector('#prop-text').disabled);
    performance.objectSelectionMs = Date.now() - selectStarted;
    await page.screenshot({ path: path.join(shots, 'mvp4-object-properties.png'), fullPage: true });
    await page.fill('#prop-text', '2026년 연도별 실적보고서');
    await page.fill('#prop-fontSize', '30');
    await page.fill('#prop-width', '440');
    const patchStarted = Date.now();
    await page.click('#add-changes');
    await page.waitForFunction(() => document.querySelector('#patch-count').textContent === '3');
    performance.firstPatchBatchMs = Date.now() - patchStarted;

    await clickObject(page, 'UB5302287_UDHB4114_ROW0');
    await page.waitForFunction(() => !document.querySelector('#prop-visible').disabled);
    await page.uncheck('#prop-visible');
    await page.click('#add-changes');
    await page.waitForFunction(() => document.querySelector('#patch-count').textContent === '4');
    await page.screenshot({ path: path.join(shots, 'mvp4-multiple-patches.png'), fullPage: true });
    await page.locator('.patch').last().locator('button').last().click();
    await page.waitForFunction(() => document.querySelector('#patch-count').textContent === '3');
    await page.screenshot({ path: path.join(shots, 'mvp4-patch-deleted.png'), fullPage: true });
    await clickObject(page, 'UB5302287_UDHB4114_ROW0');
    await page.waitForFunction(() => !document.querySelector('#prop-visible').disabled);
    await page.uncheck('#prop-visible');
    await page.click('#add-changes');
    await page.waitForFunction(() => document.querySelector('#patch-count').textContent === '4');

    const candidateStarted = Date.now();
    await page.click('#create-candidate');
    await page.waitForFunction(() => document.querySelector('#candidate-status').textContent === 'ACTIVE', { timeout: 30000 });
    performance.candidateCreateMs = Date.now() - candidateStarted;
    candidateId = await page.evaluate(async () => {
      const data = await (await fetch('/api/candidates')).json();
      return data.candidates.filter(value => value.status === 'ACTIVE' && value.changeSetId).at(-1).candidateId;
    });
    await page.waitForFunction(() => document.querySelector('#viewer').src.includes('sample_mvp4_'), { timeout: 10000 });
    await page.waitForTimeout(700);
    const candidateFrame = page.frames().find(value => value.url().includes('sample_mvp4_'));
    if (!candidateFrame) throw new Error('candidate iframe not found');
    const renderStarted = Date.now();
    await candidateFrame.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length > 0 && document.querySelector('canvas.lower-canvas,canvas[id^="ubicanvas"]'), { timeout: 30000 });
    await page.waitForTimeout(500);
    performance.candidateRenderMs = Date.now() - renderStarted;
    const candidate = await candidateFrame.evaluate(() => {
      const canvas = window.canvasModule.getCanvas(0);
      const title = canvas.getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      const year = canvas.getObjects().find(value => value.id === 'UB5302287_UDHB4114_ROW0');
      return { count: canvas.getObjects().length, title: { text: title.text, fontSize: title.fontSize, top: title.top, width: title.width }, year: { present: Boolean(year), text: year?.text ?? null, visible: year?.visible ?? null } };
    });
    await page.screenshot({ path: path.join(shots, 'mvp4-candidate-created.png'), fullPage: true });
    await page.screenshot({ path: path.join(shots, 'mvp4-candidate-view.png'), fullPage: true });
    await page.click('#highlight-toggle');
    await page.screenshot({ path: path.join(shots, 'mvp4-changed-objects-highlighted.png'), fullPage: true });
    await page.click('#changes-tab');
    await page.screenshot({ path: path.join(shots, 'mvp4-multiple-patches.png'), fullPage: true });

    await page.click('#original-tab');
    await page.waitForTimeout(700);
    const reloadedOriginalFrame = page.frames().find(value => value.url().includes('projectName=sample&'));
    await reloadedOriginalFrame.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().length === 180, { timeout: 30000 });
    const original = await reloadedOriginalFrame.evaluate(() => {
      const canvas = window.canvasModule.getCanvas(0);
      const title = canvas.getObjects().find(value => value.id === 'LB6417_UPHB2584_ROW0');
      const year = canvas.getObjects().find(value => value.id === 'UB5302287_UDHB4114_ROW0');
      return { count: canvas.getObjects().length, title: { text: title.text, fontSize: title.fontSize, top: title.top, width: title.width }, year: { text: year.text, visible: year.visible } };
    });
    await page.screenshot({ path: path.join(shots, 'mvp4-original-view.png'), fullPage: true });

    const deleteStarted = Date.now();
    await page.click('#delete-candidate');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Change Set cs_'), { timeout: 15000 });
    performance.candidateDeleteMs = Date.now() - deleteStarted;
    candidateId = null;
    await page.screenshot({ path: path.join(shots, 'mvp4-candidate-deleted.png'), fullPage: true });
    performance.totalMs = Date.now() - totalStarted;
    result.candidate = candidate;
    result.original = original;
    result.patchCount = 4;
    result.success = candidate.count === 179 && candidate.title.text === '  2026년 연도별 실적보고서' && candidate.title.fontSize === 30 && candidate.title.width === 440 && candidate.year.present === false && original.count === 180 && original.title.text === '  연도별 실적보고서' && original.title.fontSize === 32 && original.title.width === 425 && original.year.visible !== false;
  } catch (error) {
    result.success = false;
    result.error = { message: error.message, stack: error.stack };
    if (candidateId) try { await fetch(`${base}/api/candidates/${candidateId}`, { method: 'DELETE' }); } catch (_) {}
  } finally {
    if (browser) await browser.close();
    integrity.formAfter = sha(form); integrity.infoAfter = sha(info);
    integrity.formUnchanged = integrity.formBefore === integrity.formAfter;
    integrity.infoUnchanged = integrity.infoBefore === integrity.infoAfter;
    integrity.activeCandidateProjects = fs.readdirSync(path.join(root, 'apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project')).filter(value => /^sample_mvp4_/.test(value));
    integrity.finishedAt = new Date().toISOString(); result.integrity = integrity; result.performance = performance; result.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(logs, 'mvp4-integrity-result.json'), JSON.stringify(integrity, null, 2) + '\n');
    fs.writeFileSync(path.join(logs, 'mvp4-performance.json'), JSON.stringify(performance, null, 2) + '\n');
    fs.writeFileSync(path.join(logs, 'mvp4-e2e-result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.success && integrity.formUnchanged && integrity.infoUnchanged && !integrity.activeCandidateProjects.length ? 0 : 1;
  }
})();
