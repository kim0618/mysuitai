const {chromium}=require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base='http://127.0.0.1:3100';
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1500,height:950}}),page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mysuitSession&&window.mvpHistoryBridge?.getState().changeSetId&&document.getElementById('viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.().length===180,{timeout:30000});
  const draft=new URL(page.url()).searchParams.get('layoutDraftId');
  const before=await page.evaluate(()=>({title:document.getElementById('viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x=>String(x.text||'').includes('연도별'))?.text,history:window.__mvp58?.state?.cursor||0,operations:window.__mvp51?.operations?.length||0,renderPatches:window.mvpHistoryBridge.getState().renderPatches.length}));
  await page.click('#review-toggle');await page.waitForTimeout(500);
  const after=await page.evaluate(()=>({title:document.getElementById('viewer').contentWindow.canvasModule.getCanvas(0).getObjects().find(x=>String(x.text||'').includes('연도별'))?.text,history:window.__mvp58?.state?.cursor||0,operations:window.__mvp51?.operations?.length||0,renderPatches:window.mvpHistoryBridge.getState().renderPatches.length,patches:window.mvpHistoryBridge.getState().sourcePatches.length}));
  await page.reload();await page.waitForFunction(()=>window.__mysuitSession&&window.mvpHistoryBridge?.getState().changeSetId,{timeout:30000});
  const reloadDraft=new URL(page.url()).searchParams.get('layoutDraftId');
  const success=/^layout_session_/.test(draft)&&draft!=='layout_sample_default'&&reloadDraft===draft&&before.title?.trim()==='연도별 실적보고서'&&after.title===before.title&&before.history===0&&after.history===0&&after.operations===0&&after.renderPatches===0&&after.patches===0;
  console.log(JSON.stringify({success,draft,reloadDraft,before,after},null,2));if(!success)process.exitCode=1;
}finally{if(browser)await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
