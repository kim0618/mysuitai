// MySuit AI Studio — Product UI Architecture 1.0 on the real 발주서.hwpx flow:
// brand, White + Green theme, Sidebar, developer 편집하기 vs user 사용자 편집 (same document, same engine).
const fs = require('fs'), path = require('path');
process.env.LD_LIBRARY_PATH = path.resolve(__dirname, '../../runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base = 'http://127.0.0.1:3100', root = path.resolve(__dirname, '../..'), shots = path.join(root, 'screenshots'), logs = path.join(root, 'logs');
const HWPX = path.resolve(root, '../test-input/hwpx/발주서.hwpx');
const result = { steps: {}, errors: [], screenshots: [] };
const check = (name, pass, details) => { result.steps[name] = { pass: Boolean(pass), details }; console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ` ${JSON.stringify(details)}`}`); };
const until = (page, fn, arg, timeout = 30000) => page.waitForFunction(fn, arg, { timeout });
async function shot(page, name) { fs.mkdirSync(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, name) }); result.screenshots.push(name); }
const viewerReady = (page) => until(page, () => (document.querySelector('#viewer')?.contentWindow?.canvasModule?.getCanvas?.(0)?.getObjects?.() || []).filter((o) => /^IMP/.test(o.id || '')).length > 100, null, 60000);
async function clickText(page, text) {
  const p = await page.evaluate((t) => { const f = document.querySelector('#viewer'), w = f.contentWindow, c = w.canvasModule.getCanvas(0), o = c.getObjects().find((x) => x.text === t || (t === 'IMAGE' && /^IMPIMG/.test(x.id || ''))), r = MvpCoordinateAdapter.canvasRectToScreen(w, c, { left: o.left, top: o.top, width: o.width, height: o.height }), fr = f.getBoundingClientRect(); return { x: fr.left + r.left + r.width / 2, y: fr.top + r.top + r.height / 2 }; }, text);
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(700);
}
const rgb = (page, selector, prop) => page.evaluate(([s, p]) => { const el = document.querySelector(s); return el ? getComputedStyle(el)[p] : null; }, [selector, prop]);
const sidebar = (page) => page.evaluate(() => ({ brand: document.querySelector('.ai-brand')?.getAttribute('aria-label'), brandText: document.querySelector('.ai-brand-name')?.textContent, label: document.querySelector('.ai-sidebar')?.getAttribute('aria-label'), menu: [...document.querySelectorAll('.ai-nav-item .ai-nav-label')].map((x) => x.textContent), active: document.querySelector('.ai-nav-item.active .ai-nav-label')?.textContent, title: document.title, favicon: document.querySelector('link[rel=icon]')?.getAttribute('href') }));
const panelText = (page) => page.evaluate(() => document.querySelector('main > aside').innerText);

(async () => {
  if (!fs.existsSync(HWPX)) { console.log('SKIP test-input/hwpx/발주서.hwpx not present'); return; }
  const browser = await chromium.launch({ executablePath: '/home/tjd618/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } }), page = await context.newPage();
    page.on('pageerror', (e) => result.errors.push(e.message));
    // 생성하기
    await page.goto(`${base}/ai-builder/import`, { waitUntil: 'networkidle' });
    const create = await sidebar(page); await shot(page, 'studio-create.png');
    const favicon = await page.request.get(`${base}${create.favicon}`);
    check('1_brandCreate', create.brand === 'MySuit AI Studio' && /MySuit\s*AI Studio/.test(create.brandText) && create.label === 'AI Studio 메뉴' && /MySuit AI Studio/.test(create.title) && favicon.status() === 200 && !(await page.content()).includes('AI Builder<'), { create, favicon: favicon.status() });
    check('2_sidebarMenu', create.menu.join('|') === '생성하기|편집하기|사용자 편집|내 작업|템플릿|설정' && create.active === '생성하기', create);
    await page.setInputFiles('#document-file', HWPX);
    await until(page, () => !document.querySelector('#create-form').disabled);
    await Promise.all([page.waitForURL(/\/ai-builder\?/, { timeout: 90000 }), page.click('#create-form')]);
    const devUrl = page.url().replace(base, ''); result.devUrl = devUrl;
    await viewerReady(page); await page.waitForTimeout(800);

    // 편집하기 (developer)
    const dev = await sidebar(page), devTabs = await page.evaluate(() => [...document.querySelectorAll('.builder-tab')].map((x) => x.textContent));
    const docTitle = await page.evaluate(() => document.querySelector('#builder-document-name').textContent);
    await page.click('[data-tab=direct]'); await page.waitForTimeout(400);
    const devModes = await page.evaluate(() => [...document.querySelectorAll('[data-control=table-mode] button')].map((x) => x.textContent));
    await page.click('[data-tab=binding]'); await until(page, () => document.querySelector('#builder-binding-body')?.innerText.length > 0);
    const devData = await page.evaluate(() => ({ visible: !document.querySelector('.builder-data').hidden, json: Boolean(document.querySelector('#workspace-json-direct')) }));
    await page.click('[data-tab=direct]'); await page.waitForTimeout(300); await shot(page, 'studio-developer-edit.png');
    check('3_9_developerEdit', dev.active === '편집하기' && /편집하기 · MySuit AI Studio/.test(dev.title) && devTabs.join('|') === '속성|데이터' && devModes.join('|') === '셀|행|열' && devData.visible && devData.json && docTitle === '발주서', { dev, devTabs, devModes, devData, docTitle });

    // 사용자 편집: the Sidebar opens the same document on a separate screen.
    await Promise.all([page.waitForURL(/\/ai-builder\/user\?/), page.click('.ai-nav-item[data-route=user]')]);
    const userUrl = page.url().replace(base, ''); await viewerReady(page); await page.waitForTimeout(800);
    const user = await sidebar(page), userTabs = await page.evaluate(() => [...document.querySelectorAll('.builder-tab')].map((x) => x.textContent));
    const sameDoc = new URLSearchParams(userUrl.split('?')[1]).get('projectName') === new URLSearchParams(devUrl.split('?')[1]).get('projectName');
    check('4_5_userScreen', /^\/ai-builder\/user\?/.test(userUrl) && sameDoc && user.active === '사용자 편집' && /사용자 편집 · MySuit AI Studio/.test(user.title), { userUrl, user });
    // 채팅: greeting, user suggestions, honest placeholder reply, no data attach.
    const chat = await page.evaluate(() => ({ text: document.querySelector('.chat-message.assistant').innerText, chips: [...document.querySelectorAll('.chat-suggestions button')].map((x) => x.textContent), attach: Boolean(document.querySelector('.ai-composer .attach')), placeholder: document.querySelector('.ai-composer input').placeholder }));
    await page.fill('.ai-composer input', '제목을 바꿔줘'); await page.click('.chat-send');
    await until(page, () => [...document.querySelectorAll('.chat-message.assistant')].at(-1)?.textContent.includes('AI 연결이 아직 설정되지 않았습니다.'));
    await shot(page, 'studio-user-chat.png');
    check('6_7_userTabsNoData', userTabs.join('|') === '채팅|직접 편집' && !(await page.$('[data-tab=binding]')) && !chat.attach, { userTabs, chat });
    check('8_userChat', /원하는 수정 내용을 말씀해 주세요/.test(chat.text) && chat.chips.join('|') === '제목을 수정해줘|로고 이미지를 바꿔줘|표를 보기 좋게 정리해줘' && chat.placeholder === '원하는 내용을 자연어로 입력해 주세요.', chat);
    // 직접 편집: simple text/image editing, no structure modes, no developer terms or identifiers.
    await page.click('[data-tab=direct]'); await page.waitForTimeout(400);
    const empty = await panelText(page);
    await clickText(page, '발 주 서');
    const textPanel = await panelText(page);
    await clickText(page, 'IMAGE');
    const imagePanel = await panelText(page);
    await shot(page, 'studio-user-direct.png');
    const forbidden = /데이터 연결|JSON|Dataset|DataBand|DIM|UBJF|IMPCL|IMPTB|IMPIMG|원본 ID|고급 설정|셀|행 편집|열 편집/;
    check('7_userNoDeveloperConcepts', !forbidden.test(empty + textPanel + imagePanel) && /문서에서 수정할 문구나 이미지를 선택하세요/.test(empty) && /문구 편집/.test(textPanel) && /이미지 교체/.test(imagePanel) && !(await page.$('[data-control=table-mode]')), { empty, textPanel: textPanel.slice(0, 200), imagePanel: imagePanel.slice(0, 200) });
    // Shared core: a user edit goes through the same operation, history and save.
    await clickText(page, '발 주 서');
    const cursor0 = await page.evaluate(() => window.__mvp58?.state?.cursor ?? -1);
    await page.fill('#builder-inspector textarea[data-key=text]', '구 매 발 주 서'); await page.press('#builder-inspector textarea[data-key=text]', 'Enter');
    await until(page, (c) => (window.__mvp58?.state?.cursor ?? -1) !== c, cursor0);
    await page.click('#history-undo'); await until(page, (c) => (window.__mvp58?.state?.cursor ?? -1) === c, cursor0);
    await page.click('#history-redo'); await until(page, (c) => (window.__mvp58?.state?.cursor ?? -1) > c, cursor0);
    await page.click('#builder-save'); await until(page, () => document.querySelector('#builder-save-state').textContent === '저장 완료', null, 60000);
    await page.goto(base + devUrl, { waitUntil: 'domcontentloaded' }); await viewerReady(page); await page.waitForTimeout(1500);
    const seenInDeveloper = await page.evaluate(() => document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0).getObjects().some((o) => o.text === '구 매 발 주 서'));
    check('10_sharedCoreUndoRedoSave', seenInDeveloper, { seenInDeveloper });

    // 12. White + Green: white sidebar/topbar/panel, mint active item, green primary button and a solid green active tab with white text.
    const theme = { sidebar: await rgb(page, '.ai-sidebar', 'backgroundColor'), topbar: await rgb(page, 'body > header', 'backgroundColor'), panel: await rgb(page, 'main > aside', 'backgroundColor'), active: await rgb(page, '.ai-nav-item.active', 'backgroundColor'), activeText: await rgb(page, '.ai-nav-item.active', 'color'), save: await rgb(page, '#builder-save', 'backgroundColor'), tab: await rgb(page, '.builder-tab[aria-selected=true]', 'backgroundColor'), tabText: await rgb(page, '.builder-tab[aria-selected=true]', 'color'), canvasBg: await rgb(page, 'body.ai-builder', 'backgroundColor') };
    check('12_whiteGreenTheme', theme.sidebar === 'rgb(255, 255, 255)' && theme.topbar === 'rgb(255, 255, 255)' && theme.panel === 'rgb(255, 255, 255)' && theme.active === 'rgb(232, 245, 238)' && theme.activeText === 'rgb(8, 127, 82)' && theme.save === 'rgb(8, 127, 82)' && theme.tab === 'rgb(8, 127, 82)' && theme.tabText === 'rgb(255, 255, 255)' && theme.canvasBg === 'rgb(245, 247, 246)', theme);

    // No document chosen yet: 사용자 편집 offers recent documents instead of the built-in sample.
    const fresh = await browser.newContext({ viewport: { width: 1600, height: 1000 } }), p2 = await fresh.newPage();
    await p2.goto(`${base}/ai-builder/user`, { waitUntil: 'domcontentloaded' }); await until(p2, () => document.querySelectorAll('.studio-document').length > 0 || document.querySelector('.studio-document-empty'));
    const picker = await p2.evaluate(() => ({ heading: document.querySelector('.studio-document-picker h2')?.textContent, docs: document.querySelectorAll('.studio-document').length, first: document.querySelector('.studio-document')?.getAttribute('href'), viewer: document.querySelector('#viewer').getAttribute('src') }));
    await shot(p2, 'studio-user-picker.png');
    check('13_userDocumentChoice', picker.heading === '편집할 문서를 선택하세요' && picker.docs > 0 && /^\/ai-builder\/user\?projectName=import_/.test(picker.first) && picker.viewer === 'about:blank', picker);
    await fresh.close();
    check('noPageErrors', result.errors.length === 0, result.errors);
  } finally { await browser.close(); }
  result.pass = Object.values(result.steps).every((s) => s.pass); result.failed = Object.entries(result.steps).filter(([, s]) => !s.pass).map(([k]) => k);
  fs.mkdirSync(logs, { recursive: true }); fs.writeFileSync(path.join(logs, 'ai-studio-ui-browser.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ pass: result.pass, failed: result.failed }, null, 2));
  if (!result.pass) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exit(1); });
