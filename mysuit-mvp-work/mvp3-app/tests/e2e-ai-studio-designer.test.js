// MySuit AI Studio — Developer Studio Designer 2.0.
// Real flow 생성하기 → 발주서.hwpx → 생성 → 편집하기 for the designer screen, the built-in sample for band
// visualization (imported HWPX has no bands), and 인사.hwpx + JSON for the 데이터 panel and auto binding.
const fs = require('fs'), os = require('os'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const ORDER = path.resolve(root, '../test-input/hwpx/발주서.hwpx'), PERSONNEL = path.resolve(root, '../test-input/hwpx/인사.hwpx');
const result = { steps: {}, errors: [], screenshots: [] };
const check = (name, pass, details) => { result.steps[name] = { pass: Boolean(pass), details }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(details)}`}`); };
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const cursor = (page) => page.evaluate(() => window.__mvp58?.state?.cursor ?? -1);
const viewerReady = (page, min = 100) => until(page, (n) => (document.querySelector('#viewer')?.contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.() || []).length > n, min, 60000);
async function click(page, match) {
  const p = await page.evaluate((m) => { const f = document.querySelector('#viewer'), w = f.contentWindow, c = w.canvasModule.getCanvas(0), o = c.getObjects().find((x) => m.id ? x.id === m.id : m.image ? /^IMPIMG/.test(x.id || '') : x.text === m.text); if (!o) return null; const r = MvpCoordinateAdapter.canvasRectToScreen(w, c, { left: o.left, top: o.top, width: o.width, height: o.height }), fr = f.getBoundingClientRect(); return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; }, match);
  if (!p) throw new Error(`object not found ${JSON.stringify(match)}`);
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(700);
}
const panel = (page) => page.evaluate(() => ({ tabs: [...document.querySelectorAll('.builder-tab')].map((x) => x.textContent), active: document.querySelector('.builder-tab[aria-selected=true]')?.textContent, sections: [...document.querySelectorAll('#builder-inspector h3, #builder-inspector .inspector-collapsible > summary')].map((x) => x.textContent), card: document.querySelector('#builder-inspector .selected-element')?.innerText.replace(/\s+/g, ' '), text: document.querySelector('#builder-inspector').innerText, mode: window.MvpWorkspaceMode?.mode }));
async function create(page, file) {
  await page.goto(`${base}/ai-builder/import`, { waitUntil: 'networkidle' });
  await page.setInputFiles('#document-file', file);
  await until(page, () => !document.querySelector('#create-form').disabled);
  await Promise.all([page.waitForURL(/\/ai-builder\?/, { timeout: 90000 }), page.click('#create-form')]);
  await viewerReady(page); await until(page, () => window.MvpDesignerBands?.info, null, 30000); await page.waitForTimeout(800);
  return page.url().replace(base, '');
}

