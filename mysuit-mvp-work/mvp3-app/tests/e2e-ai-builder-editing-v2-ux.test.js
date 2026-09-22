// Editing Workspace 2.0 UX cleanup - workspace modes, chat UI and icon-only sidebar toggle.
// Runs against the dev server on :3100 with a fresh HWPX project; writes logs/ai-builder-editing-v2-ux-browser.json.
const fs = require('fs'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const config = require('../src/server/config');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.join(root, 'uploads/ai-builder/ai_builder_import_muavril6_6d066a71/__.hwpx');
const result = { steps: {}, errors: [], screenshots: [] };
let browser, project;

function check(name, value, detail) { result.steps[name] = { pass: Boolean(value), ...(detail === undefined ? {} : { detail }) }; if (!value) console.error('FAIL', name, JSON.stringify(detail)); }
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
// Real mouse click on a Viewer canvas object.
async function clickObject(page, id) {
  const point = await page.evaluate(id => { const frame = document.querySelector('#viewer'), w = frame.contentWindow, c = w.canvasModule.getCanvas(0), o = c.getObjects().find(x => x.id === id), r = MvpCoordinateAdapter.canvasRectToScreen(w, c, { left: o.left, top: o.top, width: o.width, height: o.height }), f = frame.getBoundingClientRect(); return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 }; }, id);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(700);
}
// Everything the Direct Edit capability can put on screen for a selection.
const editingUi = page => page.evaluate(() => { const doc = document.querySelector('#viewer').contentDocument, toolbars = [...doc.querySelectorAll('#mvp44-toolbar')]; return { mode: document.body.dataset.workspaceMode, selected: window.aiBuilder.state.selection?.sourceObjectId || null, sourceId: document.querySelector('#source-id').textContent.trim(), grips: doc.querySelectorAll('.mvp12-static-grip').length, markers: doc.querySelectorAll('.mvp12-static-marker').length, staticSelection: window.aiBuilder.state.staticSelection?.type || null, toolbar: toolbars.some(t => t.getBoundingClientRect().width > 0 && getComputedStyle(t).display !== 'none' && getComputedStyle(t).visibility !== 'hidden'), movable: document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().filter(o => /^IMPCL/.test(o.id || '') && o.hasControls).length, inspector: document.querySelector('#builder-inspector').innerText.slice(0, 40) }; });

