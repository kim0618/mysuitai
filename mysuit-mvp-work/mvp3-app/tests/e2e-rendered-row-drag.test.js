const {chromium}=require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base='http://127.0.0.1:3100',draft='rendered_row_drag_e2e',scope={layoutDraftId:draft,projectName:'sample',formName:'sample'},query=new URLSearchParams(scope);
const key=n=>`tbl:financial-7col|band:grp_0_UDB3195|rendered-row:${n}`;
const tops=page=>page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,__mvp52rows.derived().get(k).top])),[key(0),key(1)]);
(async()=>{let browser;try{
  await fetch(`${base}/api/structure-operations?${query}`,{method:'DELETE'});
  browser=await chromium.launch({executablePath:'/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1800,height:1100}});await page.goto(`${base}/?layoutDraftId=${draft}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mvp57&&window.__mvp52rows?.rows?.length===24&&document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.().length===180,{timeout:30000});
  await page.click('#review-toggle');const frame=page.frameLocator('#viewer'),grip=frame.locator(`.mvp57-row-gutter[data-row-key="${key(0)}"]`);await grip.waitFor();
  const before=await tops(page),box=await grip.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height*1.25,{steps:8});await page.mouse.up();
  await page.waitForFunction(k=>__mvp52rows.operations.some(x=>x.operation==='moveRenderedRow'&&x.logicalRowKey===k),key(0));const moved=await tops(page),stored=await fetch(`${base}/api/structure-operations?${query}`).then(r=>r.json());
  await page.reload();await page.waitForFunction(()=>window.__mvp57&&window.__mvp52rows?.rows?.length===24,{timeout:30000});await page.click('#review-toggle');await page.waitForTimeout(300);const reloaded=await tops(page);
  await page.click('#history-undo');await page.waitForFunction(k=>__mvp52rows.derived().get(k[0]).top===360&&__mvp52rows.derived().get(k[1]).top===387,[key(0),key(1)]);const undone=await tops(page);
  await page.click('#history-redo');await page.waitForFunction(k=>__mvp52rows.derived().get(k[0]).top===387&&__mvp52rows.derived().get(k[1]).top===360,[key(0),key(1)]);const redone=await tops(page);
  const result={before,moved,reloaded,undone,redone,operation:stored.operations.find(x=>x.operation==='moveRenderedRow'),swapped:moved[key(0)]===before[key(1)]&&moved[key(1)]===before[key(0)],replayed:JSON.stringify(reloaded)===JSON.stringify(moved),undoRedo:JSON.stringify(undone)===JSON.stringify(before)&&JSON.stringify(redone)===JSON.stringify(moved)};console.log(JSON.stringify(result,null,2));if(!result.swapped||!result.replayed||!result.undoRedo)throw new Error('rendered row drag/replay/history failed');
}finally{await fetch(`${base}/api/structure-operations?${query}`,{method:'DELETE'}).catch(()=>{});if(browser)await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
