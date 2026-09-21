// Direct Edit Interaction 3.2 on the real 발주서.hwpx flow (생성하기 → 발주서.hwpx → 생성 → 편집하기 → 직접 편집):
// pointer lifecycle, row/column multi-selection with merge groups, drag & drop with structural snap, one history
// transaction per drop, save/reload, focus-out, the sectioned right panel and the free-object magnet.
const fs = require('fs'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const config = require('../src/server/config');
const { readForm, decodedText } = require('../src/server/services/form-patch-service');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.resolve(root, '../test-input/hwpx/발주서.hwpx');
const MAIN = 'IMPTB0005';
const result = { steps: {}, errors: [], screenshots: [] };
const check = (name, pass, details) => { result.steps[name] = { pass: Boolean(pass), details }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(details)}`}`); };
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const historyCursor = (page) => page.evaluate(() => window.__mvp58?.state?.cursor ?? -1);
async function waitCursor(page, previous) { await until(page, (p) => (window.__mvp58?.state?.cursor ?? -1) !== p, previous); return historyCursor(page); }
// Undo/redo may replace the Viewer document; wait until every live imported cell sits where the layout puts it.
const viewerReady = (page) => until(page, () => { const w = document.querySelector('#viewer')?.contentWindow, objects = w?.canvasModule?.getCanvas?.(0)?.getObjects?.() || [], layouts = window.__mvp12?.layouts; if (!layouts || !w.__settledAt) { if (w && objects.length) w.__settledAt = Date.now(); return false; } if (Date.now() - w.__settledAt < 800) return false; return Object.values(layouts).every((l) => l.cells.filter((c) => c.visible).every((c) => { const o = objects.find((x) => x.id === c.id); return o && Math.abs(o.left - (l.x + c.x)) < 1 && Math.abs(o.top - (l.y + c.y)) < 1; })); }, null, 60000);
const order = (page, key = 'rowOrder', table = MAIN) => page.evaluate(([t, k]) => window.__mvp12.layouts[t][k].join(), [table, key]);
const cellByText = (page, text, table = MAIN) => page.evaluate(([value, t]) => { const ids = new Set(window.__mvp12.tables.find((x) => x.sourceTableId === t).cells.map((c) => c.viewerObjectId)); return document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => ids.has(o.id) && o.text === value)?.id; }, [text, table]);
// Builder (host) coordinates of a canvas rectangle's centre.
const hostPoint = (page, rect) => page.evaluate((r) => { const f = document.querySelector('#viewer'), w = f.contentWindow, c = w.canvasModule.getCanvas(0), s = MvpCoordinateAdapter.canvasRectToScreen(w, c, r), fr = f.getBoundingClientRect(); return { x: fr.left + s.left + s.width / 2, y: fr.top + s.top + s.height / 2 }; }, rect);
const objectRect = (page, id) => page.evaluate((objectId) => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((x) => x.id === objectId); return { left: o.left, top: o.top, width: o.width * (o.scaleX || 1), height: o.height * (o.scaleY || 1) }; }, id);
async function click(page, id, modifiers = []) { const p = await hostPoint(page, await objectRect(page, id)); for (const m of modifiers) await page.keyboard.down(m); await page.mouse.click(p.x, p.y); for (const m of modifiers) await page.keyboard.up(m); await page.waitForTimeout(450); }
const mode = async (page, key) => { await page.click(`#builder-inspector [data-control=table-mode] [data-value=${key}]`); await page.waitForTimeout(350); };
const state = (page) => page.evaluate(() => { const d = document.querySelector('#viewer').contentWindow.document, s = window.aiBuilder.state.staticSelection; return { type: s?.type || null, positions: s ? s.keys.map((k) => s.type === 'ROW' ? window.__mvp12.rowPosition(k) : window.__mvp12.columnPosition(k)).sort((a, b) => a - b) : [], markers: [...d.querySelectorAll('.mvp12-static-marker')].map((x) => x.textContent), handles: d.querySelectorAll('.mvp12-drag-handle').length, indicators: d.querySelectorAll('.mvp12-insert-indicator').length, dragging: window.__mvp12.dragging, cursor: d.documentElement.style.cursor + '|' + document.documentElement.style.cursor, meta: document.querySelector('.structure-meta')?.textContent || null, cell: window.aiBuilder.state.selection?.sourceObjectId || null, toolbar: !d.querySelector('#mvp44-toolbar')?.hidden }; });
const handlePoint = (page) => page.evaluate(() => { const f = document.querySelector('#viewer'), n = f.contentWindow.document.querySelector('.mvp12-drag-handle').getBoundingClientRect(), fr = f.getBoundingClientRect(); return { x: fr.left + n.left + n.width / 2, y: fr.top + n.top + n.height / 2 }; });
// Host coordinate of the boundary before position k of a table (row: y, column: x).
const boundaryPoint = (page, k, axis, table = MAIN) => page.evaluate(([pos, ax, t]) => { const l = window.__mvp12.layouts[t], sizes = ax === 'row' ? l.rowHeights : l.columnWidths, at = sizes.slice(0, pos).reduce((a, b) => a + b, 0), f = document.querySelector('#viewer'), w = f.contentWindow, c = w.canvasModule.getCanvas(0), fr = f.getBoundingClientRect(); const r = MvpCoordinateAdapter.canvasRectToScreen(w, c, ax === 'row' ? { left: l.x + 10, top: l.y + at, width: 1, height: 1 } : { left: l.x + at, top: l.y + 5, width: 1, height: 1 }); return { x: fr.left + r.left, y: fr.top + r.top }; }, [k, axis, table]);
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
    const packing = await cellByText(page, 'PACKING CASE'), image = await page.evaluate(() => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => /^IMPIMG/.test(o.id)).id);
    const main = await page.evaluate((t) => window.__mvp12.tables.find((x) => x.sourceTableId === t), MAIN);
    const rowCell = (base) => main.rows[base].sourceCellIds.find((id) => id !== main.rows[base].sourceCellIds[0]) || main.rows[base].sourceCellIds[0];
    const panel = await page.evaluate(() => { const r = document.querySelector('#builder-inspector').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height - 40 }; });

    // 1a. Pointer lifecycle: a table cell never follows the mouse (cell mode drag does not move it).
    const cellBefore = await objectRect(page, packing), cp = await hostPoint(page, cellBefore);
    await page.mouse.move(cp.x, cp.y); await page.mouse.down(); await page.mouse.move(cp.x + 60, cp.y + 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(400);
    const cellAfter = await objectRect(page, packing);
    // 1b. An image drag released over the right panel is cancelled (back in place); later mouse moves do not drag it.
    await page.mouse.click(10, 10);
    const imgBefore = await objectRect(page, image), ip = await hostPoint(page, imgBefore);
    await page.mouse.move(ip.x, ip.y); await page.mouse.down(); await page.mouse.move(ip.x - 30, ip.y + 20, { steps: 5 }); await page.mouse.move(panel.x, panel.y, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(600);
    const imgReleased = await objectRect(page, image);
    await page.mouse.move(ip.x - 200, ip.y + 200, { steps: 8 }); await page.mouse.move(ip.x - 100, ip.y + 300, { steps: 8 }); await page.waitForTimeout(300);
    const imgLater = await objectRect(page, image);
    check('1_pointerNotStuck', cellAfter.left === cellBefore.left && cellAfter.top === cellBefore.top && imgReleased.left === imgBefore.left && imgReleased.top === imgBefore.top && imgLater.left === imgBefore.left && imgLater.top === imgBefore.top, { cellBefore, cellAfter, imgBefore, imgReleased, imgLater });
    if (imgReleased.left !== imgBefore.left || imgReleased.top !== imgBefore.top) { let c = await historyCursor(page); await page.click('#history-undo'); await waitCursor(page, c); await viewerReady(page); }

    // 2-4. Row selection: click = merge group, Shift = contiguous range, Ctrl = add/remove.
    await mode(page, 'row');
    await click(page, packing); const single = await state(page);
    await click(page, rowCell(4), ['Shift']); const range = await state(page);
    await click(page, rowCell(8), ['Control']); const additive = await state(page);
    await click(page, rowCell(8), ['Control']); const removed = await state(page);
    await shot(page, 'interaction-multi-select.png');
    check('2_rowSingleSelectIsGroup', JSON.stringify(single.positions) === '[2,3]' && single.markers.join() === '3–4' && single.handles === 1 && single.meta === '선택: 3–4행 (2개 행) / 26', single);
    check('3_shiftRange', JSON.stringify(range.positions) === '[2,3,4,5]' && range.markers.join() === '3–6' && range.handles === 1, range);
    check('4_ctrlAdditive', JSON.stringify(additive.positions) === '[2,3,4,5,8,9]' && additive.markers.join() === '3–6,9–10' && additive.handles === 0 && /6개 행/.test(additive.meta) && JSON.stringify(removed.positions) === '[2,3,4,5]', { additive, removed });

    // 5-9, 12-13. Drag the two selected items: insertion line, snap to group boundaries only, one transaction.
    const before = await order(page), cursor0 = await historyCursor(page), hp = await handlePoint(page);
    const inside = await boundaryPoint(page, 11, 'row'), valid = await boundaryPoint(page, 10, 'row');
    await page.mouse.move(hp.x, hp.y); await page.mouse.down();
    await page.mouse.move(hp.x, hp.y + 20, { steps: 4 }); await page.mouse.move(hp.x, inside.y, { steps: 10 }); await page.waitForTimeout(250);
    const insideTarget = await page.evaluate(() => window.__mvp12.dragTarget), during = await state(page);
    await shot(page, 'interaction-row-drag.png');
    await page.mouse.move(hp.x, valid.y + 1, { steps: 4 }); await page.waitForTimeout(200);
    const validTarget = await page.evaluate(() => window.__mvp12.dragTarget);
    await page.mouse.up(); const cursor1 = await waitCursor(page, cursor0);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 12).join() === '0,1,6,7,8,9,2,3,4,5,10,11');
    const dropped = await state(page), after = await order(page);
    const anchors = await page.evaluate(() => { const l = window.__mvp12.layouts.IMPTB0005, objs = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects(), top = (p) => l.rowHeights.slice(0, p).reduce((a, b) => a + b, 0); return ['20', '30'].map((t) => { const o = objs.find((x) => x.text === t && l.cells.some((c) => c.id === x.id)), c = l.cells.find((x) => x.id === o.id); return { t, y: c.y, h: c.height }; }).concat([{ expect20: top(6), expect30: top(8), span: l.rowHeights[6] + l.rowHeights[7] }]); });
    check('5_6_dragShowsInsertionLine', during.dragging && during.indicators === 1 && /grabbing/.test(during.cursor), during);
    check('12_invalidMergeBoundarySkipped', insideTarget && insideTarget.allowed && insideTarget.k % 2 === 0 && validTarget?.k === 10, { insideTarget, validTarget });
    check('7_13_dropMovesWholeGroups', after !== before && anchors[0].y === anchors[2].expect20 && anchors[0].h === anchors[2].span && anchors[1].y === anchors[2].expect30 && JSON.stringify(dropped.positions) === '[6,7,8,9]' && !dropped.dragging && dropped.indicators === 0 && dropped.cursor === '|' && dropped.handles === 1, { before, after, anchors, dropped });
    await page.click('#history-undo'); const cursor2 = await waitCursor(page, cursor1); await until(page, (b) => window.__mvp12.layouts.IMPTB0005.rowOrder.join() === b, before); await viewerReady(page);
    const undone = await order(page);
    await page.click('#history-redo'); const cursor3 = await waitCursor(page, cursor2); await until(page, (a) => window.__mvp12.layouts.IMPTB0005.rowOrder.join() === a, after); await viewerReady(page);
    check('8_9_oneTransaction', cursor1 === cursor0 + 1 && undone === before && cursor2 === cursor0 && cursor3 === cursor1, { cursor0, cursor1, cursor2, cursor3 });

    // Pointer released outside the Viewer (over the right panel) and window blur both end a drag cleanly.
    await click(page, rowCell(6)); const hp2 = await handlePoint(page), c0 = await historyCursor(page);
    await page.mouse.move(hp2.x, hp2.y); await page.mouse.down(); await page.mouse.move(hp2.x, hp2.y + 60, { steps: 5 }); await page.mouse.move(panel.x, panel.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(1200);
    const outside = await state(page);
    await click(page, rowCell(6)); const hp3 = await handlePoint(page);
    await page.mouse.move(hp3.x, hp3.y); await page.mouse.down(); await page.mouse.move(hp3.x, hp3.y + 60, { steps: 5 });
    // The browser window loses focus (headless pages keep focus, so hasFocus is stubbed for this step).
    await page.evaluate(() => { document.hasFocus = () => false; document.querySelector('#viewer').contentWindow.dispatchEvent(new Event('blur')); }); await page.waitForTimeout(300);
    await page.evaluate(() => { delete document.hasFocus; });
    const blurred = await state(page); await page.mouse.up(); await page.waitForTimeout(300);
    check('1c_dragEndsOutsideAndOnBlur', !outside.dragging && outside.indicators === 0 && outside.cursor === '|' && !blurred.dragging && blurred.indicators === 0 && blurred.cursor === '|' && (await historyCursor(page)) === c0, { outside, blurred });
    let cursorNow = await historyCursor(page);

    // Multi-row resize is one history step.
    await click(page, packing); const heightsBefore = await page.evaluate(() => window.__mvp12.layouts.IMPTB0005.rowHeights.join());
    const sel = await state(page);
    await page.click('#builder-inspector [data-structure=row] [aria-label="행 높이 늘리기"]'); const cr = await waitCursor(page, cursorNow);
    await until(page, (h) => window.__mvp12.layouts.IMPTB0005.rowHeights.join() !== h, heightsBefore);
    const heightsAfter = await page.evaluate((p) => p.map((i) => window.__mvp12.layouts.IMPTB0005.rowHeights[i]), sel.positions);
    check('multiResizeOneTransaction', cr === cursorNow + 1 && heightsAfter.every((h) => h === 21), { cursorNow, cr, heightsAfter });
    cursorNow = cr;

    // 16. Right panel: one card with separated groups and a separate danger zone for a single row.
    const infoCell = await page.evaluate(() => window.__mvp12.tables.find((t) => t.sourceTableId === 'IMPTB0003').rows[0].sourceCellIds[0]);
    await click(page, infoCell); await page.waitForTimeout(300);
    const panelUi = await page.evaluate(() => { const card = document.querySelector('#builder-inspector .structure-section'), groups = [...card.querySelectorAll('.structure-group')], cs = getComputedStyle(card); return { heads: [...card.querySelectorAll('h4')].map((x) => x.textContent), cardBorder: cs.borderTopWidth, gaps: groups.map((g) => parseFloat(getComputedStyle(g).paddingTop)), danger: Boolean(card.querySelector('.danger-zone [data-action=row-delete]')) }; });
    await shot(page, 'interaction-right-panel.png');
    check('16_panelSections', panelUi.heads.join('|') === '이동|크기|표시|위험 작업' && panelUi.cardBorder === '1px' && panelUi.gaps.every((g) => g >= 10) && panelUi.danger, panelUi);

    // 11. Column drag: 품명 column one position right, same transaction contract.
    await mode(page, 'column'); await click(page, packing);
    const colBefore = await order(page, 'columnOrder'), hc = await handlePoint(page), colTarget = await boundaryPoint(page, 4, 'column'), cc0 = await historyCursor(page);
    await page.mouse.move(hc.x, hc.y); await page.mouse.down(); await page.mouse.move(hc.x + 20, hc.y, { steps: 4 }); await page.mouse.move(colTarget.x + 1, hc.y, { steps: 8 }); await page.waitForTimeout(200);
    const colDuring = await state(page); await page.mouse.up(); const cc1 = await waitCursor(page, cc0);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,3,2');
    await page.click('#history-undo'); const cc2 = await waitCursor(page, cc1); await until(page, (b) => window.__mvp12.layouts.IMPTB0005.columnOrder.join() === b, colBefore); await viewerReady(page);
    await page.click('#history-redo'); await waitCursor(page, cc2); await until(page, () => window.__mvp12.layouts.IMPTB0005.columnOrder.slice(0, 4).join() === '0,1,3,2'); await viewerReady(page);
    check('11_columnDrag', colDuring.indicators === 1 && cc1 === cc0 + 1 && (await state(page)).positions.join() === '3', { colBefore, colDuring, after: await order(page, 'columnOrder') });

    // 14. Mode switches leave no stale overlay; 15. blank click focus-out.
    await mode(page, 'row'); const toRow = await state(page);
    await mode(page, 'cell'); const toCell = await state(page);
    await mode(page, 'row'); await click(page, packing);
    const paper = await hostPoint(page, { left: 5, top: 600, width: 2, height: 2 });
    await page.mouse.click(paper.x, paper.y); await page.waitForTimeout(500);
    const blank = await state(page);
    check('14_modeSwitchNoStaleOverlay', toRow.type !== 'COLUMN' && toRow.handles <= 1 && toCell.markers.length === 0 && toCell.handles === 0 && !toCell.type, { toRow, toCell });
    check('15_blankFocusOut', !blank.type && blank.markers.length === 0 && blank.handles === 0 && /표에서 편집할 행을 선택하세요/.test(await page.evaluate(() => document.querySelector('#builder-inspector').innerText)), blank);

    // Free-object magnet: dragging the logo near the page centre snaps and shows a guide; the guide clears on drop.
    await mode(page, 'cell');
    const logo = await objectRect(page, image), lp = await hostPoint(page, logo), centre = await hostPoint(page, { left: 397 - logo.width / 2 + 3, top: logo.top, width: logo.width, height: logo.height });
    const hc0 = await historyCursor(page);
    await page.mouse.move(lp.x, lp.y); await page.mouse.down(); await page.mouse.move(lp.x - 10, lp.y, { steps: 3 }); await page.mouse.move(centre.x, centre.y, { steps: 12 }); await page.waitForTimeout(250);
    const guideInk = await page.evaluate(() => { const c = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0), d = c.upperCanvasEl.getContext('2d').getImageData(0, 0, c.upperCanvasEl.width, c.upperCanvasEl.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] > 200 && d[i + 1] < 80 && d[i + 2] > 100) n++; return n; });
    await page.mouse.up(); await page.waitForTimeout(800);
    const snapped = await objectRect(page, image), guideAfter = await page.evaluate(() => { const c = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0), d = c.upperCanvasEl.getContext('2d').getImageData(0, 0, c.upperCanvasEl.width, c.upperCanvasEl.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] > 200 && d[i + 1] < 80 && d[i + 2] > 100) n++; return n; });
    check('freeObjectMagnet', guideInk > 0 && Math.abs(snapped.left + snapped.width / 2 - 397) < 0.51 && guideAfter === 0, { guideInk, snapped, guideAfter });
    if ((await historyCursor(page)) !== hc0) { const c = await historyCursor(page); await page.click('#history-undo'); await waitCursor(page, c); await viewerReady(page); }

    // 10. Save / Reload / new context keep the dropped structure.
    const liveRows = await order(page), liveCols = await order(page, 'columnOrder');
    await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
    const saved = await page.evaluate(() => window.aiBuilder.savedPreview.match(/projectName=([^&]+)/)[1]), form = readForm(path.join(config.projectsRoot, saved, 'SampleReport_FreeForm/form.ubjf')), t = form.pages[0].items.find((x) => x.id === MAIN);
    const savedFirst = t.table.map((row) => row.filter((w) => w.cell).map((w) => decodedText(w.cell.text))[0]).slice(0, 12);
    await page.reload({ waitUntil: 'domcontentloaded' }); await openWorkspace(page, builderUrl);
    const reloaded = [await order(page), await order(page, 'columnOrder')];
    const fresh = await (await browser.newContext({ viewport: { width: 1600, height: 1100 } })).newPage(); await openWorkspace(fresh, builderUrl);
    const freshOrders = [await order(fresh), await order(fresh, 'columnOrder')];
    check('10_saveReload', savedFirst[6] === '20' && savedFirst[8] === '30' && JSON.stringify(reloaded) === JSON.stringify([liveRows, liveCols]) && JSON.stringify(freshOrders) === JSON.stringify([liveRows, liveCols]), { savedFirst, reloaded, liveRows });
    check('noPageErrors', result.errors.length === 0, result.errors);
  } finally { await browser.close(); }
  result.pass = Object.values(result.steps).every((s) => s.pass); result.failed = Object.entries(result.steps).filter(([, s]) => !s.pass).map(([k]) => k);
  fs.mkdirSync(logs, { recursive: true }); fs.writeFileSync(path.join(logs, 'ai-builder-interaction-3-2-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed }, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
