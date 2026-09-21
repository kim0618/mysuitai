const { URL } = require('url');
const service = require('../services/candidate-service');

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), 'cache-control': 'no-store' });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', chunk => { size += chunk.length; if (size > 32 * 1024) { reject(service.codedError('INVALID_REQUEST', '요청이 너무 큽니다.', 413)); req.destroy(); } else chunks.push(chunk); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (_) { reject(service.codedError('INVALID_REQUEST', '올바른 JSON이 아닙니다.')); } });
    req.on('error', reject);
  });
}
async function routeCandidates(req, res) {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  try {
    if (pathname === '/api/candidates' && req.method === 'POST') return send(res, 201, service.createCandidate(await readJson(req)));
    if (pathname === '/api/candidates' && req.method === 'GET') return send(res, 200, { success: true, candidates: service.listCandidates() });
    const match = /^\/api\/candidates\/(cand_[A-Za-z0-9_]+)$/.exec(pathname);
    if (match && req.method === 'GET') return send(res, 200, { success: true, candidate: service.getCandidate(match[1]) });
    if (match && req.method === 'DELETE') return send(res, 200, service.deleteCandidate(match[1]));
    return send(res, 404, { success: false, code: 'CANDIDATE_NOT_FOUND', message: 'API 경로를 찾을 수 없습니다.' });
  } catch (error) {
    return send(res, error.status || (error.code === 'LOCKED' ? 409 : 400), { success: false, code: error.code || 'FORM_PATCH_FAILED', message: error.message || '요청 처리에 실패했습니다.' });
  }
}
module.exports = { routeCandidates };
