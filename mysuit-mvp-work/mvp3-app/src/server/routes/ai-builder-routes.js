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
async function routeAiBuilder(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/api/ai-builder/recent' && req.method === 'GET') return send(res,200,{success:true,documents:importService.recent(Math.min(20,Number(url.searchParams.get('limit'))||8))});
    if (url.pathname === '/api/ai-builder/context' && req.method === 'GET') {
      const query=Object.fromEntries(url.searchParams), context=formContext.resolve(query), form=context.form || path.join(config.projectsRoot,context.projectName,context.formName,'form.ubjf'), parsed=readForm(form), objectId=query.objectId;
      const operation=binding.list(query).filter(item => (item.target?.objectId || item.sourceObjectId) === objectId).at(-1);
      const importContext=importService.read(context.projectName);
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
