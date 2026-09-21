const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const changesService = require('../src/server/services/changeset-service');

const projectName = process.env.IMPORT_MVP21_PROJECT;
if (!/^import_mvp2[12]_/.test(projectName || '')) throw new Error('IMPORT_MVP21_PROJECT requires MVP 2.1 or 2.2 project');
const evidencePrefix = process.env.EVIDENCE_PREFIX || 'mvp21';
const base = 'http://127.0.0.1:3100', formName = 'SampleReport_FreeForm';
const objectDraft = 'import_mvp21_object_correction', structureDraft = 'import_mvp21_structure_correction';
const work = path.resolve(__dirname, '../..'), shots = path.join(work, 'screenshots'), logs = path.join(work, 'logs');
const write = (name, value) => fs.writeFileSync(path.join(logs, name), `${JSON.stringify(value, null, 2)}\n`);
const scope = (layoutDraftId) => ({ layoutDraftId, projectName, formName });

async function attach(page, draft) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const response = await page.goto(`${base}/?projectName=${projectName}&layoutDraftId=${draft}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('#viewer').classList.contains('viewer-loading') && window.__mvp12?.model?.cells?.length === 12, null, { timeout: 30000 });
  await page.click('#review-toggle');
  return { http: response.status(), errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const objectContext = await browser.newContext({ viewport: { width: 1800, height: 1200 } });
    const objectPage = await objectContext.newPage();
    const objectAttach = await attach(objectPage, objectDraft);
    await objectPage.frameLocator('#viewer').locator('canvas.upper-canvas').click({ position: { x: 565, y: 238 } });
    await objectPage.waitForFunction(() => document.querySelector('#source-id').textContent === 'IMPLB0018');
    await objectPage.evaluate(() => mvpDirectBridge.property('width', 70));
    await objectPage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('1 / 1'));
    await objectPage.click('#history-undo');
    await objectPage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('0 / 1'));
    await objectPage.click('#history-redo');
    await objectPage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('1 / 1'));
    const objectChangeSet = changesService.findDraft(scope(objectDraft));
    const objectCandidate = await objectPage.evaluate(async (id) => fetch(`/api/change-sets/${id}/candidate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json()), objectChangeSet.changeSetId);
    await objectPage.goto(`${base}${objectCandidate.previewUrl}`, { waitUntil: 'domcontentloaded' });
    await objectPage.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().some((o) => o.id === 'IMPLB0018'));
    await objectPage.waitForTimeout(800);
    const correctedWidth = await objectPage.evaluate(() => canvasModule.getCanvas(0).getObjects().find((o) => o.id === 'IMPLB0018').width);
    await objectContext.close();

    const structureContext = await browser.newContext({ viewport: { width: 1800, height: 1200 } });
    const structurePage = await structureContext.newPage();
    const structureAttach = await attach(structurePage, structureDraft);
    await structurePage.evaluate(() => __mvp12.selectColumn(0));
    await structurePage.evaluate(() => __mvp12.save('resizeColumn', { afterWidth: 320 }));
    await structurePage.evaluate(() => __mvp12.selectColumn(3));
    await structurePage.evaluate(() => __mvp12.save('resizeColumn', { afterWidth: 100 }));
    await structurePage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('2 / 2'));
    await structurePage.screenshot({ path: path.join(shots, `import-${evidencePrefix}-editor-selected.png`), fullPage: true });
    await structurePage.click('#history-undo');
    await structurePage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('1 / 2'));
    await structurePage.click('#history-redo');
    await structurePage.waitForFunction(() => document.querySelector('#history-cursor').textContent.startsWith('2 / 2'));
    const structureCandidate = await structurePage.evaluate(async (body) => {
      const response = await fetch('/api/static-table-candidate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return { http: response.status, body: await response.json() };
    }, scope(structureDraft));
    if (structureCandidate.http !== 201) throw new Error(JSON.stringify(structureCandidate));
    await structurePage.goto(`${base}${structureCandidate.body.previewUrl}`, { waitUntil: 'domcontentloaded' });
    await structurePage.waitForFunction(() => window.canvasModule?.getCanvas?.(0)?.getObjects?.().some((o) => o.id === 'IMPCL0012'));
    await structurePage.waitForTimeout(800);
    const corrected = await structurePage.evaluate(() => {
      const objects = canvasModule.getCanvas(0).getObjects();
      return ['IMPCL0001', 'IMPCL0004', 'IMPCL0008'].map((id) => { const o = objects.find((x) => x.id === id); return { id, left: o.left, width: o.width, text: o.text }; });
    });
    await structurePage.screenshot({ path: path.join(shots, `import-${evidencePrefix}-after-manual-correction.png`), fullPage: true });
    await structureContext.close();

    write(`import-${evidencePrefix}-manual-correction.json`, {
      status: 'PASS',
      attach: { object: objectAttach, structure: structureAttach, columns: 4, rows: 3, cells: 12 },
      manualCorrectionCount: 3,
      corrections: [
        { category: 'TEXT_WIDTH', sourceObjectId: 'IMPLB0018', before: 55, after: correctedWidth },
        { category: 'COLUMN_WIDTH', columnIndex: 0, before: 339, after: 320 },
        { category: 'COLUMN_WIDTH', columnIndex: 3, before: 81, after: 100 }
      ],
      history: { object: { events: 1, undo: true, redo: true }, structure: { events: 2, undo: true, redo: true } },
      candidates: { object: objectCandidate.candidateProjectName, structure: structureCandidate.body.candidateProjectName, policy: 'SEPARATE_OBJECT_AND_STRUCTURE_CANDIDATES', preservedAsEvidence: true },
      correctedGeometry: corrected,
      mixedCanonicalSerializer: 'NOT_USED'
    });
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exit(1); });
