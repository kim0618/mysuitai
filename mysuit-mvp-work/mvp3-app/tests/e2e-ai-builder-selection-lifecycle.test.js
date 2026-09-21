// Direct Edit Selection Lifecycle 3.0.1 on the real 발주서.hwpx flow (생성하기 → 발주서.hwpx → 생성 → 편집하기 → 직접 편집):
// one active selection at a time, focus-out on blank Viewer space, editor controls keep the selection, and no Fabric
// handle or stale pixel survives a transition.
const fs = require('fs'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.resolve(root, '../test-input/hwpx/발주서.hwpx');
const result = { steps: {}, errors: [], screenshots: [] };
const check = (name, pass, details) => { result.steps[name] = { pass: Boolean(pass), details }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(details)}`}`); };
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const cellByText = (page, text) => page.evaluate((value) => { const ids = new Set(window.__mvp12.tables.flatMap((t) => t.cells.map((c) => c.viewerObjectId))); return document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => ids.has(o.id) && o.text === value)?.id; }, text);
async function pointOf(page, rect) { return page.evaluate((r) => { const f = document.querySelector('#viewer'), w = f.contentWindow, c = w.canvasModule.getCanvas(0), s = MvpCoordinateAdapter.canvasRectToScreen(w, c, r), fr = f.getBoundingClientRect(); return { x: fr.left + s.left + s.width / 2, y: fr.top + s.top + s.height / 2 }; }, rect); }
async function clickObject(page, id) { const r = await page.evaluate((objectId) => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((x) => x.id === objectId); return o && { left: o.left, top: o.top, width: o.width, height: o.height }; }, id); if (!r) throw new Error(`Viewer object not found: ${id}`); const p = await pointOf(page, r); await page.mouse.click(p.x, p.y); await page.waitForTimeout(500); }
const mode = async (page, key) => { await page.click(`#builder-inspector [data-control=table-mode] [data-value=${key}]`); await page.waitForTimeout(400); };
// Every selection layer, read from its owner.
const layers = (page) => page.evaluate(() => {
  const w = document.querySelector('#viewer').contentWindow, c = w.canvasModule.getCanvas(0), d = w.document, upper = c.upperCanvasEl.getContext('2d').getImageData(0, 0, c.upperCanvasEl.width, c.upperCanvasEl.height).data;
  let ink = 0; for (let i = 3; i < upper.length; i += 4) if (upper[i] > 0) ink++;
  const lowerCtx = c.lowerCanvasEl.getContext('2d'), before = lowerCtx.getImageData(0, 0, c.lowerCanvasEl.width, c.lowerCanvasEl.height).data;
  c.renderAll(); const after = lowerCtx.getImageData(0, 0, c.lowerCanvasEl.width, c.lowerCanvasEl.height).data;
  let stale = 0; for (let i = 0; i < before.length; i += 4) if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) stale++;
  const state = window.aiBuilder.state;
  return { mode: document.querySelector('[data-control=table-mode] [aria-pressed=true]')?.textContent || null, cell: state.selection?.sourceObjectId || null, staticType: state.staticSelection?.type || null, staticIds: state.staticSelection?.ids || [], sourceId: document.querySelector('#source-id')?.textContent.trim(), toolbar: !d.querySelector('#mvp44-toolbar')?.hidden, markers: [...d.querySelectorAll('.mvp12-static-marker')].map((x) => x.textContent), fabricActive: c._activeObject?.id || null, activeFlags: c.getObjects().filter((o) => o.active).map((o) => o.id), upperInk: ink, staleLowerPixels: stale, panel: document.querySelector('#builder-inspector').innerText.replace(/\s+/g, ' ').trim().slice(0, 120), sections: [...document.querySelectorAll('#builder-inspector h3')].map((x) => x.textContent) };
});
const noNative = (l) => !l.fabricActive && l.activeFlags.length === 0 && l.staleLowerPixels === 0;
async function openWorkspace(page, url) {
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await until(page, () => window.__mvp12?.tables?.length > 0 && document.querySelector('#viewer')?.contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMP/.test(o.id || '')).length > 100, null, 60000);
  await page.click('[data-tab=direct]'); await page.waitForTimeout(500);
}

