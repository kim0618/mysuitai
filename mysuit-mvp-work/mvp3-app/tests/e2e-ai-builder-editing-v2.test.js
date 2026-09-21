// AI Builder Editing Workspace 2.0 - browser E2E against the running dev server (http://127.0.0.1:3100).
// Creates two fresh projects without JSON (HWPX and DIM), exercises chat/direct/row/column/image/data flows,
// saves, reloads, and writes logs/ai-builder-editing-v2-browser.json plus editing-v2-*.png screenshots.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const config = require('../src/server/config'), importer = require('../src/server/import/import-project-service');
const { readForm, findObjects, decodedText } = require('../src/server/services/form-patch-service');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.join(root, 'uploads/ai-builder/ai_builder_import_muavril6_6d066a71/__.hwpx');
const DIM_SOURCE = path.join(config.projectsRoot, 'import_mvp11_20260916_163646_20decd/ai-builder-import-context.json');
const PNG = path.resolve(root, '../test-input/my-report.png');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const created = [], drafts = [], result = { steps: {}, errors: [], screenshots: [] };
let browser;

async function api(url, options = {}) { const response = await fetch(base + url, { headers: { 'content-type': 'application/json' }, ...options }), body = await response.json(); if (!response.ok || body.success === false) throw Object.assign(new Error(`${url}: ${body.code} ${body.message}`), body); return body; }
async function createProject(input) { const data = await api('/api/ai-builder/import', { method: 'POST', body: JSON.stringify(input) }); created.push(data.projectName); drafts.push(data.draftId); return data; }
function check(name, value, detail) { result.steps[name] = { pass: Boolean(value), ...(detail === undefined ? {} : { detail }) }; if (!value) console.error('FAIL', name, JSON.stringify(detail)); return Boolean(value); }
async function shot(page, name) { await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
// Click a Viewer canvas object through real mouse events at its on-screen center.
async function clickObject(page, id) {
  const point = await page.evaluate(id => { const frame = document.querySelector('#viewer'), w = frame.contentWindow, object = w.canvasModule.getCanvas(0).getObjects().find(o => o.id === id); if (!object) return null; const r = MvpCoordinateAdapter.canvasRectToScreen(w, w.canvasModule.getCanvas(0), { left: object.left, top: object.top, width: object.width, height: object.height }), f = frame.getBoundingClientRect(); return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 }; }, id);
  if (!point) throw new Error(`Viewer object not found: ${id}`);
  await page.mouse.click(point.x, point.y);
  await until(page, id => window.aiBuilder?.state?.selection?.sourceObjectId === id, id);
}
// 셀/행/열 selection mode of the Direct Edit panel; in 행/열 mode a cell click selects its row/column.
async function setMode(page, key) { await page.click(`#builder-inspector [data-control=table-mode] [data-value=${key}]`); await page.waitForTimeout(200); }
async function clickIn(page, id, type) {
  const point = await page.evaluate(id => { const frame = document.querySelector('#viewer'), w = frame.contentWindow, object = w.canvasModule.getCanvas(0).getObjects().find(o => o.id === id); if (!object) return null; const r = MvpCoordinateAdapter.canvasRectToScreen(w, w.canvasModule.getCanvas(0), { left: object.left, top: object.top, width: object.width, height: object.height }), f = frame.getBoundingClientRect(); return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 }; }, id);
  if (!point) throw new Error(`Viewer object not found: ${id}`);
  await page.mouse.click(point.x, point.y);
  await until(page, ([id, type]) => window.aiBuilder?.state?.staticSelection?.type === type && window.aiBuilder.state.staticSelection.ids.includes(id), [id, type]);
}
const objectState = (page, id) => page.evaluate(id => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === id); return o ? { left: o.left, top: o.top, width: o.width, height: o.height, visible: o.visible !== false, text: o.text, scaleType: o.scaleType, src: (o._element || o.getElement?.())?.src?.slice(0, 60) } : null; }, id);
const historyCursor = page => page.evaluate(() => window.__mvp58?.state?.cursor ?? -1);
async function waitCursor(page, previous) { await until(page, previous => (window.__mvp58?.state?.cursor ?? -1) !== previous, previous); return historyCursor(page); }
// Undo/redo may swap the Viewer document. A token on the current Viewer window tells whether it was replaced;
// either way we wait until every live table cell sits where the server layout puts it.
const markViewer = page => page.evaluate(() => { const token = Math.random(); document.querySelector('#viewer').contentWindow.__e2eToken = token; window.__e2eMarkedAt = Date.now(); return token; });
const settled = (page, token) => until(page, token => { const frame = document.querySelector('#viewer'), w = frame.contentWindow, canvas = w?.canvasModule?.getCanvas?.(0), layouts = window.__mvp12?.layouts; if (token !== undefined && w.__e2eToken === token && Date.now() - window.__e2eMarkedAt < 1500) return false; if (!canvas || frame.classList.contains('viewer-loading') || !layouts || w.document.readyState !== 'complete') return false; const objects = new Map(canvas.getObjects().map(o => [o.id, o])); return Object.values(layouts).every(l => l.cells.every(c => { const o = objects.get(c.id); return o && Math.abs(o.left - (l.x + c.x)) < 0.5 && Math.abs(o.top - (l.y + c.y)) < 0.5; })); }, token, 60000);
async function undo(page) { const before = await historyCursor(page), token = await markViewer(page); await page.click('#history-undo'); const cursor = await waitCursor(page, before); await settled(page, token); return cursor; }
async function redo(page) { const before = await historyCursor(page), token = await markViewer(page); await page.click('#history-redo'); const cursor = await waitCursor(page, before); await settled(page, token); return cursor; }
const layoutOf = (page, table) => page.evaluate(table => window.__mvp12.layouts[table], table);
async function openWorkspace(page, url) {
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await until(page, () => window.aiBuilder && window.__mvp12?.tables?.length > 0 && !document.querySelector('#viewer').classList.contains('viewer-loading'), null, 60000);
  await until(page, () => window.__mvp58?.state && window.aiBuilder.state.document, null, 30000);
}
const sidebarMetrics = page => page.evaluate(() => { const q = s => document.querySelector(s), rect = el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, cs = getComputedStyle; const items = [...document.querySelectorAll('.ai-nav-item')]; return { width: rect(q('.ai-sidebar')).w, brand: rect(q('.ai-brand')), brandOverflow: q('.ai-brand').scrollWidth - q('.ai-brand').clientWidth, brandLines: Math.round(q('.ai-brand-name').getBoundingClientRect().height / parseFloat(cs(q('.ai-brand-name')).lineHeight || 18)), menu: items.map(a => a.querySelector('.ai-nav-label').textContent.trim()), menuX: items.map(a => rect(a).x), menuHeight: items.map(a => rect(a).h), fontSizes: items.map(a => cs(a).fontSize), iconSizes: [...document.querySelectorAll('.ai-nav-icon')].map(i => cs(i).fontSize), activeBackground: cs(q('.ai-nav-item.active')).backgroundColor, active: q('.ai-nav-item.active .ai-nav-label').textContent.trim(), footer: rect(q('.ai-collapse')), topbar: rect(q('.ai-topbar')).h }; });

