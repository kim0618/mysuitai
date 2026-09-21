const fs=require('fs'),path=require('path');
const {chromium}=require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const base='http://127.0.0.1:3100',root=path.resolve(__dirname,'../..');
const logs=path.join(root,'logs'),shots=path.join(root,'screenshots');
const executablePath='/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
for(const dir of[logs,shots])fs.mkdirSync(dir,{recursive:true});
const scope=draft=>({layoutDraftId:draft,projectName:'sample',formName:'sample'});
const query=draft=>new URLSearchParams(scope(draft));
async function clean(draft){for(const endpoint of['structure-operations','history','render-patches'])await fetch(`${base}/api/${endpoint}?${query(draft)}`,{method:'DELETE'}).catch(()=>{})}
const getHistory=draft=>fetch(`${base}/api/history?${query(draft)}`).then(r=>r.json());
const rowState=(page,key)=>page.evaluate(key=>{const row=__mvp52rows.rows.find(x=>x.logicalRowKey===key),map=__mvp52rows.derived(),current=map.get(key),below=[...map.entries()].filter(([k,v])=>k!==key&&v.top>current.top).sort((a,b)=>a[1].top-b[1].top)[0];return{height:current.height,top:current.top,belowKey:below?.[0],belowTop:below?.[1]?.top,rowRole:row.rowRole,memberIds:row.members.map(x=>x.object.id)}},key);
async function load(page,draft){await page.goto(`${base}/?layoutDraftId=${draft}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mvp57&&window.__mvp52rows?.rows?.length===24,{timeout:30000})}
async function scenario(browser,{name,role,scroll=0}){
  const draft=`pre_ai_v11_row_${name}`;await clean(draft);
  const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage(),saves=[];
  page.on('request',request=>{if(request.url().endsWith('/api/structure-operations')&&request.method()==='PUT'){const body=JSON.parse(request.postData()||'{}');if(body.operation==='resizeRow')saves.push(body)}});
  await load(page,draft);await page.click('#review-toggle');
  const frame=page.frames().find(x=>x.url().includes('/UView5/index.jsp'));
  const key=await page.evaluate(role=>__mvp52rows.rows.find(x=>x.rowRole===role).logicalRowKey,role);
  if(scroll){await frame.evaluate(y=>scrollTo(0,y),scroll);await frame.waitForTimeout(200)}
  await page.evaluate(key=>__mvp52rows.select(key),key);
  const edge=frame.locator(`.mvp57-row-boundary[data-row-key="${key}"]`);await edge.waitFor();
  await frame.evaluate(()=>{window.__v11events=[];for(const type of['pointerdown','pointermove','pointerup'])document.addEventListener(type,event=>{if(__v11events.length<40)__v11events.push({type,target:event.target?.className||event.target?.tagName,path:event.composedPath().slice(0,8).map(x=>x?.className||x?.id||x?.tagName).filter(Boolean),clientX:event.clientX,clientY:event.clientY,pageX:event.pageX,pageY:event.pageY,screenX:event.screenX,screenY:event.screenY,pointerId:event.pointerId,captured:event.target?.hasPointerCapture?.(event.pointerId)||false,rowKey:event.target?.dataset?.rowKey||null})},true)});
  const before=await rowState(page,key),box=await edge.boundingBox(),iframeRect=await page.locator('#viewer').boundingBox();
  const details=await edge.evaluate(element=>{const r=element.getBoundingClientRect(),canvas=document.querySelector('canvas.upper-canvas'),cr=canvas.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),style=getComputedStyle(element);return{hitZone:{left:r.left,top:r.top,width:r.width,height:r.height},canvas:{left:cr.left,top:cr.top,width:cr.width,height:cr.height},scrollLeft:window.scrollX,scrollTop:window.scrollY,zoom:canvasModule.getCanvas(0).getZoom(),devicePixelRatio:window.devicePixelRatio,elementFromPoint:{className:hit?.className,rowKey:hit?.dataset?.rowKey},zIndex:style.zIndex,pointerEvents:style.pointerEvents}});
  const x=box.x+box.width/2,y=box.y+box.height/2;
  await page.mouse.move(x,y);if(name==='summary')await page.screenshot({path:path.join(shots,'pre-ai-v11-row-resize-hit.png'),fullPage:true});
  await page.mouse.down();await page.mouse.move(x,y+12,{steps:6});if(name==='summary')await page.screenshot({path:path.join(shots,'pre-ai-v11-row-resizing.png'),fullPage:true});await page.mouse.up();
  await page.waitForFunction(({key,height})=>__mvp52rows.derived().get(key).height===height+12,{key,height:before.height});await page.waitForFunction(()=>__mvp57.lock===null);
  const after=await rowState(page,key),events=await frame.evaluate(()=>__v11events),history=await getHistory(draft);if(name==='summary')await page.screenshot({path:path.join(shots,'pre-ai-v11-row-resized.png'),fullPage:true});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__mvp52rows?.rows?.length===24&&window.__mvp58,{timeout:30000});const reloaded=await rowState(page,key);
  await page.click('#history-undo');await page.waitForFunction(({key,height})=>__mvp52rows.derived().get(key).height===height,{key,height:before.height});const undone=await rowState(page,key);if(name==='summary')await page.screenshot({path:path.join(shots,'pre-ai-v11-row-undo.png'),fullPage:true});
  await page.click('#history-redo');await page.waitForFunction(({key,height})=>__mvp52rows.derived().get(key).height===height+12,{key,height:before.height});const redone=await rowState(page,key);
  const checks={actualBoundaryHit:details.elementFromPoint.className==='mvp57-row-boundary',pointerTarget:events.find(x=>x.type==='pointerdown')?.target==='mvp57-row-boundary',height:after.height===before.height+12,reflow:after.belowTop===before.belowTop+12,saveOnce:saves.length===1,historyOnce:history.events.length===1,reload:reloaded.height===after.height,undo:undone.height===before.height,redo:redone.height===after.height};
  const result={name,draft,key,role,before,after,reloaded,undone,redone,saveCount:saves.length,historyCount:history.events.length,iframeRect,pointer:{topWindow:{x,y},...details,events},checks,success:Object.values(checks).every(Boolean)};
  await context.close();await clean(draft);if(!result.success)throw new Error(JSON.stringify(result));return result;
}
async function failure(browser){
  const draft='pre_ai_v11_row_failure';await clean(draft);const context=await browser.newContext({viewport:{width:1800,height:1200}}),page=await context.newPage();
  await load(page,draft);await page.click('#review-toggle');const frame=page.frames().find(x=>x.url().includes('/UView5/index.jsp')),key=await page.evaluate(()=>__mvp52rows.rows.find(x=>x.rowRole==='SUMMARY').logicalRowKey);await page.evaluate(key=>__mvp52rows.select(key),key);const edge=frame.locator(`.mvp57-row-boundary[data-row-key="${key}"]`);await edge.waitFor();
  await page.route('**/api/structure-operations',async route=>{const request=route.request(),body=JSON.parse(request.postData()||'{}');if(request.method()==='PUT'&&body.operation==='resizeRow')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({success:false,code:'TEST_SAVE_FAILURE',message:'forced row save failure'})});return route.continue()});
  const before=await rowState(page,key),cursor=(await getHistory(draft)).cursor;await edge.hover();const box=await edge.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.down();await page.mouse.move(x,y+12,{steps:6});await page.waitForFunction(({key,height})=>__mvp52rows.derived().get(key).height===height+12,{key,height:before.height});const preview=await rowState(page,key);await page.mouse.up();await page.waitForFunction(()=>__mvp57.lock===null);const after=await rowState(page,key),finalHistory=await getHistory(draft),store=await fetch(`${base}/api/structure-operations?${query(draft)}`).then(r=>r.json());
  const result={before,preview,after,historyCursorBefore:cursor,historyCursorAfter:finalHistory.cursor,structureCount:store.operations.length};result.success=preview.height===before.height+12&&after.height===before.height&&after.belowTop===before.belowTop&&finalHistory.cursor===cursor&&store.operations.length===0;
  await context.close();await clean(draft);if(!result.success)throw new Error(JSON.stringify(result));return result;
}
(async()=>{let browser;try{browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});const saveFailure=await failure(browser),scenarios=[];for(const config of[{name:'fixed',role:'HEADER'},{name:'summary',role:'SUMMARY'},{name:'scroll',role:'SUMMARY',scroll:220}])scenarios.push(await scenario(browser,config));const result={success:true,scenarios,saveFailure};fs.writeFileSync(path.join(logs,'pre-ai-v11-row-direct-resize.json'),JSON.stringify(result,null,2)+'\n');fs.writeFileSync(path.join(logs,'pre-ai-v11-row-save-failure.json'),JSON.stringify(saveFailure,null,2)+'\n');console.log(JSON.stringify(result,null,2))}finally{if(browser)await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
