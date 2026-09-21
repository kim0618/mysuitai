// Direct Edit UX & Structure Editing 3.0 on the real 발주서.hwpx user flow:
// 생성하기 → 발주서.hwpx → 생성 → 편집하기 → 직접 편집, then cell / row / column selection modes, merge-aware moves,
// undo/redo, save, reload and a new browser context.
const fs = require('fs'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const config = require('../src/server/config');
const { readForm, decodedText } = require('../src/server/services/form-patch-service');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.resolve(root, '../test-input/hwpx/발주서.hwpx');
const MAIN = 'IMPTB0005', INFO = 'IMPTB0003';
const result = { steps: {}, errors: [], screenshots: [] };
const check = (name, pass, details) => { result.steps[name] = { pass: Boolean(pass), details }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(details)}`}`); };
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const historyCursor = (page) => page.evaluate(() => window.__mvp58?.state?.cursor ?? -1);
async function waitCursor(page, previous) { await until(page, (p) => (window.__mvp58?.state?.cursor ?? -1) !== p, previous); return historyCursor(page); }
// Undo/redo may replace the Viewer document; wait until every live imported cell is rendered where the layout puts it.
const viewerReady = (page) => until(page, () => { const w = document.querySelector('#viewer')?.contentWindow, objects = w?.canvasModule?.getCanvas?.(0)?.getObjects?.() || [], layouts = window.__mvp12?.layouts; if (!layouts || !w.__mvp12Settled) { if (w && objects.length) w.__mvp12Settled = Date.now(); return false; } if (Date.now() - w.__mvp12Settled < 800) return false; return Object.values(layouts).every((l) => l.cells.filter((c) => c.visible).every((c) => { const o = objects.find((x) => x.id === c.id); return o && Math.abs(o.left - (l.x + c.x)) < 1 && Math.abs(o.top - (l.y + c.y)) < 1; })); }, null, 60000);
// Pixels, not only object coordinates: every Viewer render records where the imported cells were painted; a move is
// visible only when the last paint matches the current layout.
const trackPaint = (page) => page.evaluate(() => { const w = document.querySelector('#viewer').contentWindow, c = w.canvasModule.getCanvas(0); if (w.__paintTracker) return; w.__paintTracker = true; const snap = () => c.getObjects().filter((o) => /^IMPCL/.test(o.id || '')).map((o) => `${o.id}:${Math.round(o.left)},${Math.round(o.top)}`).join('|'); c.on('after:render', () => { w.__painted = snap(); }); w.__snap = snap; });
const painted = (page) => until(page, () => { const w = document.querySelector('#viewer').contentWindow, l = window.__mvp12.layouts; if (!w.__paintTracker) return false; const now = w.__snap(); return w.__painted === now && Object.values(l).every((t) => t.cells.filter((c) => c.visible).every((c) => now.includes(`${c.id}:${Math.round(t.x + c.x)},${Math.round(t.y + c.y)}`))); }, null, 5000);
const layoutOf = (page, table) => page.evaluate((t) => window.__mvp12.layouts[t], table);
// Text of the first visible cell in each visual row of a table, read from the live Viewer canvas.
const rowTexts = (page, table) => page.evaluate((t) => { const layout = window.__mvp12.layouts[t], objects = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects(); return layout.rowOrder.map((_, p) => { const y = layout.rowHeights.slice(0, p).reduce((n, v) => n + v, 0); const cell = layout.cells.filter((c) => c.y === y && c.visible).sort((a, b) => a.x - b.x)[0]; return cell ? objects.find((o) => o.id === cell.id)?.text : null; }); }, table);
const cellId = (page, table, text) => page.evaluate(([t, value]) => { const model = window.__mvp12.tables.find((x) => x.sourceTableId === t), ids = new Set(model.cells.map((c) => c.viewerObjectId)); return document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => ids.has(o.id) && o.text === value)?.id; }, [table, text]);
async function clickObject(page, id) {
  const point = await page.evaluate((objectId) => { const frame = document.querySelector('#viewer'), w = frame.contentWindow, c = w.canvasModule.getCanvas(0), o = c.getObjects().find((x) => x.id === objectId); if (!o) return null; const r = MvpCoordinateAdapter.canvasRectToScreen(w, c, { left: o.left, top: o.top, width: o.width, height: o.height }), f = frame.getBoundingClientRect(); return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 }; }, id);
  if (!point) throw new Error(`Viewer object not found: ${id}`);
  await page.mouse.click(point.x, point.y);
}
const ui = (page) => page.evaluate(() => { const doc = document.querySelector('#viewer').contentWindow.document; return { grips: doc.querySelectorAll('.mvp12-static-grip').length, markers: [...doc.querySelectorAll('.mvp12-static-marker')].map((x) => x.textContent), toolbar: !doc.querySelector('#mvp44-toolbar')?.hidden, sections: [...document.querySelectorAll('#builder-inspector h3')].map((x) => x.textContent), mode: document.querySelector('[data-control=table-mode] [aria-pressed=true]')?.textContent || null, meta: document.querySelector('.structure-meta')?.textContent || null, note: document.querySelector('.structure-note')?.textContent || null, card: document.querySelector('.selected-element strong')?.textContent || null, cellSelection: window.aiBuilder?.state?.selection?.sourceObjectId || null, static: window.aiBuilder?.state?.staticSelection?.type || null, disabled: [...document.querySelectorAll('.structure-section [data-action]')].filter((b) => b.disabled).map((b) => b.dataset.action), internalIds: /IMPTB\d{4}|tbl:static|R\d+\b|C\d+\b/.test(document.querySelector('#builder-inspector').innerText.replace(/고급 설정[\s\S]*$/, '')) }; });
async function mode(page, key) { await page.click(`[data-control=table-mode] [data-value=${key}]`); await page.waitForTimeout(300); }
async function openWorkspace(page, url) {
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await until(page, () => window.__mvp12?.tables?.length > 0 && document.querySelector('#viewer')?.contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.().filter((o) => /^IMP/.test(o.id || '')).length > 100, null, 60000);
  await page.click('[data-tab=direct]'); await page.waitForTimeout(500);
}
async function saveAndRead(page) {
  await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
  const saved = await page.evaluate(() => window.aiBuilder.savedPreview.match(/projectName=([^&]+)/)[1]);
  const form = readForm(path.join(config.projectsRoot, saved, 'SampleReport_FreeForm/form.ubjf')), table = (id) => form.pages[0].items.find((x) => x.id === id);
  const firstTexts = (id) => table(id).table.map((row) => row.filter((w) => w.cell).map((w) => decodedText(w.cell.text))[0] ?? null);
  return { saved, info: firstTexts(INFO), mainRow1: table(MAIN).table[0].filter((w) => w.cell).map((w) => decodedText(w.cell.text)).slice(0, 3), mainHeaderOrder: table(MAIN).table[0].map((w) => w.cell ? decodedText(w.cell.text) : '·') };
}

