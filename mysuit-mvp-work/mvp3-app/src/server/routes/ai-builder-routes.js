const crypto = require('crypto');
const { URL } = require('url');
const history = require('../services/history-service');
const binding = require('../services/binding-operation-service');
const formContext = require('../services/form-context-service');
const config = require('../config');
const path = require('path');
const { readForm, findObjects, decodedText } = require('../services/form-patch-service');
const { materializeHistoryCursor } = require('../ai-builder/history-materializer');
const importService = require('../ai-builder/import-service');
const proposalService = require('../ai-builder/binding-proposal-service');

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'});
  res.end(body);
}
function json(req, limit=262144) {
  return new Promise((resolve, reject) => {
    const chunks=[]; let size=0;
    req.on('data', chunk => { size += chunk.length; if (size > limit) reject(Object.assign(new Error('요청이 너무 큽니다.'),{code:'INVALID_REQUEST',status:413})); else chunks.push(chunk); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch (_) { reject(Object.assign(new Error('올바른 JSON이 아닙니다.'),{code:'INVALID_REQUEST'})); } });
    req.on('error', reject);
  });
}
function walk(value, fn) {
  if (!value || typeof value !== 'object') return;
  fn(value);
  if (Array.isArray(value)) value.forEach(item => walk(item, fn));
  else Object.values(value).forEach(item => walk(item, fn));
}
function datasetInfo(parsed) {
  return (parsed.root.datasets || []).map(dataset => ({
    id: dataset.id,
    columns: (dataset.columns || []).map(column => column.dataField || column.name || column.id).filter(Boolean),
  }));
}
function sourceBinding(parsed, objectId) {
  if (!objectId) return null;
  const match = findObjects(parsed.pages, objectId);
  if (match.length !== 1) return null;
  const item = match[0].item;
  if (String(item.dataType) === '1') return {dataType:'1',dataSet:item.dataSet,column:item.column,text:decodedText(item.text)};
  if (String(item.dataType) === '3') return {dataType:'3',parameter:item.parameter,text:decodedText(item.text)};
  return null;
}
// Band structure of the form shown in the Designer. Bands are UB*Band page items; every object names its band. The Viewer
// may show a candidate derived from the draft's project (e.g. after array binding), which is accepted only when its name
// extends the validated project name and it lives under the projects root. Imported HWPX forms have no bands (free form).
const BAND_KINDS={UBPageHeaderBand:['페이지 헤더','Page Header'],UBTitleBand:['제목','Title'],UBDataHeaderBand:['데이터 헤더','Data Header'],UBGroupHeaderBand:['그룹 헤더','Group Header'],UBDataBand:['반복 데이터','DataBand'],UBGroupFooterBand:['그룹 합계','Group Footer'],UBDataFooterBand:['데이터 합계','Data Footer'],UBSummaryBand:['합계','Summary'],UBEmptyBand:['일반 영역','Empty Band'],UBPageFooterBand:['페이지 푸터','Page Footer']};
function bandsOf(query){
  const context=formContext.resolve(query),view=String(query.viewProject||context.projectName);
  if(view!==context.projectName&&!(view.startsWith(`${context.projectName}_`)&&/^[A-Za-z0-9_-]{1,160}$/.test(view)))throw Object.assign(new Error('표시 중인 문서를 확인할 수 없습니다.'),{code:'INVALID_VIEW_PROJECT',status:400});
  const root=path.resolve(config.projectsRoot,view),relative=path.relative(path.resolve(config.projectsRoot),root),form=path.join(root,context.formName,'form.ubjf');
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||!require('fs').existsSync(form))throw Object.assign(new Error('표시 중인 문서를 찾을 수 없습니다.'),{code:'INVALID_VIEW_PROJECT',status:404});
  const parsed=readForm(form),page=parsed.pages[0]||{items:[]},count=new Map();for(const item of page.items||[])if(item.band)count.set(item.band,(count.get(item.band)||0)+1);
  const bands=(page.items||[]).filter(item=>/^UB\w*Band$/.test(item.className||'')).map(band=>{const [label,engine]=BAND_KINDS[band.className]||['밴드',band.className.replace(/^UB/,'')];return{id:band.id,className:band.className,label,engine,x:band.x,y:band.y,width:band.width,height:band.height,dataSet:[band.dataSet,['UBDataBand','UBGroupHeaderBand','UBGroupFooterBand'].includes(band.className)?page.dataSet:null].find(v=>v&&v!=='null')||null,itemCount:count.get(band.id)||0}});
  const datasets=(parsed.root.datasets||[]).map(d=>({id:d.id,name:d.name||d.id,columns:(d.columns||d.fields||[]).map(c=>typeof c==='string'?c:c.name||c.id||c.column).filter(Boolean)}));
  return{viewProject:view,page:{width:page.width,height:page.height},freeForm:!bands.length,bands,datasets};
}
async function routeAiBuilder(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/api/ai-builder/bands' && req.method === 'GET') return send(res,200,{success:true,...bandsOf(Object.fromEntries(url.searchParams))});
    if (url.pathname === '/api/ai-builder/recent' && req.method === 'GET') return send(res,200,{success:true,documents:importService.recent(Math.min(20,Number(url.searchParams.get('limit'))||8))});
    if (url.pathname === '/api/ai-builder/context' && req.method === 'GET') {
      const query=Object.fromEntries(url.searchParams), context=formContext.resolve(query), form=context.form || path.join(config.projectsRoot,context.projectName,context.formName,'form.ubjf'), parsed=readForm(form), objectId=query.objectId;
      const operation=binding.list(query).filter(item => (item.target?.objectId || item.sourceObjectId) === objectId).at(-1);
      // Only imported documents have an Import Context; the built-in sample has none (reading it used to fail the request).
      const importContext=context.origin==='IMPORTED'?importService.read(context.projectName):null;
      return send(res,200,{success:true,document:{projectName:context.projectName,formName:context.formName,title:context.metadata?.title || String(importContext?.document?.displayName||'').replace(/\.[^.]+$/,'') || context.formName},importContext,datasets:datasetInfo(parsed),binding:operation ? (operation.operation === 'unbindField' ? null : operation.after || operation.binding) : sourceBinding(parsed,objectId)});
    }
    if (url.pathname === '/api/ai-builder/import/validate-dim' && req.method === 'POST') {
      const dim=importService.parseDim((await json(req,6*1024*1024)).dim);
      return send(res,200,{success:true,version:dim.schemaVersion,sha256:dim.sha256});
    }
    if (url.pathname === '/api/ai-builder/import' && req.method === 'POST') return send(res,201,importService.create(await json(req,20*1024*1024)));
    if (url.pathname === '/api/ai-builder/context/json' && req.method === 'DELETE') { const body=await json(req);formContext.resolve(body);return send(res,200,{success:true,...importService.removeJson(body)}); }
    if (url.pathname === '/api/ai-builder/context/json' && req.method === 'PUT') { const body=await json(req,2*1024*1024);formContext.resolve(body);return send(res,200,{success:true,...importService.updateJson(body)}); }
    if (url.pathname === '/api/ai-builder/binding-proposals' && req.method === 'GET') return send(res,200,{success:true,proposal:proposalService.get(Object.fromEntries(url.searchParams))});
    if (url.pathname === '/api/ai-builder/binding-proposals/regenerate' && req.method === 'POST') { const body=await json(req);return send(res,200,{success:true,proposal:proposalService.generate(body)}); }
    if (url.pathname === '/api/ai-builder/binding-proposals/select' && req.method === 'PUT') { const body=await json(req);return send(res,200,{success:true,proposal:proposalService.update(body)}); }
    if (url.pathname === '/api/ai-builder/array-proposals/select' && req.method === 'PUT') { const body=await json(req);return send(res,200,{success:true,proposal:proposalService.updateArray(body)}); }
    if (url.pathname === '/api/ai-builder/binding-proposals/apply' && req.method === 'POST') return send(res,201,proposalService.apply(await json(req)));
    if (url.pathname === '/api/ai-builder/array-proposals/apply' && req.method === 'POST') return send(res,201,proposalService.applyArray(await json(req)));
    if (url.pathname === '/api/ai-builder/save' && req.method === 'POST') {
      const body=await json(req), scope={layoutDraftId:body.layoutDraftId||body.draftId,projectName:body.projectName,formName:body.formName}, timeline=history.get(scope);
      if (!timeline.events.length) throw Object.assign(new Error('저장할 변경이 없습니다.'),{code:'EMPTY_BUILDER_DRAFT',status:409});
      const suffix=`${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`, destinationProject=`${scope.projectName}_builder_${suffix}`.slice(0,120);
      let datasets=Array.isArray(body.datasets)?body.datasets:[];if(!datasets.length){try{const proposal=proposalService.get(scope);if(proposal?.appliedAt&&proposal.dataset?.dataset)datasets=[proposal.dataset.dataset];}catch(_){}}
      const result=materializeHistoryCursor({scope,cursor:timeline.cursor,datasets,destinationProject});
      return send(res,201,{success:true,...result,cursor:timeline.cursor});
    }
    return send(res,404,{success:false,code:'AI_BUILDER_API_NOT_FOUND',message:'API 경로를 찾을 수 없습니다.'});
  } catch (error) {
    return send(res,error.status||400,{success:false,code:error.code||'AI_BUILDER_FAILED',message:error.message,details:error.details||{}});
  }
}
module.exports={routeAiBuilder};
