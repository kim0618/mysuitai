const { URL } = require("url");
const service = require("../services/changeset-service"),
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
    const c = [];
    let n = 0;
    req.on("data", (x) => {
      n += x.length;
      if (n > 65536) {
        const e = new Error("요청이 너무 큽니다.");
        e.code = "INVALID_REQUEST";
        reject(e);
        req.destroy();
      } else c.push(x);
    });
    req.on("end", () => {
      try {
        resolve(c.length ? JSON.parse(Buffer.concat(c)) : {});
      } catch (_) {
        const e = new Error("올바른 JSON이 아닙니다.");
        e.code = "INVALID_REQUEST";
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
function sourceDescriptor(body, current, operation = "updateProperty") {
  const property =
      body.viewerProperty || body.property || current?.viewerProperty,
    ops = {
      text: "updateText",
      fontSize: "setFontSize",
      fontWeight: "setFontWeight",
      textAlign: "setTextAlign",
      width: "resizeObject",
      height: "resizeObject",
      visible: body.after === false ? "hideObject" : "restoreObject",
    };
  return {
    scope: "SOURCE_PATCH",
    operation:
      operation === "restore"
        ? `restore${String(property || "Object")[0].toUpperCase()}${String(property || "Object").slice(1)}`
        : ops[property] || "updateProperty",
    target: {
      sourceObjectId: body.sourceObjectId || current?.sourceObjectId,
      viewerObjectId: body.viewerObjectId || current?.viewerObjectId,
      property,
    },
    before: { [property]: current?.after ?? body.before },
    after: {
      [property]: operation === "restore" ? current?.before : body.after,
    },
  };
}
async function routeChangeSets(req, res) {
  const u = new URL(req.url, "http://127.0.0.1"),
    p = u.pathname;
  try {
    if (p === "/api/source-object" && req.method === "GET")
      return send(res, 200, {
        success: true,
        source: service.sourceObject(Object.fromEntries(u.searchParams)),
      });
    if (p === "/api/change-sets" && req.method === "POST")
      return send(res, 201, {
        success: true,
        changeSet: service.create(await json(req)),
      });
    const base = /^\/api\/change-sets\/(cs_[A-Za-z0-9_]+)$/.exec(p);
    if (base && req.method === "GET")
      return send(res, 200, { success: true, changeSet: service.get(base[1]) });
    if (base && req.method === "DELETE")
      return send(res, 200, {
        success: true,
        changeSet: service.discard(base[1]),
      });
    const patches = /^\/api\/change-sets\/(cs_[A-Za-z0-9_]+)\/patches$/.exec(p);
    if (patches && req.method === "POST") {
      const body = await json(req),
        cs = service.get(patches[1]),
        current = cs.patches.find(
          (x) =>
            x.sourceObjectId === body.sourceObjectId &&
            x.sourceProperty === body.sourceProperty &&
            x.scope === body.scope,
        ),
        scope = {
          layoutDraftId: cs.layoutDraftId,
          projectName: cs.projectName,
          formName: cs.formName,
        };
      if (!scope.layoutDraftId)
        return send(res, 201, {
          success: true,
          changeSet: service.addPatch(patches[1], body),
        });
      operationValidator.assertValid(operationValidator.fromSource(body, scope));
      const tx = history.transact(scope, sourceDescriptor(body, current), () =>
        service.addPatch(patches[1], body),
      );
      return send(res, 201, {
        success: true,
        changeSet: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    if (patches && req.method === "DELETE") {
      const cs = service.get(patches[1]),
        scope = {
          layoutDraftId: cs.layoutDraftId,
          projectName: cs.projectName,
          formName: cs.formName,
        };
      if (!scope.layoutDraftId)
        return send(res, 200, {
          success: true,
          changeSet: service.clearPatches(patches[1]),
        });
      const tx = history.transact(
        scope,
        {
          scope: "SOURCE_PATCH",
          operation: "clearSourcePatches",
          target: { changeSetId: cs.changeSetId },
          before: { count: cs.patches.length },
          after: { count: 0 },
        },
        () => service.clearPatches(patches[1]),
      );
      return send(res, 200, {
        success: true,
        changeSet: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    const patch =
      /^\/api\/change-sets\/(cs_[A-Za-z0-9_]+)\/patches\/(patch_[a-f0-9]+)$/.exec(
        p,
      );
    if (patch && ["PUT", "DELETE"].includes(req.method)) {
      const cs = service.get(patch[1]),
        current = cs.patches.find((x) => x.patchId === patch[2]);
      if (!current)
        throw Object.assign(new Error("Patch를 찾을 수 없습니다."), {
          code: "PATCH_NOT_FOUND",
          status: 404,
        });
      const scope = {
          layoutDraftId: cs.layoutDraftId,
          projectName: cs.projectName,
          formName: cs.formName,
        },
        body = req.method === "PUT" ? await json(req) : current,
        mutate = () =>
          req.method === "PUT"
            ? service.updatePatch(patch[1], patch[2], body)
            : service.deletePatch(patch[1], patch[2]);
      if (req.method === "PUT" && scope.layoutDraftId)
        operationValidator.assertValid(
          operationValidator.fromSource({ ...current, ...body }, scope),
        );
      if (!scope.layoutDraftId)
        return send(res, 200, { success: true, changeSet: mutate() });
      const tx = history.transact(
        scope,
        sourceDescriptor(
          { ...current, ...body },
          current,
          req.method === "DELETE" ? "restore" : "updateProperty",
        ),
        mutate,
      );
      return send(res, 200, {
        success: true,
        changeSet: tx.result,
        historyEvent: tx.event,
        history: tx.history,
      });
    }
    const candidate =
      /^\/api\/change-sets\/(cs_[A-Za-z0-9_]+)\/candidate$/.exec(p);
    if (candidate && req.method === "POST")
      return send(res, 201, service.createCandidate(candidate[1]));
    return send(res, 404, {
      success: false,
      code: "CHANGESET_NOT_FOUND",
      message: "API 경로를 찾을 수 없습니다.",
    });
  } catch (e) {
    return send(
      res,
      e.status ||
        (["LOCKED", "CHANGESET_NOT_DRAFT", "CANDIDATE_ALREADY_ACTIVE"].includes(
          e.code,
        )
          ? 409
          : 400),
      {
        success: false,
        code: e.code || "MULTI_PATCH_VALIDATION_FAILED",
        message: e.message || "요청 처리에 실패했습니다.",
        details: e.details || {},
      },
    );
  }
}
module.exports = { routeChangeSets };
