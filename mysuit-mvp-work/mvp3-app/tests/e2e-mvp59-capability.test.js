const { chromium } = require('/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base='http://127.0.0.1:3100',draft='mvp59_e2e',scope={layoutDraftId:draft,projectName:'sample',formName:'sample'},query=new URLSearchParams(scope),root=path.resolve(__dirname,'../..'),logs=path.join(root,'logs'),shots=path.join(root,'screenshots');
const source=path.join(root,'../apache-tomcat-8.5.78/webapps/MYSUIT/UFile/project/sample/sample/form.ubjf'),info=path.join(path.dirname(source),'info.xml'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),write=(name,value)=>fs.writeFileSync(path.join(logs,name),JSON.stringify(value,null,2)+'\n');
process.env.LD_LIBRARY_PATH=path.join(root,'runtime/browser-libs/root/usr/lib/x86_64-linux-gnu');
async function req(url,options={}){const r=await fetch(base+url,{headers:{'content-type':'application/json'},...options}),body=await r.json();return{status:r.status,body}}
async function selectCapability(page,detail){await page.evaluate(value=>window.dispatchEvent(new CustomEvent('mvp:target-selected',{detail:value})),detail);await page.waitForFunction(key=>window.mvpCapability.result?.targetKey===key,detail.targetKey)}
(async()=>{
  let browser;const before={form:sha(source),info:sha(info)},result={success:false,startedAt:new Date().toISOString(),assertions:{}};
  fs.mkdirSync(logs,{recursive:true});fs.mkdirSync(shots,{recursive:true});
  try{
    await req(`/api/structure-operations?${query}`,{method:'DELETE'});await req(`/api/history?${query}`,{method:'DELETE'});
    browser=await chromium.launch({executablePath:'/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1800,height:1150}});await page.goto(`${base}/?layoutDraftId=${draft}`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__mvp51&&window.__mvp52rows&&window.__mvp53&&window.mvpCapability&&document.querySelector('#viewer').contentWindow.canvasModule?.getCanvas?.(0)?.getObjects?.().length===180,{timeout:30000});
    await page.click('#review-toggle');
    await selectCapability(page,{targetType:'LOGICAL_COLUMN',targetKey:'tbl:financial-7col|col:2'});
    const column=await page.evaluate(()=>({target:mvpCapability.result.targetKey,resize:mvpCapability.result.capabilities.resizeColumn,move:mvpCapability.result.capabilities.moveColumn,panel:document.querySelector('#capability-list').innerText}));
    await page.screenshot({path:path.join(shots,'mvp59-column-capability.png'),fullPage:true});
    const common={...scope,draftId:draft,targetType:'LOGICAL_COLUMN',target:{logicalColumnKey:'tbl:financial-7col|col:2'}},overflow=await req('/api/operations/validate',{method:'POST',body:JSON.stringify({...common,operation:'resizeColumn',payload:{width:73}})}),unknown=await req('/api/operations/validate',{method:'POST',body:JSON.stringify({...common,operation:'deleteEverything',payload:{}})}),historyBefore=(await req(`/api/history?${query}`)).body;
    const legacyFailure=await req('/api/structure-operations',{method:'PUT',body:JSON.stringify({...scope,logicalTableKey:'tbl:financial-7col',operation:'resizeColumn',columnIndex:2,afterWidth:73})}),historyAfter=(await req(`/api/history?${query}`)).body;
    await selectCapability(page,{targetType:'LOGICAL_ROW',targetKey:'tbl:financial-7col|band:grp_0_UDB3195|rendered-row:0'});
    const detail=await page.evaluate(()=>({cap:mvpCapability.result.capabilities.resizeRow,buttonDisabled:document.querySelector('#mvp52-row-resize').disabled,panel:document.querySelector('#capability-list').innerText}));
    await page.screenshot({path:path.join(shots,'mvp59-detail-row-blocked.png'),fullPage:true});
    await selectCapability(page,{targetType:'COMPOSITE_TABLE',targetKey:'ctbl:main-report-table'});
    const table=await page.evaluate(()=>({collapse:mvpCapability.result.capabilities.collapseTable,width:mvpCapability.result.capabilities.resizeTableWidth}));
    const direct=await req('/api/structure-operations',{method:'PUT',body:JSON.stringify({...scope,logicalTableKey:'tbl:financial-7col',operation:'hideColumn',columnIndex:6})});
    await page.evaluate(()=>window.__mvp51.loadOps());await page.waitForFunction(()=>window.__mvp51.operations.some(x=>x.operation==='hideColumn'&&x.columnIndex===6));
    const stored=(await req(`/api/structure-operations?${query}`)).body.operations;
    result.assertions={columnAllowed:column.resize.allowed&&column.move.constraints.sameGroupOnly,overflow:overflow.body.code==='TABLE_WIDTH_OVERFLOW',unknown:unknown.body.code==='UNSUPPORTED_OPERATION',failureNoHistory:legacyFailure.body.code==='TABLE_WIDTH_OVERFLOW'&&historyBefore.cursor===historyAfter.cursor,detailBlocked:detail.cap.reason==='DATA_REPEAT_ROW'&&detail.buttonDisabled,tableScope:table.collapse.constraints.support.pdf===true&&table.width.constraints.support.pdf===false,directValidated:direct.status===200&&stored.length===1};
    Object.assign(result,{success:Object.values(result.assertions).every(Boolean),column,overflow:overflow.body,unknown:unknown.body,detail,table,directHistory:direct.body.history});write('mvp59-capability-e2e.json',result);if(!result.success)throw new Error(JSON.stringify(result.assertions));
  }finally{
    await req(`/api/structure-operations?${query}`,{method:'DELETE'}).catch(()=>{});await req(`/api/history?${query}`,{method:'DELETE'}).catch(()=>{});if(browser)await browser.close();const integrity={before,after:{form:sha(source),info:sha(info)},unchanged:before.form===sha(source)&&before.info===sha(info)};write('mvp59-e2e-integrity.json',integrity);if(!integrity.unchanged)process.exitCode=1;
  }
})().catch(e=>{console.error(e);process.exitCode=1});
