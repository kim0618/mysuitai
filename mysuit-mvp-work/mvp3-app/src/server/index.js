const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const config = require('./config');
const { routeCandidates } = require('./routes/candidate-routes');
const { routeChangeSets } = require('./routes/changeset-routes');
const { routeRenderPatches } = require('./routes/render-patch-routes');
const { routeStructureOperations } = require('./routes/structure-operation-routes');
const { routeHistory } = require('./routes/history-routes');
const { routeBindingOperations } = require('./routes/binding-operation-routes');
const { routeCapabilities } = require('./routes/capability-routes');
const { routeOperationValidation } = require('./routes/operation-validation-routes');
const { routeAiBuilder } = require('./routes/ai-builder-routes');
const staticTableModel = require('./services/static-table-model-service');
const staticTableAdapter = require('./services/static-table-structure-adapter');

const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml' };
function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && config.allowedOrigins.has(origin)) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'Origin'); }
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
}
function proxy(req, res) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname.startsWith('/mysuit/') ? `/MYSUIT/${url.pathname.slice('/mysuit/'.length)}` : url.pathname;
  const headers = { ...req.headers, host: `${config.tomcatHost}:${config.tomcatPort}` };
  delete headers.origin;
  const upstream = http.request({ host: config.tomcatHost, port: config.tomcatPort, method: req.method, path: pathname + url.search, headers }, response => {
    const responseHeaders = { ...response.headers };
    res.writeHead(response.statusCode || 502, responseHeaders);
    response.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, {'content-type':'application/json'}); res.end(JSON.stringify({ success:false, code:'CANDIDATE_RENDER_FAILED', message:'로컬 MySuit 서버에 연결할 수 없습니다.' })); });
  req.pipe(upstream);
}
function staticFile(req, res) {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const target = path.resolve(config.clientRoot, relative);
  if (!target.startsWith(path.resolve(config.clientRoot) + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); return res.end('Not found'); }
  const data = fs.readFileSync(target); res.writeHead(200, {'content-type':contentTypes[path.extname(target)] || 'application/octet-stream','content-length':data.length,'cache-control':'no-store'}); res.end(data);
}
const server = http.createServer((req,res) => {
  cors(req,res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (pathname.startsWith('/api/change-sets') || pathname === '/api/source-object') return routeChangeSets(req,res);
  if (pathname.startsWith('/api/render-patches')) return routeRenderPatches(req,res);
  if (pathname.startsWith('/api/structure-operations')) return routeStructureOperations(req,res);
  if (pathname.startsWith('/api/history')) return routeHistory(req,res);
  if (pathname.startsWith('/api/binding-operations')) return routeBindingOperations(req,res);
  if (pathname === '/api/capabilities' || pathname === '/api/operation-registry') return routeCapabilities(req,res);
  if (pathname.startsWith('/api/operations')) return routeOperationValidation(req,res);
  if (pathname.startsWith('/api/ai-builder')) return routeAiBuilder(req,res);
  if (pathname === '/api/image-assets' && req.method === 'POST') { const chunks=[]; let size=0; req.on('data',x=>{size+=x.length; if(size<=2*1024*1024)chunks.push(x)}); return req.on('end',()=>{ let status=201,payload; try { if(size>2*1024*1024)throw Object.assign(new Error('이미지는 1MB 이하 PNG, JPG, GIF만 사용할 수 있습니다.'),{code:'INVALID_IMAGE',status:413}); const input=JSON.parse(Buffer.concat(chunks).toString()||'{}'); payload={success:true,...require('./services/image-asset-service').store(input)}; } catch(e) { status=e.status||400; payload={success:false,code:e.code||'INVALID_IMAGE',message:e.message}; } const body=JSON.stringify(payload); res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); res.end(body); }); }
  { const asset=/^\/api\/image-assets\/([a-f0-9]{64})$/.exec(pathname); if (asset && req.method === 'GET') { try { const {bytes,mime}=require('./services/image-asset-service').read(asset[1]); res.writeHead(200,{'content-type':mime,'content-length':bytes.length,'cache-control':'private, max-age=31536000, immutable'}); return res.end(bytes); } catch(e) { const body=JSON.stringify({success:false,code:e.code,message:e.message}); res.writeHead(e.status||404,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); return res.end(body); } } }
  if (pathname === '/api/form-model' && req.method === 'GET') { try { const query=Object.fromEntries(new URL(req.url,'http://127.0.0.1').searchParams),tables=staticTableModel.discoverAll(query),layouts=query.layoutDraftId?staticTableModel.layouts(query,tables):null; const body=JSON.stringify({success:true,model:tables.length===1?tables[0]:null,tables,layouts}); res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store'}); return res.end(body); } catch(e) { const body=JSON.stringify({success:false,code:e.code||'FORM_MODEL_FAILED',message:e.message}); res.writeHead(e.status||400,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); return res.end(body); } }
  if (pathname === '/api/static-table-candidate' && req.method === 'POST') { const chunks=[]; req.on('data',x=>chunks.push(x)); return req.on('end',()=>{ try { const input=JSON.parse(Buffer.concat(chunks).toString()||'{}'),model=staticTableModel.discover(input),operations=require('./services/structure-operation-service').list(input),sourceDraft=require('./services/changeset-service').findDraft(input); if(sourceDraft?.patches?.length)throw Object.assign(new Error('Source Patch + Structure 혼합 materialization은 canonical serializer가 없어 차단됩니다.'),{code:'MIXED_CANONICAL_SERIALIZER_UNAVAILABLE'}); if(!operations.length)throw Object.assign(new Error('Structure Operation이 없습니다.'),{code:'STRUCTURE_OPERATIONS_EMPTY'}); const result=staticTableAdapter.createCandidate({...input,sourceTableId:model.sourceTableId,operations}); const body=JSON.stringify({success:true,...result}); res.writeHead(201,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); res.end(body); } catch(e) { const body=JSON.stringify({success:false,code:e.code||'STATIC_TABLE_CANDIDATE_FAILED',message:e.message}); res.writeHead(e.code==='MIXED_CANONICAL_SERIALIZER_UNAVAILABLE'?409:400,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body)}); res.end(body); } }); }
  if (pathname.startsWith('/api/')) return routeCandidates(req,res);
  if (pathname.startsWith('/mysuit/') || pathname.startsWith('/MYSUIT/')) return proxy(req,res);
  if (pathname === '/ai-builder/import') { req.url = '/ai-builder/import.html'; return staticFile(req,res); }
  if (pathname === '/ai-builder') { req.url = '/index.html'; return staticFile(req,res); }
  return staticFile(req,res);
});
if (require.main === module) server.listen(config.port, config.host, () => console.log(`MVP3 listening on http://${config.host}:${config.port}`));
module.exports = { server };
