const { URL } = require("url"),
  binding = require("../services/binding-operation-service"),
  history = require("../services/history-service");

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(body), "cache-control": "no-store" });
  res.end(body);
}
function json(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on("data", (chunk) => { size += chunk.length; if (size > 65536) reject(Object.assign(new Error("요청이 너무 큽니다."), { code: "INVALID_REQUEST" })); else chunks.push(chunk); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch (_) { reject(Object.assign(new Error("올바른 JSON이 아닙니다."), { code: "INVALID_REQUEST" })); } });
    req.on("error", reject);
  });
}
async function routeBindingOperations(req, res) {
  const url = new URL(req.url, "http://127.0.0.1"), query = Object.fromEntries(url.searchParams);
  try {
    if (url.pathname !== "/api/binding-operations") return send(res, 404, { success: false, code: "BINDING_API_NOT_FOUND", message: "API 경로를 찾을 수 없습니다." });
    if (req.method === "GET") return send(res, 200, { success: true, operations: binding.list(query) });
    if (req.method === "PUT") {
      const body = await json(req), scope = { layoutDraftId: body.layoutDraftId || body.draftId, projectName: body.projectName, formName: body.formName };
      const descriptor = { scope: "BINDING", operation: body.operation, target: body.target, before: body.before ?? null, after: body.after ?? null };
      const tx = history.transact(scope, descriptor, () => binding.upsert({ ...body, ...scope }));
      return send(res, 200, { success: true, operation: tx.result, historyEvent: tx.event, history: tx.history });
    }
    return send(res, 405, { success: false, code: "METHOD_NOT_ALLOWED", message: "지원하지 않는 method입니다." });
  } catch (error) {
    return send(res, error.status || 400, { success: false, code: error.code || "BINDING_OPERATION_FAILED", message: error.message });
  }
}

module.exports = { routeBindingOperations };