(async () => {
  if (![ORDER, PERSONNEL].every(fs.existsSync)) { console.log('SKIP test-input/hwpx originals not present'); return; }
  const browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }), page = await context.newPage();
    page.on('pageerror', (e) => result.errors.push(e.message));
    const url = await create(page, ORDER); result.url = url;

    // 1-3. Designer screen: 속성 | 데이터, AI 도우미 drawer instead of a chat tab, tools, preview and save.
    const layout = await page.evaluate(() => ({ tools: [...document.querySelectorAll('.studio-tools .studio-tool')].map((x) => ({ label: x.getAttribute('aria-label'), disabled: x.disabled, pressed: x.getAttribute('aria-pressed') })), top: [...document.querySelectorAll('body>header .header-actions button')].filter((x) => x.offsetParent).map((x) => x.textContent.trim() || x.getAttribute('aria-label')), chatTab: Boolean(document.querySelector('[data-tab=ai]')), drawerHidden: document.querySelector('.studio-assistant')?.hidden, bands: document.querySelector('#viewer').contentWindow.document.querySelectorAll('.studio-band').length }));
    const docPanel = await panel(page);
    await shot(page, 'designer-document.png');
    check('1_2_3_designerLayout', docPanel.tabs.join('|') === '속성|데이터' && docPanel.active === '속성' && !layout.chatTab && layout.drawerHidden === true && layout.top.join('|') === '실행 취소|다시 실행|✦ AI 도우미|미리보기|저장' && layout.tools.map((t) => t.label).join('|') === '선택|밴드 보기|추가 (준비 중)' && layout.tools[2].disabled, { layout, docPanel: docPanel.tabs });
    // Imported HWPX: free form, no invented bands; the document card says so.
    check('bandsFreeFormImported', layout.bands === 0 && layout.tools[1].disabled && /자유 배치 서식/.test(docPanel.text) && /문서/.test(docPanel.sections.join()), { bands: layout.bands, text: docPanel.text.slice(0, 200) });

    // 4-6. Context-sensitive properties.
    await click(page, { text: '발 주 서' });
    const cell = await panel(page);
    await click(page, { image: true });
    const image = await panel(page);
    await shot(page, 'designer-image.png');
    check('5_tableCellProperties', /표 셀/.test(cell.card) && cell.sections.includes('셀 편집') && cell.sections.includes('표') && /행 1 · 열 1/.test(cell.text) && cell.sections.includes('표 위치 및 크기') && !/IMPTB|IMPCL/.test(cell.text.replace(/고급 설정[\s\S]*$/, '')), cell);
    check('6_imageProperties', /이미지/.test(image.card) && !/IMPIMG/.test(image.card) && image.sections[0] === '이미지' && ['크기', '위치', '표시'].every((x) => image.sections.includes(x)) && /이미지 교체/.test(image.text), image);

    // 7-8. Table structure through the table card: this row's editor, multi-selection, button move, undo/redo.
    const packingRowCell = await page.evaluate(() => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find((o) => o.text === 'PACKING CASE').id);
    await click(page, { id: packingRowCell });
    await page.click('[data-action=cell-to-row]'); await until(page, () => window.aiBuilder.state.staticSelection?.type === 'ROW');
    const rowPanel = await panel(page);
    const c0 = await cursor(page);
    await page.click('#builder-inspector [data-action=row-down]'); await until(page, (c) => window.__mvp58.state.cursor !== c, c0);
    await until(page, () => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 6).join() === '0,1,4,5,2,3');
    const c1 = await cursor(page);
    await page.click('#history-undo'); await until(page, (c) => window.__mvp58.state.cursor !== c, c1); await until(page, () => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 6).join() === '0,1,2,3,4,5');
    await page.click('#history-redo'); await until(page, () => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 6).join() === '0,1,4,5,2,3');
    await viewerReady(page); await page.waitForTimeout(1200);
    const next = await page.evaluate(() => window.__mvp12.tables.find((t) => t.sourceTableId === 'IMPTB0005').rows[8].sourceCellIds[1]);
    // Undo/redo may reload the Viewer and drop the selection: select the moved item again, then Shift+click the next one.
    await click(page, { id: packingRowCell }); await until(page, () => window.aiBuilder.state.staticSelection?.type === 'ROW');
    await page.keyboard.down('Shift'); await click(page, { id: next }); await page.keyboard.up('Shift');
    const multi = await page.evaluate(() => window.aiBuilder.state.staticSelection);
    check('7_13_rowEditingUndoRedo', /선택: 3–4행/.test(rowPanel.text) && c1 === c0 + 1, { rowPanel: rowPanel.text.slice(0, 120), c0, c1 });
    check('8_multiSelect', multi?.type === 'ROW' && multi.keys.length >= 4 && multi.contiguous, multi && { keys: multi.keys.length, contiguous: multi.contiguous });

    // 15-16. 미리보기 on the same Viewer; Viewer toolbar chrome follows the Studio accent.
    await page.click('#builder-inspector [data-control=table-mode] [data-value=cell]');
    await page.click('[data-action=preview]'); await page.waitForTimeout(500);
    await click(page, { text: '발 주 서' });
    const preview = await page.evaluate(() => ({ mode: window.MvpWorkspaceMode.mode, aside: getComputedStyle(document.querySelector('main>aside')).display, tools: getComputedStyle(document.querySelector('.studio-tools')).display, selection: window.aiBuilder.state.selection, src: document.querySelector('#viewer').src, label: document.querySelector('[data-action=preview]').textContent }));
    await shot(page, 'designer-preview.png');
    await page.click('[data-action=preview]'); await page.waitForTimeout(400);
    const back = await page.evaluate(() => ({ mode: window.MvpWorkspaceMode.mode, tab: document.querySelector('.builder-tab[aria-selected=true]').textContent }));
    check('15_preview', preview.mode === 'preview' && preview.aside === 'none' && preview.tools === 'none' && !preview.selection && preview.label === '편집으로 돌아가기' && back.mode === 'direct-edit' && back.tab === '속성' && /UView5/.test(preview.src), { preview, back });
    const chrome = await page.evaluate(() => { const d = document.querySelector('#viewer').contentDocument, b = d.querySelector('.edit-tool-wrap .btn.active'); return { style: Boolean(d.getElementById('studio-viewer-chrome')), active: b ? getComputedStyle(b).backgroundColor : null, canvasUntouched: !d.getElementById('studio-viewer-chrome').textContent.includes('canvas') }; });
    check('16_viewerToolbarTheme', chrome.style && chrome.active && !/223, 20, 99|0\.87451/.test(chrome.active) && /8, 127, 82|0\.0313726 0\.498039 0\.321569/.test(chrome.active) && chrome.canvasUntouched, chrome);

    // AI 도우미: a drawer next to the panel; the placeholder policy holds and 속성 stays visible.
    await page.click('[data-action=ai-assistant]'); await page.waitForTimeout(300);
    await page.fill('.studio-assistant .ai-composer input', '이 표를 items 데이터에 연결해줘'); await page.click('.studio-assistant .chat-send');
    await until(page, () => [...document.querySelectorAll('.studio-assistant .chat-message.assistant')].at(-1)?.textContent.includes('AI 연결이 아직 설정되지 않았습니다.'));
    const drawer = await page.evaluate(() => ({ open: !document.querySelector('.studio-assistant').hidden, panelVisible: document.querySelector('main>aside').offsetWidth > 300, tab: document.querySelector('.builder-tab[aria-selected=true]').textContent, mode: window.MvpWorkspaceMode.mode }));
    await shot(page, 'designer-assistant.png');
    await page.click('.studio-assistant-close');
    check('aiAssistantDrawer', drawer.open && drawer.panelVisible && drawer.tab === '속성' && drawer.mode === 'direct-edit', drawer);

    // 14. Save / Reload keep the designer edits.
    await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
    await page.goto(base + url, { waitUntil: 'domcontentloaded' }); await viewerReady(page); await until(page, () => window.__mvp12?.layouts?.IMPTB0005);
    const reloaded = await page.evaluate(() => window.__mvp12.layouts.IMPTB0005.rowOrder.slice(0, 6).join());
    check('14_saveReload', reloaded === '0,1,4,5,2,3', { reloaded });

    // Band visualization on a form that has bands (the built-in sample): overlays with human names, band properties.
    await page.goto(`${base}/ai-builder`, { waitUntil: 'domcontentloaded' }); await until(page, () => window.MvpDesignerBands?.info?.bands?.length > 0, null, 60000); await page.waitForTimeout(1200);
    const bandUi = await page.evaluate(() => ({ overlays: [...document.querySelector('#viewer').contentWindow.document.querySelectorAll('.studio-band .studio-band-label')].map((x) => x.textContent), list: [...document.querySelectorAll('.band-list-item b')].map((x) => x.textContent), errors: document.querySelector('#builder-error')?.hidden }));
    await page.evaluate(() => { const d = document.querySelector('#viewer').contentWindow.document, label = [...d.querySelectorAll('.studio-band-label')].find((x) => x.textContent.startsWith('반복 데이터')); label.click(); });
    await page.waitForTimeout(400);
    const band = await panel(page);
    await shot(page, 'designer-sample-band.png');
    await page.click('[data-tool=bands]'); await page.waitForTimeout(200);
    const hidden = await page.evaluate(() => document.querySelector('#viewer').contentWindow.document.querySelectorAll('.studio-band').length);
    await page.click('[data-tool=bands]');
    check('bandVisualization', bandUi.overlays.length >= 5 && bandUi.overlays.some((x) => /^반복 데이터DataBand/.test(x)) && bandUi.list.includes('페이지 헤더') && bandUi.errors !== false && /반복 데이터/.test(band.card) && /DataBand/.test(band.card) && band.sections.includes('데이터') && /Dataset/.test(band.text) && hidden === 0, { bandUi, card: band.card, hidden });

    // 10-12. 데이터 panel on 인사.hwpx: JSON → dataset tree → 자동 바인딩 → bound values in the Viewer.
    const url2 = await create(page, PERSONNEL);
    await page.click('[data-tab=binding]'); await until(page, () => document.querySelector('#workspace-json-direct'));
    await page.click('#workspace-json-direct');
    await page.fill('#workspace-json-editor textarea', JSON.stringify({ documentNumber: 'UB-HR-2026-07', retention: '10년', manager: '김담당', employeeName: '홍길동' }));
    await page.click('#workspace-json-editor [data-action=json-use]');
    await until(page, () => document.querySelector('.dataset-tree li'));
    const data = await page.evaluate(() => ({ tree: [...document.querySelectorAll('.dataset-tree li')].map((x) => x.innerText.replace(/\s+/g, ' ')), auto: document.querySelector('[data-action=auto-binding]')?.disabled === false, rows: [...document.querySelectorAll('.proposal-row')].map((x) => x.innerText.replace(/\s+/g, ' ')).slice(0, 4) }));
    await shot(page, 'designer-data.png');
    check('10_dataPanel', data.tree.some((x) => /documentNumber/.test(x)) && data.tree.some((x) => /manager/.test(x)) && data.auto && data.rows.some((x) => /%/.test(x)), data);
    await page.click('[data-action=auto-binding]');
    await until(page, () => /UB-HR-2026-07/.test((document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.() || []).map((o) => String(o.text || '').replace(/\s/g, '')).join('|')), null, 60000);
    const applied = await page.evaluate(() => ({ state: document.querySelector('#builder-save-state').textContent, src: document.querySelector('#viewer').src }));
    check('11_12_autoBindingApply', /연결/.test(applied.state) && /_builder_|mvp|import/.test(applied.src), { applied, url2 });
    check('noPageErrors', result.errors.length === 0, result.errors);
  } finally { await browser.close(); }
  result.pass = Object.values(result.steps).every((s) => s.pass); result.failed = Object.entries(result.steps).filter(([, s]) => !s.pass).map(([k]) => k);
  fs.mkdirSync(logs, { recursive: true }); fs.writeFileSync(path.join(logs, 'ai-studio-designer-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed }, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
