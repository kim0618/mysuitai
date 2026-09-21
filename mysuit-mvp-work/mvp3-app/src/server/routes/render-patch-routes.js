const { URL } = require("url");
const service = require("../services/render-patch-service"),
  history = require("../services/history-service");
const operationValidator = require("../services/operation-validator");
function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}
function json(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 65536) {
        const e = new Error("요청이 너무 큽니다.");
        e.code = "INVALID_REQUEST";
        reject(e);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {});
      } catch (_) {
        const e = new Error("올바른 JSON이 아닙니다.");
        e.code = "INVALID_REQUEST";
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
async function routeRenderPatches(req, res) {
  const url = new URL(req.url, "http://127.0.0.1"),
    query = Object.fromEntries(url.searchParams),
    pathname = url.pathname;
  try {
    if (pathname === "/api/render-patches" && req.method === "GET")
      return send(res, 200, { success: true, patches: service.list(query) });
    if (pathname === "/api/render-patches/position" && req.method === "PUT") {
      const body = await json(req);
      operationValidator.assertValid(operationValidator.fromRender(body));
      const
        current = service
          .list(body)
          .find((x) => x.renderInstanceKey === body.renderInstanceKey),
        tx = history.transact(
          body,
          {
            scope: "RENDER_POSITION",
            operation: "moveRenderObject",
            target: {
              renderInstanceKey: body.renderInstanceKey,
              viewerObjectId: body.viewerObjectId,
              sourceObjectId: body.sourceObjectId,
            },
            before: current?.after || body.before,
            after: body.after,
          },
          () => service.upsert(body),
        );
      return send(res, 200, {
        success: true,
        patch: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    if (pathname === "/api/render-patches/events" && req.method === "POST")
      return send(res, 200, {
        success: true,
        ...service.record(await json(req)),
      });
    const one = /^\/api\/render-patches\/(rp_[A-Za-z0-9_]+)$/.exec(pathname);
    if (one && req.method === "DELETE") {
      const current = service.list(query).find((x) => x.patchId === one[1]);
      if (!current)
        throw Object.assign(new Error("위치 Patch를 찾을 수 없습니다."), {
          code: "RENDER_PATCH_NOT_FOUND",
          status: 404,
        });
      const tx = history.transact(
        query,
        {
          scope: "RENDER_POSITION",
          operation: "restoreRenderObject",
          target: {
            renderInstanceKey: current.renderInstanceKey,
            viewerObjectId: current.viewerObjectId,
          },
          before: current.after,
          after: current.before,
        },
        () => service.remove(one[1], query),
      );
      return send(res, 200, {
        success: true,
        patch: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    if (pathname === "/api/render-patches" && req.method === "DELETE") {
      const patches = service.clear(query);
      try {
        history.clear(query);
      } catch (_) {}
      return send(res, 200, { success: true, patches });
    }
    return send(res, 404, {
      success: false,
      code: "RENDER_PATCH_NOT_FOUND",
      message: "API 경로를 찾을 수 없습니다.",
    });
  } catch (e) {
    return send(res, e.status || (e.code === "LOCKED" ? 409 : 400), {
      success: false,
      code: e.code || "RENDER_PATCH_FAILED",
      message: e.message || "요청 처리에 실패했습니다.",
      details: e.details || {},
    });
  }
}
module.exports = { routeRenderPatches };
