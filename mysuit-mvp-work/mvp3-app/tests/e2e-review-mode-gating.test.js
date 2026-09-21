const {chromium}=require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base='http://127.0.0.1:3100';
const signature=page=>page.evaluate(()=>{
  const canvas=document.querySelector('#viewer').contentWindow.canvasModule.getCanvas(0);
  return canvas.getObjects().map((o,index)=>({index,id:o.id,left:o.left,top:o.top,width:o.width,height:o.height,visible:o.visible!==false,text:o.text}));
});
(async()=>{let browser;try{
  browser=await chromium.launch({executablePath:'/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1800,height:1100}});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__mvp51&&window.__mvp52rows&&window.__mvp53&&document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.().length===180,{timeout:30000});
  await page.waitForTimeout(800);
  const original=await signature(page),originalTitle=original.find(x=>x.id?.startsWith('LB6417_'))?.text;
  await page.click('#review-toggle');
  await page.waitForFunction(()=>document.querySelector('#review-toggle').getAttribute('aria-pressed')==='true');
  await page.waitForTimeout(500);
  const editing=await signature(page);
  await page.click('#review-toggle');
  await page.waitForFunction(()=>document.querySelector('#review-toggle').getAttribute('aria-pressed')==='false');
  await page.waitForTimeout(500);
  const restored=await signature(page);
  const differences=restored.map((value,index)=>JSON.stringify(value)===JSON.stringify(original[index])?null:{original:original[index],restored:value}).filter(Boolean);
  const result={originalObjects:original.length,originalTitle,editingDiffers:JSON.stringify(editing)!==JSON.stringify(original),restoredExactly:differences.length===0,restoreDifferenceCount:differences.length,restoreDifferenceSample:differences.slice(0,5),modeOff:await page.locator('#review-toggle').getAttribute('aria-pressed')};
  console.log(JSON.stringify(result,null,2));
  if(original.length!==180||originalTitle!=='  연도별 실적보고서'||!result.restoredExactly||result.modeOff!=='false')throw new Error(`review mode gating failed ${JSON.stringify(result)}`);
}finally{if(browser)await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
