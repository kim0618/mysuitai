const { URL } = require("url"),
  crypto = require("crypto"),
  service = require("../services/structure-operation-service"),
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
        reject(
          Object.assign(new Error("요청이 너무 큽니다."), {
            code: "INVALID_REQUEST",
          }),
        );
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {});
      } catch (_) {
        reject(
          Object.assign(new Error("올바른 JSON이 아닙니다."), {
            code: "INVALID_REQUEST",
          }),
        );
      }
    });
    req.on("error", reject);
  });
}
function descriptor(body, current) {
  const target = {
    logicalTableKey: body.logicalTableKey,
    columnIndex: body.columnIndex,
    logicalColumnKey: Number.isInteger(Number(body.columnIndex))
      ? `${String(body.logicalTableKey || "").startsWith("tbl:static:") ? body.logicalTableKey : "tbl:financial-7col"}|col:${Number(body.columnIndex)}`
      : undefined,
    logicalRowKey: body.logicalRowKey,
    compositeTableKey: body.compositeTableKey,
  };
  let before = {},
    after = {};
  if (body.operation === "resizeColumn") {
    before = {
      width: current?.afterWidth ?? (Number(body.columnIndex) ? 70 : 370),
    };
    after = { width: Number(body.afterWidth) };
  } else if (body.operation === "moveColumn") {
    before = {
      visualIndex: current?.toVisualIndex ?? Number(body.originalVisualIndex),
    };
    after = { visualIndex: Number(body.toVisualIndex) };
  } else if (body.operation === "resizeRow") {
    before = { height: current?.afterHeight ?? Number(body.beforeHeight) };
    after = { height: Number(body.afterHeight) };
  } else if (body.operation === "moveRenderedRow") {
    before = { rowIndex: current?.toRowIndex ?? Number(body.beforeRowIndex) };
    after = { rowIndex: Number(body.toRowIndex) };
  } else if (body.operation === "moveRow") {
    before = { rowIndex: Number(body.fromRowIndex) };
    after = { rowIndex: Number(body.toRowIndex) };
  } else if (body.operation === "removeRow") {
    before = { present: true };
    after = { present: false };
  } else if (body.operation === "moveTable") {
    before = body.before || {};
    after = body.after || {};
  } else if (body.operation === "resizeTableWidth") {
    before = { width: Number(body.beforeWidth) };
    after = { width: Number(body.afterWidth) };
  } else {
    before = { active: Boolean(current) };
    after = { active: true };
  }
  return {
    scope: "STRUCTURE",
    operation: body.operation,
    target,
    before,
    after,
    internalOperations: body.internalOperations || [],
  };
}
async function routeStructureOperations(req, res) {
  const url = new URL(req.url, "http://127.0.0.1"),
    query = Object.fromEntries(url.searchParams),
    pathname = url.pathname;
  try {
    if (pathname === "/api/structure-operations" && req.method === "GET")
      return send(res, 200, { success: true, operations: service.list(query) });
    if (pathname === "/api/structure-operations" && req.method === "PUT") {
      const body = await json(req);
      if (body.operation === "moveRenderedRow") {
        const match = /^tbl:financial-7col\|band:([A-Za-z0-9_]*_UDB3195)\|rendered-row:(\d+)$/.exec(String(body.logicalRowKey || "")),
          to = Number(body.toRowIndex);
        if (!match || !Number.isInteger(to) || to < 0 || to > 99)
          throw Object.assign(new Error("같은 데이터 밴드의 상세 행만 이동할 수 있습니다."), { code: "INVALID_ROW_MOVE", status: 409 });
        const scope = { layoutDraftId: body.layoutDraftId, projectName: body.projectName, formName: body.formName },
          current = service.list(scope),
          index = current.findIndex(x => x.operation === "moveRenderedRow" && x.logicalRowKey === body.logicalRowKey),
          now = new Date().toISOString(),
          operation = {
            ...(index >= 0 ? current[index] : { operationId: `sop_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`, type: "STRUCTURE", sequence: Math.max(0, ...current.map(x => x.sequence || 0)) + 1, createdAt: now }),
            ...scope, logicalTableKey: "tbl:financial-7col", logicalRowKey: body.logicalRowKey,
            bandId: match[1], rowRole: "RENDERED_DETAIL", operation: "moveRenderedRow",
            beforeRowIndex: Number(match[2]), toRowIndex: to, viewerOnly: true, updatedAt: now,
          },
          next = [...current];
        if (index >= 0) next[index] = operation; else next.push(operation);
        const tx = history.transact(scope, descriptor(body, index >= 0 ? current[index] : null), () => {
          service.replaceScope(scope, next);
          return operation;
        });
        return send(res, 200, { success: true, operation: tx.result, historyEvent: tx.event, history: tx.history });
      }
      operationValidator.assertValid(operationValidator.fromStructure(body));
      const
        scope = {
          layoutDraftId: body.layoutDraftId,
          projectName: body.projectName,
          formName: body.formName,
        },
        current = service
          .list(scope)
          .find(
            (x) =>
              x.operation === body.operation &&
              (body.logicalRowKey
                ? x.logicalRowKey === body.logicalRowKey
                : body.compositeTableKey
                  ? x.compositeTableKey === body.compositeTableKey
                  : x.columnIndex === Number(body.columnIndex) && (!body.logicalTableKey || x.logicalTableKey === body.logicalTableKey)),
          ),
        tx = history.transact(scope, descriptor(body, current), () =>
          service.upsert(body),
        );
      return send(res, 200, {
        success: true,
        operation: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    const one = /^\/api\/structure-operations\/(sop_[a-z0-9_]+)$/.exec(
      pathname,
    );
    if (one && req.method === "DELETE") {
      const current = service.list(query).find((x) => x.operationId === one[1]);
      if (!current)
        return send(res, 404, {
          success: false,
          code: "STRUCTURE_OPERATION_NOT_FOUND",
          message: "구조 연산을 찾을 수 없습니다.",
        });
      const tx = history.transact(
        query,
        {
          scope: "STRUCTURE",
          operation: `restore${current.operation[0].toUpperCase()}${current.operation.slice(1)}`,
          target: {
            logicalColumnKey: current.logicalColumnKey,
            logicalRowKey: current.logicalRowKey,
            compositeTableKey: current.compositeTableKey,
            columnIndex: current.columnIndex,
          },
          before: { active: true },
          after: { active: false },
        },
        () => service.remove(one[1], query),
      );
      return send(res, 200, {
        success: true,
        operation: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    if (pathname === "/api/structure-operations" && req.method === "DELETE") {
      const operations = service.clear(query);
      try {
        history.clear(query);
      } catch (_) {}
      return send(res, 200, { success: true, operations });
    }
    return send(res, 404, {
      success: false,
      code: "STRUCTURE_API_NOT_FOUND",
      message: "API 경로를 찾을 수 없습니다.",
    });
  } catch (e) {
    const details = {};
    for (const key of ["currentWidth", "requestedWidth", "maxWidth"])
      if (Number.isFinite(e[key])) details[key] = e[key];
    Object.assign(details, e.details || {});
    return send(res, e.status || 400, {
      success: false,
      code: e.code || "STRUCTURE_OPERATION_FAILED",
      message: e.message,
      ...details,
    });
  }
}
module.exports = { routeStructureOperations };