(async () => {
  if (!fs.existsSync(HWPX)) { console.log('SKIP test-input/hwpx/발주서.hwpx not present'); return; }
  const browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage();
    page.on('pageerror', (e) => result.errors.push(e.message));
    await page.goto(`${base}/ai-builder/import`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#document-file', HWPX);
    await until(page, () => !document.querySelector('#create-form').disabled);
    await Promise.all([page.waitForURL(/\/ai-builder\?/, { timeout: 90000 }), page.click('#create-form')]);
    const builderUrl = page.url().replace(base, ''); result.builderUrl = builderUrl;
    await openWorkspace(page, builderUrl);
    const title = await cellByText(page, '발 주 서'), packing = await cellByText(page, 'PACKING CASE');
    const main = await page.evaluate(() => window.__mvp12.tables.find((t) => t.sourceTableId === 'IMPTB0005'));
    const otherRowCell = main.rows[4].sourceCellIds.find((id) => id !== main.rows[4].sourceCellIds[0]);

    // A. Cell → toolbar → blank paper click: everything goes, mode stays 셀.
    await clickObject(page, title); await until(page, (id) => window.aiBuilder.state.selection?.sourceObjectId === id, title);
    const aSelected = await layers(page);
    // Left page margin: tables start at x=20, so x=5 is blank paper.
    const paper = await pointOf(page, { left: 5, top: 600, width: 2, height: 2 });
    await page.mouse.click(paper.x, paper.y); await page.waitForTimeout(600);
    const aBlank = await layers(page);
    await shot(page, 'selection-a-blank-click.png');
    check('A_cellFocusOut', aSelected.cell === title && aSelected.toolbar && !aBlank.cell && !aBlank.toolbar && aBlank.upperInk === 0 && noNative(aBlank) && aBlank.mode === '셀' && aBlank.panel.includes('표에서 편집할 셀을 선택하세요.') && ['—', '-'].includes(aBlank.sourceId), { aSelected, aBlank });
    // Grey area around the page is also workspace outside the document.
    await clickObject(page, packing);
    const grey = await page.evaluate(() => { const f = document.querySelector('#viewer'), cc = f.contentWindow.document.querySelector('.canvas-container').getBoundingClientRect(), fr = f.getBoundingClientRect(); return { x: fr.left + cc.left - 40, y: fr.top + cc.top + 300 }; });
    await page.mouse.click(grey.x, grey.y); await page.waitForTimeout(600);
    const aGrey = await layers(page);
    check('A_greyAreaFocusOut', !aGrey.cell && !aGrey.toolbar && aGrey.upperInk === 0 && noNative(aGrey), aGrey);

    // B. Cell → 행 mode: no cell/Fabric selection, exactly one row band.
    await clickObject(page, packing); await until(page, (id) => window.aiBuilder.state.selection?.sourceObjectId === id, packing);
    await mode(page, 'row');
    const b = await layers(page);
    await shot(page, 'selection-b-cell-to-row.png');
    check('B_cellToRow', !b.cell && b.staticType === 'ROW' && b.staticIds.includes(packing) && !b.toolbar && b.markers.length === 1 && noNative(b) && b.sections.join('|') === '행 편집', b);
    // A row-mode click on a cell must not leave that cell Fabric-active (the □ handle of 3.0).
    await clickObject(page, packing); await until(page, () => window.aiBuilder.state.staticSelection?.type === 'ROW');
    const bClick = await layers(page);
    check('B_rowClickNoHandle', !bClick.cell && bClick.markers.length === 1 && noNative(bClick) && !bClick.toolbar, bClick);

    // C. Row → 열 mode: the row band is gone, one column band remains.
    await mode(page, 'column');
    const c = await layers(page);
    check('C_rowToColumn', c.staticType === 'COLUMN' && c.markers.length === 1 && c.staticIds.includes(packing) && noNative(c) && c.sections.join('|') === '열 편집', c);

    // D. Row → another row: only the new row is highlighted.
    await mode(page, 'row'); await clickObject(page, packing);
    const d1 = await layers(page);
    await clickObject(page, otherRowCell); await until(page, (id) => window.aiBuilder.state.staticSelection?.ids.includes(id), otherRowCell);
    const d2 = await layers(page);
    await shot(page, 'selection-d-other-row.png');
    check('D_otherRow', d1.markers.join() !== d2.markers.join() && d2.markers.length === 1 && d2.staticIds.includes(otherRowCell) && !d2.staticIds.includes(packing) && noNative(d2), { d1: d1.markers, d2 });

    // F. Row → 행 높이 +: the selection stays.
    const fBefore = await layers(page);
    await page.click('#builder-inspector [data-structure=row] [aria-label="행 높이 늘리기"]');
    await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 안 됨');
    await page.waitForTimeout(800);
    const fAfter = await layers(page);
    check('F_rowControlKeepsSelection', fAfter.staticType === 'ROW' && JSON.stringify(fAfter.staticIds) === JSON.stringify(fBefore.staticIds) && fAfter.markers.length === 1 && noNative(fAfter), { fBefore: fBefore.staticIds.slice(0, 3), fAfter });
    // Blank click in 행 mode keeps 행 mode with its empty state.
    await page.mouse.click(paper.x, paper.y); await page.waitForTimeout(600);
    const rowBlank = await layers(page);
    check('rowModeFocusOut', rowBlank.mode === '행' && !rowBlank.staticType && rowBlank.markers.length === 0 && rowBlank.upperInk === 0 && noNative(rowBlank) && rowBlank.panel.includes('표에서 편집할 행을 선택하세요.'), rowBlank);

    // E. Cell → 글자 크기 +: the selection and toolbar stay.
    await mode(page, 'cell'); await clickObject(page, packing); await until(page, (id) => window.aiBuilder.state.selection?.sourceObjectId === id, packing);
    await page.click('#builder-inspector [aria-label="글자 크기 늘리기"]'); await page.waitForTimeout(800);
    const e = await layers(page);
    check('E_cellControlKeepsSelection', e.cell === packing && e.toolbar && e.sections.includes('셀 편집') && !e.fabricActive && e.activeFlags.length === 0, e);
    // The floating toolbar itself keeps the selection too.
    await page.frameLocator('#viewer').locator('#mvp44-toolbar [data-prop=bold]').click(); await page.waitForTimeout(600);
    const eToolbar = await layers(page);
    check('toolbarKeepsSelection', eToolbar.cell === packing && eToolbar.toolbar, eToolbar);

    // Object A → object B (image): only B remains.
    const image = await page.evaluate(() => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => /^IMPIMG/.test(o.id)).id);
    await clickObject(page, image); await until(page, (id) => window.aiBuilder.state.selection?.sourceObjectId === id, image);
    const ab = await layers(page);
    check('otherObjectReplaces', ab.cell === image && !ab.staticType && ab.markers.length === 0 && noNative(ab) && ab.sections.includes('크기'), ab);
    // Row selection, then an image: the row band goes away.
    await mode(page, 'row'); await clickObject(page, packing); await clickObject(page, image); await until(page, (id) => window.aiBuilder.state.selection?.sourceObjectId === id, image);
    const rowThenImage = await layers(page);
    check('rowThenObject', rowThenImage.cell === image && !rowThenImage.staticType && rowThenImage.markers.length === 0 && noNative(rowThenImage), rowThenImage);

    // G. Selection → 채팅: every Direct Edit selection is cleared.
    await clickObject(page, packing);
    await page.click('[data-tab=ai]'); await page.waitForTimeout(600);
    const g = await layers(page);
    check('G_chatClears', !g.cell && !g.staticType && g.markers.length === 0 && !g.toolbar && g.upperInk === 0 && noNative(g), g);
    // H. Back to 직접 편집: the mode is kept, nothing stale.
    await page.click('[data-tab=direct]'); await page.waitForTimeout(600);
    const h = await layers(page);
    await shot(page, 'selection-h-back.png');
    check('H_backToDirect', h.mode === '행' && !h.cell && !h.staticType && h.markers.length === 0 && h.upperInk === 0 && noNative(h) && h.panel.includes('표에서 편집할 행을 선택하세요.'), h);
    // A mode switch after focus-out does not resurrect a forgotten selection.
    await page.mouse.click(paper.x, paper.y); await mode(page, 'column');
    const noResurrect = await layers(page);
    check('noStaleSeedAfterFocusOut', !noResurrect.staticType && noResurrect.markers.length === 0 && noResurrect.panel.includes('표에서 편집할 열을 선택하세요.'), noResurrect);
    check('noPageErrors', result.errors.length === 0, result.errors);
  } finally { await browser.close(); }
  result.pass = Object.values(result.steps).every((s) => s.pass); result.failed = Object.entries(result.steps).filter(([, s]) => !s.pass).map(([k]) => k);
  fs.mkdirSync(logs, { recursive: true }); fs.writeFileSync(path.join(logs, 'ai-builder-selection-lifecycle-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed }, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