(async () => {
  if (!fs.existsSync(HWPX)) { console.log('SKIP test-input/hwpx/발주서.hwpx not present'); return; }
  const browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } }), page = await context.newPage();
    page.on('pageerror', (e) => result.errors.push(e.message));
    // ---- 실제 사용자 흐름: 생성하기 → 발주서.hwpx → 생성 → 편집하기 -----------------------------------------
    await page.goto(`${base}/ai-builder/import`, { waitUntil: 'networkidle' });
    await page.setInputFiles('#document-file', HWPX);
    await until(page, () => !document.querySelector('#create-form').disabled);
    await Promise.all([page.waitForURL(/\/ai-builder\?/, { timeout: 90000 }), page.click('#create-form')]);
    const builderUrl = page.url().replace(base, '');
    await openWorkspace(page, builderUrl); await trackPaint(page);
    result.builderUrl = builderUrl;

    // ---- A. Cell mode ---------------------------------------------------------------------------------
    const packing = await cellId(page, MAIN, 'PACKING CASE');
    await clickObject(page, packing); await until(page, (id) => window.aiBuilder?.state?.selection?.sourceObjectId === id, packing);
    await page.waitForTimeout(500);
    const cell = await ui(page);
    await shot(page, 'structure3-cell-mode.png');
    check('cellMode', cell.mode === '셀' && cell.grips === 0 && cell.markers.length === 0 && cell.toolbar && cell.sections.join('|') === '셀 편집|표|표시' && !cell.internalIds, cell);

    // ---- E. Mode switching: cell → row → column → cell ----------------------------------------------------
    await mode(page, 'row'); const toRow = await ui(page);
    await mode(page, 'column'); const toColumn = await ui(page);
    await mode(page, 'cell'); const toCell = await ui(page);
    check('modeSwitching',
      toRow.static === 'ROW' && !toRow.cellSelection && !toRow.toolbar && toRow.sections.join('|') === '행 편집' && toRow.markers.length === 1 && toRow.meta === '선택: 3–4행 (2개 행) / 26'
      && toColumn.static === 'COLUMN' && !toColumn.toolbar && toColumn.sections.join('|') === '열 편집' && toColumn.markers.length === 1 && toColumn.meta === '현재 열: 3 / 9'
      && !toCell.static && !toCell.cellSelection && toCell.markers.length === 0 && !toCell.sections.some((x) => /셀 편집|행 편집|열 편집/.test(x)) && toCell.grips === 0,
      { toRow, toColumn, toCell });

    // ---- Row mode: a click selects the row, never a cell ----------------------------------------------------
    await mode(page, 'row');
    const info0 = await cellId(page, INFO, '발주일자 :') || await page.evaluate(() => window.__mvp12.tables.find((t) => t.sourceTableId === 'IMPTB0003').cells[0].viewerObjectId);
    await clickObject(page, info0); await until(page, () => window.aiBuilder?.state?.staticSelection?.type === 'ROW');
    const rowClick = await ui(page);
    check('rowModeClick', !rowClick.cellSelection && !rowClick.toolbar && rowClick.meta === '현재 행: 1 / 2' && !rowClick.internalIds && !rowClick.disabled.includes('row-down'), rowClick);

    // ---- B. Row move of a row without merges + Undo / Redo --------------------------------------------------
    const infoBefore = await rowTexts(page, INFO);
    let cursor = await historyCursor(page);
    await page.click('[data-action=row-down]'); cursor = await waitCursor(page, cursor);
    await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '1,0');
    await viewerReady(page); await painted(page);
    const infoAfter = await rowTexts(page, INFO), afterRowUi = await ui(page);
    await shot(page, 'structure3-row-moved.png');
    await page.click('#history-undo'); cursor = await waitCursor(page, cursor); await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '0,1'); await viewerReady(page);
    const infoUndo = await rowTexts(page, INFO);
    await page.click('#history-redo'); cursor = await waitCursor(page, cursor); await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '1,0'); await viewerReady(page);
    const infoRedo = await rowTexts(page, INFO);
    check('rowMoveUndoRedo', infoAfter[0] === infoBefore[1] && infoAfter[1] === infoBefore[0] && afterRowUi.meta === '현재 행: 2 / 2' && JSON.stringify(infoUndo) === JSON.stringify(infoBefore) && JSON.stringify(infoRedo) === JSON.stringify(infoAfter), { infoBefore, infoAfter, infoUndo, infoRedo, meta: afterRowUi.meta });

    // ---- Row group move (main table: 순번 spans the two lines of every item, so an item moves as one group) --------
    await clickObject(page, packing); await until(page, () => window.aiBuilder?.state?.staticSelection?.type === 'ROW');
    const inside = await ui(page);
    const mainBefore = await layoutOf(page, MAIN);
    await trackPaint(page); await page.click('[data-action=row-down]'); cursor = await waitCursor(page, cursor);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 6).join() === '0,1,4,5,2,3'); await viewerReady(page); await painted(page);
    const mainAfter = await layoutOf(page, MAIN), itemAnchor = await page.evaluate(() => { const l = window.__mvp12.layouts.IMPTB0005, o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects(), n = o.find((x) => x.text === '20' && l.cells.some((c) => c.id === x.id)); const c = l.cells.find((x) => x.id === n.id); return { y: c.y, height: c.height, rowTop: l.rowHeights.slice(0, 4).reduce((a, b) => a + b, 0), span: l.rowHeights[4] + l.rowHeights[5] }; });
    check('rowGroupMove', inside.meta === '선택: 3–4행 (2개 행) / 26' && !inside.disabled.includes('row-down') && itemAnchor.y === itemAnchor.rowTop && itemAnchor.height === itemAnchor.span, { inside, before: mainBefore.rowOrder.slice(0, 6), after: mainAfter.rowOrder.slice(0, 6), itemAnchor });

    // ---- C. A move that would split a merge is refused with a plain message ----------------------------------------
    const blocked = await ui(page);
    const serverBlocked = await page.evaluate(async () => { const t = window.__mvp12.tables.find((x) => x.sourceTableId === 'IMPTB0005'), s = window.__mvp12.context; const r = await fetch('/api/structure-operations', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutDraftId: new URLSearchParams(location.search).get('layoutDraftId'), projectName: s.projectName, formName: s.formName, operation: 'moveRow', logicalTableKey: t.tableKey, compositeTableKey: t.compositeTableKey, logicalRowKey: `${t.tableKey}|row:1`, toRowIndex: 2 }) }); return { status: r.status, body: await r.json() }; });
    await shot(page, 'structure3-row-merge-blocked.png');
    check('mergeBlocked', blocked.meta === '선택: 5–6행 (2개 행) / 26' && serverBlocked.status === 409 && serverBlocked.body.code === 'ROWSPAN_DEPENDENCY' && !/의존성|DEPENDENCY/.test(serverBlocked.body.message), { blocked, serverBlocked: { status: serverBlocked.status, code: serverBlocked.body.code, message: serverBlocked.body.message } });

    // ---- D. Column mode: move right, back left (previously rejected), undo / redo -------------------------------
    await mode(page, 'column');
    await clickObject(page, packing); await until(page, () => window.aiBuilder?.state?.staticSelection?.type === 'COLUMN');
    const colUi = await ui(page);
    await trackPaint(page); await page.click('[data-action=column-right]'); cursor = await waitCursor(page, cursor);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,3,2'); await viewerReady(page); await painted(page);
    const colMoved = await ui(page);
    await shot(page, 'structure3-column-moved.png');
    await page.click('[data-action=column-left]'); cursor = await waitCursor(page, cursor);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,2,3');
    await page.click('[data-action=column-right]'); cursor = await waitCursor(page, cursor);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,3,2');
    await page.click('#history-undo'); cursor = await waitCursor(page, cursor); await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,2,3'); await viewerReady(page);
    await page.click('#history-redo'); cursor = await waitCursor(page, cursor); await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,3,2'); await viewerReady(page);
    const packingAt = await page.evaluate((id) => { const l = window.__mvp12.layouts.IMPTB0005, c = l.cells.find((x) => x.id === id); return { x: c.x, expected: l.columnWidths.slice(0, 3).reduce((a, b) => a + b, 0), width: c.width, colWidth: l.columnWidths[3] }; }, packing);
    check('columnMoveUndoRedo', colUi.meta === '현재 열: 3 / 9' && colMoved.meta === '현재 열: 4 / 9' && packingAt.x === packingAt.expected && packingAt.width === packingAt.colWidth, { colUi: colUi.meta, colMoved: colMoved.meta, packingAt });

    // ---- Save / Reload / New context -------------------------------------------------------------------------
    const savedForm = await saveAndRead(page);
    const liveOrders = { info: (await layoutOf(page, INFO)).rowOrder, main: (await layoutOf(page, MAIN)).rowOrder.slice(0, 4), columns: (await layoutOf(page, MAIN)).columnOrder.slice(0, 4) };
    check('save', savedForm.info[0] === infoAfter[0] && savedForm.info[1] === infoAfter[1] && savedForm.mainRow1.length > 0, { savedForm, liveOrders });
    await page.reload({ waitUntil: 'domcontentloaded' }); await openWorkspace(page, builderUrl);
    const reloaded = { info: (await layoutOf(page, INFO)).rowOrder, main: (await layoutOf(page, MAIN)).rowOrder.slice(0, 4), columns: (await layoutOf(page, MAIN)).columnOrder.slice(0, 4), texts: await rowTexts(page, INFO) };
    check('reload', JSON.stringify([reloaded.info, reloaded.main, reloaded.columns]) === JSON.stringify([liveOrders.info, liveOrders.main, liveOrders.columns]) && JSON.stringify(reloaded.texts) === JSON.stringify(infoAfter), reloaded);
    const fresh = await browser.newContext({ viewport: { width: 1600, height: 1100 } }), page2 = await fresh.newPage();
    await openWorkspace(page2, builderUrl);
    const other = { info: (await layoutOf(page2, INFO)).rowOrder, main: (await layoutOf(page2, MAIN)).rowOrder.slice(0, 4), columns: (await layoutOf(page2, MAIN)).columnOrder.slice(0, 4) };
    check('newContext', JSON.stringify(other) === JSON.stringify({ info: liveOrders.info, main: liveOrders.main, columns: liveOrders.columns }), other);
    await fresh.close();

    // ---- Workspace isolation: chat / data tabs drop the table selection -----------------------------------------
    await mode(page, 'row'); await clickObject(page, packing); await until(page, () => window.aiBuilder?.state?.staticSelection?.type === 'ROW');
    await page.click('[data-action=preview]'); await page.waitForTimeout(400);
    const chat = await page.evaluate(() => ({ markers: document.querySelector('#viewer').contentWindow.document.querySelectorAll('.mvp12-static-marker').length, selection: window.aiBuilder?.state?.staticSelection || null }));
    // Leave 미리보기 (the panel is hidden there), reselect the row, then the 데이터 panel must drop it too.
    await page.click('[data-action=preview]'); await page.waitForTimeout(400);
    await clickObject(page, packing); await until(page, () => window.aiBuilder?.state?.staticSelection?.type === 'ROW');
    await page.click('[data-tab=binding]'); await page.waitForTimeout(400);
    const data = await page.evaluate(() => document.querySelector('#viewer').contentWindow.document.querySelectorAll('.mvp12-static-marker').length);
    check('modeIsolation', chat.markers === 0 && !chat.selection && data === 0, { chat, data });
    check('noPageErrors', result.errors.length === 0, result.errors);
  } finally { await browser.close(); }
  result.pass = Object.values(result.steps).every((s) => s.pass); result.failed = Object.entries(result.steps).filter(([, s]) => !s.pass).map(([k]) => k);
  fs.mkdirSync(logs, { recursive: true }); fs.writeFileSync(path.join(logs, 'ai-builder-structure3-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed }, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