(async () => {
  const response = await fetch(`${base}/api/ai-builder/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ document: { name: '인사.hwpx', base64: fs.readFileSync(HWPX).toString('base64') } }) });
  project = await response.json(); if (!project.success) throw new Error(JSON.stringify(project));
  browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.on('pageerror', error => result.errors.push(error.message));
  await page.goto(base + project.builderUrl, { waitUntil: 'domcontentloaded' });
  await until(page, () => window.aiBuilder && window.__mvp12?.tables?.length && window.__mvp58?.state && !document.querySelector('#viewer').classList.contains('viewer-loading'), null, 60000);
  await page.waitForTimeout(500);

  // 1. 미리보기 (Designer 2.0 replaced the chat tab): clicking a cell creates no editing selection, overlay or toolbar.
  await page.click('[data-action=preview]');
  await clickObject(page, 'IMPCL0078');
  const chatClick = await editingUi(page);
  await shot(page, 'editing-v2-ux-chat-click.png');
  await page.click('[data-action=preview]');
  check('chatModeNoDirectEdit', chatClick.mode === 'preview' && !chatClick.selected && ['\u2014', '-'].includes(chatClick.sourceId) && chatClick.grips === 0 && !chatClick.toolbar && chatClick.movable === 0, chatClick);

  // 2. Direct Edit tab (셀 mode): the same cell selects normally with toolbar and property panel, no row/column labels.
  await page.click('[data-tab=direct]');
  await clickObject(page, 'IMPCL0078');
  await until(page, () => window.aiBuilder.state.selection?.sourceObjectId === 'IMPCL0078');
  const directClick = await editingUi(page);
  await shot(page, 'editing-v2-ux-direct-click.png');
  check('directModeSelects', directClick.mode === 'direct-edit' && directClick.selected === 'IMPCL0078' && directClick.grips === 0 && directClick.markers === 0 && directClick.toolbar && directClick.inspector.includes('표 셀'), directClick);

  // 3. Selection, then Data Connection: overlays and toolbar disappear, data UI works.
  await page.click('[data-tab=binding]');
  await until(page, () => document.querySelector('.data-empty'));
  const dataTab = await editingUi(page);
  await shot(page, 'editing-v2-ux-data-after-direct.png');
  check('dataModeClearsSelection', dataTab.mode === 'data-binding' && !dataTab.selected && dataTab.grips === 0 && !dataTab.toolbar && dataTab.movable === 0 && await page.isVisible('#workspace-json-direct'), dataTab);
  await clickObject(page, 'IMPCL0083');
  const dataClick = await editingUi(page);
  check('dataModeNoDirectEdit', !dataClick.selected && dataClick.grips === 0 && !dataClick.toolbar, dataClick);

  // 4. Back to Direct Edit: a new selection works and editing still records history.
  await page.click('[data-tab=direct]');
  const back = await editingUi(page);
  // 행 mode: the click selects the row of IMPCL0083 instead of the cell.
  await page.click('#builder-inspector [data-control=table-mode] [data-value=row]');
  await clickObject(page, 'IMPCL0083');
  await until(page, () => window.aiBuilder.state.staticSelection?.type === 'ROW' && window.aiBuilder.state.staticSelection.ids.includes('IMPCL0083'));
  const cursor = await page.evaluate(() => window.__mvp58.state.cursor);
  await page.click('#builder-inspector [data-action=row-down]');
  await until(page, cursor => window.__mvp58.state.cursor !== cursor, cursor);
  await until(page, () => window.__mvp12.layouts.IMPTB0003.rowOrder.join() === '0,1,2,4,3,5');
  const again = await editingUi(page);
  check('directModeReentry', back.inspector.includes('선택하세요') && !again.selected && again.staticSelection === 'ROW' && again.grips === 0 && again.markers === 1 && !again.toolbar, { back, again });

  // 5-6. AI 도우미 drawer: greeting, chips fill the composer, send shows user + honest AI bubble.
  await page.click('[data-action=ai-assistant]');
  const greeting = await page.evaluate(() => ({ docTitle: window.aiBuilder.state.document?.title, text: document.querySelector('.chat-row.assistant .chat-message').innerText, chips: [...document.querySelectorAll('.chat-suggestions button')].map(x => x.textContent), composerHeight: document.querySelector('.ai-composer').getBoundingClientRect().height, inputHeight: document.querySelector('.ai-composer input').getBoundingClientRect().height, panel: document.querySelector('main>aside').getBoundingClientRect().width, logScrolls: getComputedStyle(document.querySelector('.chat-conversation')).overflowY }));
  await page.click('.chat-suggestions button:nth-child(1)');
  const filled = await page.inputValue('.ai-composer input');
  await page.fill('.ai-composer input', '두 번째 표의 열 너비를 조정해줘');
  await page.click('.chat-send');
  await until(page, () => document.querySelectorAll('.chat-row').length >= 3);
  const bubbles = await page.evaluate(() => [...document.querySelectorAll('.chat-row')].map(row => ({ kind: row.classList.contains('user') ? 'user' : 'assistant', text: row.querySelector('.chat-message p')?.textContent })));
  await shot(page, 'editing-v2-ux-chat.png');
  check('chatGreeting', greeting.text.includes('안녕하세요') && greeting.text.includes(`"${greeting.docTitle}"`) && greeting.docTitle !== project.formName && greeting.chips.join('|') === '표 데이터 연결|반복 데이터|제목 수정|열 너비 조정' && greeting.logScrolls === 'auto' && greeting.panel === 336, greeting);
  check('chatComposerCompact', greeting.composerHeight <= 52 && greeting.inputHeight <= 34, greeting);
  check('chatChipFillsComposer', filled === '이 표를 items 데이터에 연결해줘', { filled });
  check('chatBubbles', bubbles.at(-2)?.kind === 'user' && bubbles.at(-2)?.text === '두 번째 표의 열 너비를 조정해줘' && bubbles.at(-1)?.kind === 'assistant' && bubbles.at(-1)?.text === 'AI 연결이 아직 설정되지 않았습니다.', bubbles);

  // 7-8. Sidebar: icon-only toggle; collapse and expand restore the same layout.
  const sidebar = () => page.evaluate(() => ({ width: document.querySelector('.ai-sidebar').getBoundingClientRect().width, main: document.querySelector('main').getBoundingClientRect().left, toggleText: document.querySelector('.ai-collapse').textContent.trim(), title: document.querySelector('.ai-collapse').title, label: document.querySelector('.ai-collapse').getAttribute('aria-label'), footer: JSON.stringify(document.querySelector('.ai-collapse').getBoundingClientRect()), menu: [...document.querySelectorAll('.ai-nav-item')].map(a => JSON.stringify(a.getBoundingClientRect())).join() }));
  const expanded = await sidebar();
  await page.click('.ai-collapse'); await page.waitForTimeout(350);
  const collapsed = await sidebar();
  await shot(page, 'editing-v2-ux-sidebar-collapsed.png');
  await page.click('.ai-collapse'); await page.waitForTimeout(350);
  const restored = await sidebar();
  check('sidebarIconOnly', expanded.toggleText === '‹' && expanded.title === '메뉴 접기' && !/메뉴 접기/.test(expanded.toggleText), expanded);
  check('sidebarCollapseExpand', collapsed.width === 72 && collapsed.main === 72 && collapsed.label === '메뉴 펼치기' && restored.width === 196 && restored.main === 196 && restored.footer === expanded.footer && restored.menu === expanded.menu, { expanded, collapsed, restored });
  check('noPageErrors', result.errors.length === 0, result.errors);
})().catch(error => { result.fatal = error.stack || String(error); console.error(error); }).finally(async () => {
  if (browser) await browser.close();
  result.pass = !result.fatal && Object.values(result.steps).every(x => x.pass);
  fs.writeFileSync(path.join(logs, 'ai-builder-editing-v2-ux-browser.json'), JSON.stringify(result, null, 2) + '\n');
  if (project?.projectName) {
    for (const dir of fs.readdirSync(config.projectsRoot)) if (dir === project.projectName || dir.startsWith(`${project.projectName}_`)) fs.rmSync(path.join(config.projectsRoot, dir), { recursive: true, force: true });
    fs.rmSync(path.join(root, 'uploads/ai-builder', project.draftId), { recursive: true, force: true });
    for (const name of ['history.json', 'changesets.json', 'structure-operations.json', 'binding-operations.json', 'render-patches.json']) { const file = path.join(config.appRoot, 'data', name); if (!fs.existsSync(file)) continue; const data = JSON.parse(fs.readFileSync(file, 'utf8')), keep = x => x?.layoutDraftId !== project.draftId && x?.draftId !== project.draftId; let clean = data; if (Array.isArray(data)) clean = data.filter(keep); else { clean = { ...data }; for (const [key, value] of Object.entries(clean)) { if (Array.isArray(value)) clean[key] = value.filter(keep); else if (key === 'drafts') clean[key] = Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith(`${project.draftId}|`))); } } fs.writeFileSync(file, JSON.stringify(clean, null, 2) + '\n'); }
  }
  console.log(JSON.stringify({ pass: result.pass, failed: Object.entries(result.steps).filter(([, x]) => !x.pass).map(([k]) => k), fatal: result.fatal?.split('\n')[0] }, null, 2));
  process.exit(result.pass ? 0 : 1);
});
