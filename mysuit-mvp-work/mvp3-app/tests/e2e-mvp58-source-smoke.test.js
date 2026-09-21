const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  {
    chromium,
  } = require("/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright"),
  config = require("../src/server/config"),
  {
    makeCandidateName,
    copyProject,
    removeCandidate,
  } = require("../src/server/services/project-copy-service"),
  structureAdapter = require("../src/server/services/ubjf-structure-adapter"),
  vertical = require("../src/server/services/vertical-reflow-service"),
  {
    patchFormProperties,
  } = require("../src/server/services/form-patch-service");
const base = "http://127.0.0.1:3100",
  scope = {
    layoutDraftId: "mvp58_source_smoke",
    projectName: "sample",
    formName: "sample",
  },
  query = new URLSearchParams(scope),
  work = path.resolve(__dirname, "../.."),
  logFile = path.join(work, "logs/mvp58-source-smoke.json"),
  output = path.join(work, "output"),
  source = path.join(config.projectsRoot, "sample/sample/form.ubjf");
fs.mkdirSync(output, { recursive: true });
const created = [],
  sha = (f) =>
    crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
async function req(url, options = {}) {
  const r = await fetch(base + url, {
      headers: { "content-type": "application/json" },
      ...options,
    }),
    d = await r.json();
  if (!r.ok) throw new Error(`${d.code}: ${d.message}`);
  return d;
}
async function pdf(page, name, label) {
  await page.goto(
    `${base}/mysuit/UView5/index.jsp?projectName=${name}&formName=sample`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () => canvasModule?.getCanvas?.(0)?.getObjects?.().length > 0,
  );
  const viewer = await page.evaluate(() => {
      const objects = canvasModule.getCanvas(0).getObjects(),
        title = objects.find((x) => x.id === "LB6417_UPHB2584_ROW0");
      return { objects: objects.length, title: title?.text || null };
    }),
    response = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.headers()["content-type"]?.includes("application/pdf"),
    );
  await page.evaluate(() => {
    canvasModule.captureAll();
    mainModule.callService("savePDF");
  });
  const original = await response,
    replay = await page
      .context()
      .request.post(original.url(), {
        data: original.request().postData() || "",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      }),
    file = path.join(output, `mvp58-${label}.pdf`);
  fs.writeFileSync(file, await replay.body());
  return {
    viewer,
    pdf: {
      status: replay.status(),
      bytes: fs.statSync(file).size,
      sha256: sha(file),
      file: path.relative(work, file),
    },
  };
}
function materialize(name, sourcePatches, operations) {
  const root = copyProject("sample", name),
    form = path.join(root, "sample/form.ubjf");
  created.push(name);
  const structural = operations.filter((x) =>
      ["moveColumn", "resizeColumn", "hideColumn", "resizeRow"].includes(
        x.operation,
      ),
    ),
    collapse = operations.filter((x) =>
      ["collapseRow", "collapseTable"].includes(x.operation),
    );
  if (collapse.length)
    vertical.applyVerticalReflowToUbjf({
      sourceFormPath: source,
      candidateFormPath: form,
      operations: collapse,
    });
  else if (structural.length)
    structureAdapter.applyStructureOperationsToUbjf({
      sourceFormPath: source,
      candidateFormPath: form,
      operations: structural,
    });
  return root;
}
(async () => {
  let browser, changeSetId;
  try {
    for (const endpoint of [
      "structure-operations",
      "render-patches",
      "history",
    ])
      await req(`/api/${endpoint}?${query}`, { method: "DELETE" }).catch(
        () => {},
      );
    const cs = (
      await req("/api/change-sets", {
        method: "POST",
        body: JSON.stringify(scope),
      })
    ).changeSet;
    changeSetId = cs.changeSetId;
    await req(`/api/change-sets/${changeSetId}/patches`, { method: "DELETE" });
    await req(`/api/history?${query}`, { method: "DELETE" });
    const patch = {
      pageIndex: 0,
      viewerObjectId: "LB6417_UPHB2584_ROW0",
      sourceObjectId: "LB6417",
      bandId: "UPHB2584",
      rowIndex: 0,
      className: "UBLabel",
      scope: "SOURCE_OBJECT_ALL_INSTANCES",
      operation: "updateProperty",
      viewerProperty: "text",
      sourceProperty: "text",
      before: "  연도별 실적보고서",
      after: "  MVP 5.8 Candidate",
      runtimeText: "  연도별 실적보고서",
    };
    await req(`/api/change-sets/${changeSetId}/patches`, {
      method: "POST",
      body: JSON.stringify(patch),
    });
    for (const body of [
      {
        logicalTableKey: "tbl:financial-7col",
        operation: "hideColumn",
        columnIndex: 6,
      },
      {
        logicalTableKey: "tbl:financial-7col",
        operation: "resizeColumn",
        columnIndex: 2,
        afterWidth: 100,
      },
      {
        logicalTableKey: "tbl:financial-7col",
        operation: "collapseRow",
        logicalRowKey: "tbl:financial-7col|band:UDHB4114|rendered-row:0",
      },
    ])
      await req("/api/structure-operations", {
        method: "PUT",
        body: JSON.stringify({ ...scope, ...body }),
      });
    const finalHistory = await req(`/api/history?${query}`),
      finalPatches = (await req(`/api/change-sets/${changeSetId}`)).changeSet
        .patches,
      finalOps = (await req(`/api/structure-operations?${query}`)).operations,
      finalName = makeCandidateName("sample", "mvp58_final");
    materialize(finalName, finalPatches, finalOps);
    await req("/api/history/undo", {
      method: "POST",
      body: JSON.stringify(scope),
    });
    await req("/api/history/undo", {
      method: "POST",
      body: JSON.stringify(scope),
    });
    const undoHistory = await req(`/api/history?${query}`),
      undoPatches = (await req(`/api/change-sets/${changeSetId}`)).changeSet
        .patches,
      undoOps = (await req(`/api/structure-operations?${query}`)).operations,
      undoName = makeCandidateName("sample", "mvp58_undo2");
    materialize(undoName, undoPatches, undoOps);
    browser = await chromium.launch({
      executablePath:
        "/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
        viewport: { width: 1500, height: 1050 },
      }),
      final = await pdf(page, finalName, "history-final"),
      undo2 = await pdf(page, undoName, "history-undo2"),
      result = {
        final: {
          cursor: finalHistory.cursor,
          activeEventIds: finalHistory.events
            .slice(0, finalHistory.cursor)
            .map((x) => x.historyEventId),
          ...final,
        },
        undo2: {
          cursor: undoHistory.cursor,
          activeEventIds: undoHistory.events
            .slice(0, undoHistory.cursor)
            .map((x) => x.historyEventId),
          ...undo2,
        },
        different:
          final.viewer.objects !== undo2.viewer.objects ||
          final.pdf.sha256 !== undo2.pdf.sha256,
        sourcePatchMaterialization:
          "기존 Source/Structure adapter 직렬화 합성 제한으로 Structure cursor 차이만 검증",
        originalSha256: sha(source),
      };
    fs.writeFileSync(logFile, JSON.stringify(result, null, 2) + "\n");
    if (
      final.pdf.status !== 200 ||
      undo2.pdf.status !== 200 ||
      !result.different
    )
      throw new Error(JSON.stringify(result));
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } finally {
    if (changeSetId)
      await req(`/api/change-sets/${changeSetId}/patches`, {
        method: "DELETE",
      }).catch(() => {});
    for (const endpoint of [
      "structure-operations",
      "render-patches",
      "history",
    ])
      await req(`/api/${endpoint}?${query}`, { method: "DELETE" }).catch(
        () => {},
      );
    if (browser) await browser.close();
    for (const name of created)
      try {
        removeCandidate(name);
      } catch (e) {
        console.error("cleanup", name, e.message);
      }
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