(async () => {
  fs.mkdirSync(shots, { recursive: true }); fs.mkdirSync(logs, { recursive: true });
  // Fixtures: an HWPX document and a DIM-only project, both created without JSON.
  const hwpx = await createProject({ document: { name: '인사.hwpx', base64: fs.readFileSync(HWPX).toString('base64') } });
  const dimContext = JSON.parse(fs.readFileSync(DIM_SOURCE, 'utf8'));
  const dimProject = await createProject({ dim: { raw: JSON.stringify(dimContext.dimPayload), fileName: 'invoice.dim.json' } });
  const originals = Object.fromEntries(created.flatMap(name => ['form.ubjf', 'info.xml'].map(file => { const p = path.join(config.projectsRoot, name, 'SampleReport_FreeForm', file); return [p, sha(p)]; })));
  check('fixturesWithoutJson', !(await api(`/api/ai-builder/context?${new URLSearchParams({ projectName: hwpx.projectName, formName: hwpx.formName, layoutDraftId: hwpx.draftId })}`)).importContext.json, { hwpx: hwpx.projectName, dim: dimProject.projectName });

  browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await context.newPage();
  page.on('pageerror', error => result.errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  await openWorkspace(page, hwpx.builderUrl);
  let viewerLoads = 0; await page.evaluate(() => { window.__viewerLoads = 0; document.querySelector('#viewer').addEventListener('load', () => window.__viewerLoads++); });

  // ---- Shell / layout -------------------------------------------------------------------------------
  const layout = await page.evaluate(() => ({ sidebar: document.querySelector('.ai-sidebar').getBoundingClientRect().width, panel: document.querySelector('main>aside').getBoundingClientRect().width, viewer: document.querySelector('.viewer-pane').getBoundingClientRect().width, iframe: document.querySelector('#viewer').tagName, iframeSrc: document.querySelector('#viewer').getAttribute('src'), tabs: [...document.querySelectorAll('.builder-tab')].map(x => x.textContent), active: document.querySelector('.builder-tab[aria-selected=true]').textContent, topbar: document.querySelector('body>header').getBoundingClientRect().height, topbarControls: [...document.querySelectorAll('body>header button, body>header .builder-save-state')].filter(x => x.offsetParent).map(x => x.getAttribute('aria-label') || x.textContent.trim()), pageScroll: document.scrollingElement.scrollHeight - innerHeight, viewerToolbarsOutside: [...document.querySelectorAll('.viewer-pane>nav')].filter(x => getComputedStyle(x).display !== 'none').length, rawCodeVisible: /[A-Z_]{6,}:/.test(document.body.innerText) }));
  result.layout1440 = layout;
  check('layout1440', layout.sidebar === 184 && layout.panel === 380 && layout.viewer === 1440 - 184 - 380 && layout.iframe === 'IFRAME' && layout.topbar >= 48 && layout.topbar <= 52 && layout.pageScroll <= 0 && layout.viewerToolbarsOutside === 0, layout);
  check('tabOrder', layout.tabs.join('|') === '속성|데이터' && layout.active === '속성', layout.tabs);
  check('topbarControls', JSON.stringify(layout.topbarControls) === JSON.stringify(['실행 취소', '다시 실행', layout.topbarControls[2], '✦ AI 도우미', '미리보기', '저장']) && !/도움말|MS/.test(layout.topbarControls.join()), layout.topbarControls);
  check('noRawErrorCode', !layout.rawCodeVisible);
  const editSidebar = await sidebarMetrics(page);

  // ---- AI 도우미 (drawer) ----------------------------------------------------------------------------
  await page.click('[data-action=ai-assistant]');
  const chat = await page.evaluate(() => ({ composer: Boolean(document.querySelector('.ai-composer input')?.offsetParent), send: document.querySelector('.chat-send').disabled, suggestions: [...document.querySelectorAll('.chat-suggestions button')].map(x => x.textContent), placeholder: /준비 중/.test(document.querySelector('.builder-chat').innerText), empty: document.querySelector('.chat-row.assistant .chat-message')?.innerText || '' }));
  await page.click('.chat-suggestions button:nth-child(3)');
  const suggested = await page.inputValue('.ai-composer input');
  await page.fill('.ai-composer input', '제목을 2026년 인사기록부로 바꿔줘');
  const sendEnabled = await page.evaluate(() => !document.querySelector('.chat-send').disabled);
  await page.click('.chat-send');
  await until(page, () => [...document.querySelectorAll('.chat-message.assistant')].at(-1)?.textContent.includes('AI 연결이 아직 설정되지 않았습니다.'));
  const chatAfter = await page.evaluate(() => ({ user: document.querySelector('.chat-message.user p')?.textContent, time: Boolean(document.querySelector('.chat-message.user time')?.textContent), inputEnabled: !document.querySelector('.ai-composer input').disabled }));
  await shot(page, 'editing-v2-chat.png');
  check('chatProductUi', chat.composer && chat.send && chat.suggestions.length === 4 && !chat.placeholder && chat.empty.includes('안녕하세요') && chat.empty.includes('추천 작업') && suggested.includes('제목') && sendEnabled && chatAfter.user?.includes('2026') && chatAfter.time && chatAfter.inputEnabled, { chat, suggested, chatAfter });

  // ---- Direct: text ----------------------------------------------------------------------------------
  await page.click('[data-tab=direct]');
  const srcBefore = await page.getAttribute('#viewer', 'src');
  await clickObject(page, 'IMPCL0078');
  const textUi = await page.evaluate(() => ({ card: document.querySelector('.selected-element')?.innerText, sections: [...document.querySelectorAll('#builder-inspector h3')].map(x => x.textContent), text: document.querySelector('#builder-inspector textarea[data-key=text]')?.value }));
  let cursor = await historyCursor(page);
  await page.fill('#builder-inspector textarea[data-key=text]', '2020-03-01~2024-12-31');
  await page.press('#builder-inspector textarea[data-key=text]', 'Enter');
  cursor = await waitCursor(page, cursor);
  await until(page, () => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(o => o.id === 'IMPCL0078')?.text === '2020-03-01~2024-12-31');
  const fontBefore = (await objectState(page, 'IMPCL0078'));
  await page.click('#builder-inspector [aria-label="글자 크기 늘리기"]'); cursor = await waitCursor(page, cursor);
  await page.click('#builder-inspector .bold-toggle'); cursor = await waitCursor(page, cursor);
  await page.click('#builder-inspector [aria-label="가로 정렬"] [data-value=left]'); cursor = await waitCursor(page, cursor);
  const styled = await page.evaluate(() => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPCL0078'); return { fontSize: o.fontSize, fontWeight: o.fontWeight, textAlign: o.textAlign }; });
  await shot(page, 'editing-v2-direct-text.png');
  check('textEdit', textUi.sections.includes('셀 편집') && textUi.text === '2019-01-01~2019-01-01' && styled.fontWeight === 'bold' && styled.textAlign === 'left' && styled.fontSize === 11, { textUi, styled, fontBefore });

  // ---- Direct: table row (IMPTB0003 base row 2 holds IMPCL0078) ---------------------------------------
  await setMode(page, 'row'); await clickIn(page, 'IMPCL0078', 'ROW');
  const rowBefore = await layoutOf(page, 'IMPTB0003'), topBefore = (await objectState(page, 'IMPCL0078')).top;
  await page.click('#builder-inspector [data-action=row-down]'); cursor = await waitCursor(page, cursor);
  await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '0,1,3,2,4,5');
  const movedTop = (await objectState(page, 'IMPCL0078')).top;
  cursor = await undo(page); await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '0,1,2,3,4,5');
  const undoneTop = (await objectState(page, 'IMPCL0078')).top;
  cursor = await redo(page); await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '0,1,3,2,4,5');
  const redoneTop = (await objectState(page, 'IMPCL0078')).top;
  check('rowMove', rowBefore.rowOrder.join() === '0,1,2,3,4,5' && movedTop > topBefore && Math.abs(undoneTop - topBefore) < 0.5 && Math.abs(redoneTop - movedTop) < 0.5, { topBefore, movedTop, undoneTop, redoneTop });
  // Height / auto-fit / hide / restore on the same logical row.
  await clickIn(page, 'IMPCL0078', 'ROW');
  await page.fill('#builder-inspector [data-structure=row] input[type=number]', '30'); await page.press('#builder-inspector [data-structure=row] input[type=number]', 'Enter'); cursor = await waitCursor(page, cursor);
  const heightAfter = (await layoutOf(page, 'IMPTB0003')).rowHeights[3];
  await clickIn(page, 'IMPCL0078', 'ROW');
  await page.click('#builder-inspector [data-structure=row] [data-control=row-hide]'); cursor = await waitCursor(page, cursor);
  // The layout applies after the history cursor moves; wait for the Viewer object itself.
  await until(page, v => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(o => o.id === 'IMPCL0078')?.visible === v, false);
  const hidden = await objectState(page, 'IMPCL0078');
  await page.click('#builder-inspector [data-structure=row] [data-control=row-hide]'); cursor = await waitCursor(page, cursor);
  // The layout applies after the history cursor moves; wait for the Viewer object itself.
  await until(page, v => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(o => o.id === 'IMPCL0078')?.visible === v, true);
  const restored = await objectState(page, 'IMPCL0078');
  await shot(page, 'editing-v2-direct-row.png');
  check('rowHeight', heightAfter === 30, { heightAfter });
  check('rowHide', hidden.visible === false && restored.visible === true, { hidden: hidden.visible, restored: restored.visible });
  // Delete a plain row of 봉사활동 (IMPTB0004), then undo restores and redo deletes again.
  const volunteer = await page.evaluate(() => window.__mvp12.tables.find(t => t.sourceTableId === 'IMPTB0004').rows[3].sourceCellIds);
  await clickIn(page, volunteer[0], 'ROW');
  await page.click('#builder-inspector [data-action=row-delete]'); cursor = await waitCursor(page, cursor);
  await until(page, () => window.__mvp12.layouts.IMPTB0004.rowOrder.length === 5);
  const deleted = { order: (await layoutOf(page, 'IMPTB0004')).rowOrder.join(), visible: (await objectState(page, volunteer[0])).visible };
  cursor = await undo(page); await until(page, () => window.__mvp12.layouts.IMPTB0004.rowOrder.length === 6);
  const undeleted = (await objectState(page, volunteer[0])).visible;
  cursor = await redo(page); await until(page, () => window.__mvp12.layouts.IMPTB0004.rowOrder.length === 5);
  check('rowDelete', deleted.order === '0,1,2,4,5' && deleted.visible === false && undeleted === true && (await objectState(page, volunteer[0])).visible === false, { deleted, undeleted });
  // A row inside a vertical merge is selected together with its merge group (IMPCL0013's two lines), and a forced
  // single-row request that would split the merge is refused by the server without recording anything.
  await clickIn(page, 'IMPCL0013', 'ROW');
  const beforeRefusal = await historyCursor(page);
  const refusalUi = await page.evaluate(() => ({ group: window.aiBuilder.state.staticSelection.keys.length, meta: document.querySelector('#builder-inspector .structure-meta')?.textContent || '' }));
  const forced = await page.evaluate(async () => { const t = window.__mvp12.tables.find(x => x.rows.some(r => r.sourceCellIds.includes('IMPCL0013'))), row = t.rows.find(r => r.sourceCellIds.includes('IMPCL0013')), s = window.__mvp12.context, at = window.__mvp12.rowPosition(row.logicalRowKey); const r = await fetch('/api/structure-operations', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ layoutDraftId: new URLSearchParams(location.search).get('layoutDraftId'), projectName: s.projectName, formName: s.formName, operation: 'moveRow', logicalTableKey: t.tableKey, compositeTableKey: t.compositeTableKey, logicalRowKey: row.logicalRowKey, toRowIndex: at - 1 }) }); return { status: r.status, body: await r.json() }; });
  const refusal = forced.body.message;
  check('mergedRowFailClosed', refusalUi.group === 2 && /2개 행/.test(refusalUi.meta) && forced.status === 409 && /병합/.test(refusal) && (await historyCursor(page)) === beforeRefusal && !/[A-Z_]{8,}/.test(refusal), { refusalUi, refusal });

  // ---- Direct: column ---------------------------------------------------------------------------------
  await setMode(page, 'column'); await clickIn(page, 'IMPCL0078', 'COLUMN');
  const colLeftBefore = (await objectState(page, 'IMPCL0078')).left;
  await page.click('#builder-inspector [data-action=column-right]'); cursor = await waitCursor(page, cursor);
  await until(page, () => window.__mvp12.layouts.IMPTB0003.columnOrder.join() === '0,2,1,3,4,5');
  const colLeftAfter = (await objectState(page, 'IMPCL0078')).left;
  await clickIn(page, 'IMPCL0078', 'COLUMN');
  await page.fill('#builder-inspector [data-structure=column] input[type=number]', '150'); await page.press('#builder-inspector [data-structure=column] input[type=number]', 'Enter'); cursor = await waitCursor(page, cursor);
  const colWidth = (await objectState(page, 'IMPCL0078')).width;
  await clickIn(page, 'IMPCL0078', 'COLUMN');
  await shot(page, 'editing-v2-direct-column.png');
  await setMode(page, 'cell');
  check('columnMove', colLeftAfter > colLeftBefore, { colLeftBefore, colLeftAfter });
  check('columnResize', colWidth === 150, { colWidth });

  // ---- Direct: image -----------------------------------------------------------------------------------
  await clickObject(page, 'IMPIMG0001');
  const imageUi = await page.evaluate(() => ({ card: document.querySelector('.selected-element')?.innerText, sections: [...document.querySelectorAll('#builder-inspector h3')].map(x => x.textContent), ratio: document.querySelector('[data-control=ratio-lock]')?.checked, align: Boolean(document.querySelector('[data-control=image-align]')), fit: Boolean(document.querySelector('[data-control=image-fit]')), replace: Boolean(document.querySelector('[data-control=image-replace]')) }));
  const imgBefore = await objectState(page, 'IMPIMG0001');
  await page.fill('#builder-inspector input[data-key=width]', '296'); await page.press('#builder-inspector input[data-key=width]', 'Enter');
  await until(page, () => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPIMG0001'); return o.width === 296 && o.height === 78; });
  cursor = await historyCursor(page);
  await page.click('[data-control=image-align] [data-value=center]'); cursor = await waitCursor(page, cursor);
  const imgCentered = await objectState(page, 'IMPIMG0001');
  await page.click('[data-control=image-fit] [data-value="1"]'); cursor = await waitCursor(page, cursor);
  await page.click('#builder-inspector [data-control=visible]'); cursor = await waitCursor(page, cursor);
  const imgHidden = (await objectState(page, 'IMPIMG0001')).visible;
  await page.click('#builder-inspector [data-control=visible]'); cursor = await waitCursor(page, cursor);
  await page.setInputFiles('[data-control=image-replace]', PNG); cursor = await waitCursor(page, cursor);
  await until(page, () => /\/api\/image-assets\//.test((document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPIMG0001')._element || {}).src || ''));
  const imgReplaced = await objectState(page, 'IMPIMG0001');
  cursor = await undo(page); await until(page, () => !/\/api\/image-assets\//.test((document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPIMG0001')._element || {}).src || ''));
  cursor = await redo(page); await until(page, () => /\/api\/image-assets\//.test((document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPIMG0001')._element || {}).src || ''));
  await clickObject(page, 'IMPIMG0001');
  await shot(page, 'editing-v2-direct-image.png');
  const tableBounds = await page.evaluate(() => { const t = window.__mvp12.tables; return { left: Math.min(...t.map(x => x.x)), right: Math.max(...t.map(x => x.x + x.width)) }; });
  check('imageAdapter', imageUi.card?.includes('이미지') && imageUi.ratio && imageUi.align && imageUi.fit && imageUi.replace && ['크기', '위치', '이미지', '표시'].every(x => imageUi.sections.includes(x)), imageUi);
  check('imageResize', imgBefore.width === 148 && imgBefore.height === 39, { imgBefore });
  check('imagePosition', Math.abs(imgCentered.left - Math.round((tableBounds.left + tableBounds.right - 296) / 2)) <= 1, { imgCentered, tableBounds });
  check('imageVisibility', imgHidden === false);
  check('imageFit', imgReplaced.scaleType === 1, { scaleType: imgReplaced.scaleType });
  check('imageReplace', /\/api\/image-assets\//.test(imgReplaced.src || ''), { src: imgReplaced.src });

  // ---- Save + reload -------------------------------------------------------------------------------------
  const iframeLoadsBeforeSave = await page.evaluate(() => window.__viewerLoads);
  check('tabSwitchKeepsViewer', srcBefore === (await page.getAttribute('#viewer', 'src')), { srcBefore });
  await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
  const saved = await page.evaluate(() => window.aiBuilder.savedPreview.match(/projectName=([^&]+)/)[1]); created.push(saved);
  const savedForm = readForm(path.join(config.projectsRoot, saved, 'SampleReport_FreeForm/form.ubjf')), item = id => findObjects(savedForm.pages, id)[0]?.item;
  const t3 = savedForm.pages[0].items.find(x => x.id === 'IMPTB0003'), t4 = savedForm.pages[0].items.find(x => x.id === 'IMPTB0004'), image = item('IMPIMG0001');
  const savedCheck = { t3Rows: t3.table.map(r => r.find(w => w.cell)?.cell.id).join(), t3Row2: t3.table[2].filter(w => w.cell).map(w => w.cell.id).join(), t4RowCount: t4.rowCount, removedGone: !findObjects(savedForm.pages, volunteer[0]).length, text: decodedText(item('IMPCL0078').text), fontWeight: item('IMPCL0078').fontWeight, colWidth: t3.table[2][1].width, image: { x: image.x, width: image.width, height: image.height, scaleType: image.scaleType, data: decodeURIComponent(image.data).slice(0, 12) === fs.readFileSync(PNG).toString('base64').slice(0, 12) } };
  check('savePass', savedCheck.t4RowCount === 5 && savedCheck.removedGone && savedCheck.text === '2020-03-01~2024-12-31' && savedCheck.fontWeight === 'bold' && savedCheck.t3Row2.startsWith('IMPCL0083') && savedCheck.image.width === 296 && savedCheck.image.height === 78 && savedCheck.image.scaleType === 1 && savedCheck.image.data, savedCheck);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await until(page, () => window.__mvp12?.layouts?.IMPTB0003 && window.__mvp58?.state, null, 60000);
  const reloaded = await page.evaluate(() => ({ rows: window.__mvp12.layouts.IMPTB0003.rowOrder.join(), cols: window.__mvp12.layouts.IMPTB0003.columnOrder.join(), deleted: window.__mvp12.layouts.IMPTB0004.rowOrder.length, cursor: window.__mvp58.state.cursor }));
  await until(page, () => { const o = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x => x.id === 'IMPIMG0001'); return o?.width === 296; });
  check('reloadPass', reloaded.rows === '0,1,3,2,4,5' && reloaded.cols === '0,2,1,3,4,5' && reloaded.deleted === 5, reloaded);
  check('undoRedoPass', ['rowMove', 'rowDelete'].every(x => result.steps[x].pass) && result.steps.imageReplace.pass);

  // ---- Data connection without Import JSON (HWPX project) ----------------------------------------------
  await page.click('[data-tab=binding]');
  await until(page, () => document.querySelector('.data-empty'));
  const empty = await page.evaluate(() => document.querySelector('.data-empty').innerText);
  await shot(page, 'editing-v2-data-empty.png');
  check('dataEmptyState', empty.includes('연결된 데이터가 없습니다.') && empty.includes('JSON 파일 선택') && empty.includes('JSON 직접 입력'), { empty });
  const employee = path.join(require('os').tmpdir(), `employee-${process.pid}.json`);
  fs.writeFileSync(employee, JSON.stringify({ documentNumber: 'UB-HR-2026-07', retention: '10년', manager: '김담당', employeeName: '홍길동' }, null, 2));
  await page.setInputFiles('#workspace-json-file', employee);
  await until(page, () => document.querySelector('.data-source strong')?.textContent.startsWith('employee'));
  const added = await page.evaluate(() => ({ header: document.querySelector('.data-source').innerText, summary: document.querySelector('.proposal-summary').innerText, rows: document.querySelectorAll('.proposal-row').length, auto: window.aiBuilder.state.bindingProposal.summary.auto }));
  await shot(page, 'editing-v2-data-json-added.png');
  check('workspaceJsonUpload', added.header.includes('fields') && added.rows > 0 && added.auto >= 1, added);
  // Manual correction: bind the "UB-HR-001" value cell to $.manager and show its sample value.
  await page.click('.proposal-row[data-target-id=IMPCL0007]');
  await page.selectOption('[data-action=proposal-field]', '$.manager');
  await until(page, () => window.aiBuilder.state.bindingProposal.proposals.find(x => x.targetId === 'IMPCL0007')?.selectedPath === '$.manager');
  const review = await page.evaluate(() => ({ sample: document.querySelector('.proposal-sample').innerText, status: document.querySelector('.proposal-row[data-target-id=IMPCL0007] .proposal-status').textContent }));
  await shot(page, 'editing-v2-data-binding-review.png');
  await page.click('[data-action=binding-apply]');
  await until(page, () => /연결 \d+건 적용됨/.test(document.querySelector('#builder-save-state').textContent), null, 60000);
  await until(page, () => (document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.() || []).some(o => String(o.text || '').replace(/\s/g, '') === 'UB-HR-2026-07'), null, 60000);
  const bound = await page.evaluate(() => { const texts = document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().map(o => String(o.text || '').replace(/\s/g, '')); return { documentNumber: texts.includes('UB-HR-2026-07'), manager: texts.includes('김담당') }; });
  check('scalarBinding', review.sample.includes('김담당') && bound.documentNumber && bound.manager, { review, bound });
  // Removing data that is still bound is refused (no silent dangling binding).
  const removal = await page.evaluate(async scope => { const r = await fetch('/api/ai-builder/context/json', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(scope) }); return { status: r.status, body: await r.json() }; }, { projectName: hwpx.projectName, formName: hwpx.formName, layoutDraftId: hwpx.draftId });
  check('dataRemoveFailClosed', removal.status === 409 && removal.body.code === 'DATA_IN_USE', removal);
  await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
  created.push(await page.evaluate(() => window.aiBuilder.savedPreview.match(/projectName=([^&]+)/)[1]));
  // New browser context keeps the JSON context and the draft (server-side, not browser storage).
  const second = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page2 = await second.newPage();
  await openWorkspace(page2, hwpx.builderUrl); await page2.click('[data-tab=binding]');
  await until(page2, () => document.querySelector('.data-source strong'));
  const persisted = await page2.evaluate(() => ({ file: document.querySelector('.data-source strong').textContent, applied: Boolean(window.aiBuilder.state.bindingProposal?.appliedAt), rows: window.__mvp12.layouts.IMPTB0003.rowOrder.join() }));
  await second.close();
  check('workspaceJsonPersistence', persisted.file.startsWith('employee') && persisted.applied && persisted.rows === '0,1,3,2,4,5', persisted);

  // ---- 1920×1080 ----------------------------------------------------------------------------------------
  await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(300);
  const wide = await page.evaluate(() => ({ sidebar: document.querySelector('.ai-sidebar').getBoundingClientRect().width, panel: document.querySelector('main>aside').getBoundingClientRect().width, viewer: document.querySelector('.viewer-pane').getBoundingClientRect().width, mainHeight: document.querySelector('main').getBoundingClientRect().height, viewport: innerHeight, topbar: document.querySelector('body>header').getBoundingClientRect().height, pageScroll: document.scrollingElement.scrollHeight - innerHeight }));
  result.layout1920 = wide;
  check('layout1920', wide.sidebar === 184 && wide.panel === 380 && wide.viewer === 1920 - 184 - 380 && wide.mainHeight === wide.viewport - wide.topbar && wide.pageScroll <= 0, wide);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- Sidebar visual consistency: 생성하기 vs 편집하기 ----------------------------------------------------
  const importPage = await context.newPage(); await importPage.goto(base + '/ai-builder/import', { waitUntil: 'domcontentloaded' }); await importPage.waitForSelector('.ai-sidebar');
  const createSidebar = await sidebarMetrics(importPage); await importPage.close();
  const same = ['width', 'brand', 'brandOverflow', 'menu', 'menuX', 'menuHeight', 'fontSizes', 'iconSizes', 'activeBackground', 'footer', 'topbar'].filter(key => JSON.stringify(createSidebar[key]) !== JSON.stringify(editSidebar[key]));
  result.sidebar = { create: createSidebar, edit: editSidebar, differences: same };
  check('sidebarVisualConsistency', !same.length && createSidebar.active === '생성하기' && editSidebar.active === '편집하기' && editSidebar.brandOverflow <= 0 && editSidebar.brand.h === 36 && editSidebar.menu.join('|') === '생성하기|편집하기|사용자 편집|내 작업|템플릿|설정', result.sidebar);

  // ---- Direct JSON input + array binding (DIM project without JSON) --------------------------------------
  await openWorkspace(page, dimProject.builderUrl);
  await page.click('[data-tab=binding]'); await until(page, () => document.querySelector('.data-empty'));
  await page.click('#workspace-json-direct');
  await page.fill('#workspace-json-editor textarea', '{"customerName": "ABC상사", "items": [');
  await page.click('[data-action=json-use]');
  await until(page, () => document.querySelector('#workspace-json-status.error'));
  const invalid = await page.evaluate(() => document.querySelector('#workspace-json-status').textContent);
  const stillEmpty = !(await api(`/api/ai-builder/context?${new URLSearchParams({ projectName: dimProject.projectName, formName: dimProject.formName, layoutDraftId: dimProject.draftId })}`)).importContext.json;
  check('invalidJsonSafe', invalid === 'JSON 형식이 올바르지 않습니다.' && stillEmpty, { invalid, stillEmpty });
  await page.fill('#workspace-json-editor textarea', JSON.stringify(JSON.parse(dimContext.json.raw), null, 2));
  await page.click('[data-action=json-use]');
  await until(page, () => document.querySelector('.data-source strong'));
  const direct = await page.evaluate(() => ({ header: document.querySelector('.data-source strong').textContent, scalar: window.aiBuilder.state.bindingProposal.summary, arrays: window.aiBuilder.state.bindingProposal.arrayProposals.map(x => `${x.tableId}:${x.arrayPath}:${x.status}`) }));
  check('workspaceJsonDirectInput', direct.header === '직접 입력 JSON' && direct.scalar.auto >= 1, direct);
  await page.click('[data-action=binding-apply]'); await until(page, () => /연결 \d+건 적용됨/.test(document.querySelector('#builder-save-state').textContent), null, 60000);
  await until(page, () => document.querySelector('[data-action=array-apply]') && !document.querySelector('[data-action=array-apply]').disabled, null, 30000);
  await page.click('[data-action=array-apply]');
  await until(page, () => /반복 데이터 \d+건 연결됨/.test(document.querySelector('#builder-save-state').textContent), null, 60000);
  await until(page, () => (document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.() || []).some(o => String(o.text || '').replace(/\s/g, '') === '상품C'), null, 60000);
  const arrays = await page.evaluate(() => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().filter(o => /^상품[A-C]$/.test(o.text || '')).map(o => o.text));
  check('arrayBinding', direct.arrays.some(x => x.endsWith(':$.items:AUTO')) && ['상품A', '상품B', '상품C'].every(x => arrays.includes(x)), { arrays: direct.arrays, rendered: arrays });

  // ---- Integrity -----------------------------------------------------------------------------------------
  const integrity = Object.entries(originals).map(([file, hash]) => ({ file: path.relative(config.projectsRoot, file), unchanged: sha(file) === hash }));
  check('originalIntegrity', integrity.every(x => x.unchanged), integrity);
  result.viewerLoadsBeforeSave = iframeLoadsBeforeSave;
  result.errors = result.errors.filter(Boolean);
  check('noPageErrors', result.errors.length === 0, result.errors);
})().catch(error => { result.fatal = error.stack || String(error); console.error(error); }).finally(async () => {
  if (browser) await browser.close();
  result.pass = !result.fatal && Object.values(result.steps).every(x => x.pass);
  fs.writeFileSync(path.join(logs, 'ai-builder-editing-v2-browser.json'), JSON.stringify(result, null, 2) + '\n');
  // Cleanup: fixture projects, saved/autobind candidates and draft rows written by this run.
  for (const name of created) { const dir = path.join(config.projectsRoot, name); if (/^import_mvp1[13]_\d{8}_\d{6}_[a-f0-9]{6}(?:_(?:builder|autobind|dyn)[A-Za-z0-9_]*)?$/.test(name) && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); }
  for (const dir of fs.readdirSync(config.projectsRoot)) if (created.some(name => dir.startsWith(`${name}_`))) fs.rmSync(path.join(config.projectsRoot, dir), { recursive: true, force: true });
  for (const draft of drafts) { const staging = path.join(root, 'uploads/ai-builder', draft); if (/^ai_builder_import_[a-z0-9_]+$/.test(draft) && fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true }); }
  for (const name of ['history.json', 'changesets.json', 'structure-operations.json', 'render-patches.json', 'binding-operations.json', 'structural-history.json']) { const file = path.join(config.appRoot, 'data', name); if (!fs.existsSync(file)) continue; const data = JSON.parse(fs.readFileSync(file, 'utf8')), keep = x => !drafts.includes(x?.layoutDraftId) && !drafts.includes(x?.draftId); let clean = data; if (Array.isArray(data)) clean = data.filter(keep); else { clean = { ...data }; for (const [key, value] of Object.entries(clean)) { if (Array.isArray(value)) clean[key] = value.filter(keep); else if (value && typeof value === 'object' && key === 'drafts') clean[key] = Object.fromEntries(Object.entries(value).filter(([k]) => !drafts.some(d => k.startsWith(`${d}|`)))); } } fs.writeFileSync(file, JSON.stringify(clean, null, 2) + '\n'); }
  console.log(JSON.stringify({ pass: result.pass, failed: Object.entries(result.steps).filter(([, x]) => !x.pass).map(([k]) => k), fatal: result.fatal?.split('\n')[0] }, null, 2));
  process.exit(result.pass ? 0 : 1);
});
