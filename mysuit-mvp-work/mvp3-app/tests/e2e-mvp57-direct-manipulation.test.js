const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  {
    chromium,
  } = require("/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const config = require("../src/server/config"),
  adapter = require("../src/server/services/ubjf-structure-adapter"),
  vertical = require("../src/server/services/vertical-reflow-service"),
  {
    makeCandidateName,
    copyProject,
    removeCandidate,
  } = require("../src/server/services/project-copy-service");
const work = path.resolve(__dirname, "../.."),
  project = path.resolve(work, ".."),
  logs = path.join(work, "logs"),
  shots = path.join(work, "screenshots"),
  output = path.join(work, "output"),
  source = path.join(config.projectsRoot, "sample/sample/form.ubjf"),
  info = source.replace("form.ubjf", "info.xml"),
  base = "http://127.0.0.1:3100",
  draft = "mvp57_direct_e2e",
  query = `layoutDraftId=${draft}&projectName=sample&formName=sample`;
for (const d of [logs, shots, output]) fs.mkdirSync(d, { recursive: true });
const sha = (f) =>
    crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex"),
  write = (n, v) =>
    fs.writeFileSync(path.join(logs, n), JSON.stringify(v, null, 2) + "\n"),
  created = [];
const KEY = "ctbl:main-report-table";
async function drag(page, locator, dx, dy, steps = 8, beforeUp) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("target missing");
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  if (beforeUp) await beforeUp();
  await page.mouse.up();
  await page.waitForFunction(() => !window.__mvp57?.lock);
  return { from: { x, y }, to: { x: x + dx, y: y + dy }, dx, dy };
}
async function pdf(page, name, file) {
  await page.goto(
    `${base}/mysuit/UView5/index.jsp?projectName=${name}&formName=sample`,
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForFunction(
    () => canvasModule?.getCanvas?.(0)?.getObjects?.().length > 0,
  );
  const p = page.waitForResponse(
    (r) =>
      r.request().method() === "POST" &&
      r.headers()["content-type"]?.includes("application/pdf"),
  );
  await page.evaluate(() => {
    canvasModule.captureAll();
    mainModule.callService("savePDF");
  });
  const r = await p,
    q = await page
      .context()
      .request.post(r.url(), {
        data: r.request().postData() || "",
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      }),
    target = path.join(output, file);
  fs.writeFileSync(target, await q.body());
  return {
    file: path.relative(work, target),
    status: q.status(),
    bytes: fs.statSync(target).size,
    sha256: sha(target),
    contentType: q.headers()["content-type"],
  };
}
(async () => {
  let browser;
  const beforeHash = { form: sha(source), info: sha(info) },
    beforeCandidates = new Set(fs.readdirSync(config.projectsRoot));
  try {
    await fetch(`${base}/api/structure-operations?${query}`, {
      method: "DELETE",
    });
    browser = await chromium.launch({
      executablePath:
        "/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome",
      headless: true,
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
        viewport: { width: 1800, height: 1150 },
      }),
      requests = [];
    page.on("request", (r) => {
      if (r.method() === "PUT" && r.url().includes("/api/structure-operations"))
        try {
          requests.push(JSON.parse(r.postData()));
        } catch {}
    });
    let failNext = false;
    await page.route("**/api/structure-operations", async (route) => {
      if (failNext && route.request().method() === "PUT") {
        failNext = false;
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            code: "FORCED_FAILURE",
            message: "강제 저장 실패",
          }),
        });
      }
      return route.continue();
    });
    await page.goto(`${base}/?layoutDraftId=${draft}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForFunction(() => window.__mvp57, { timeout: 30000 });
    await page.click("#review-toggle");
    // The simplified UI keeps legacy row/table controls behind Advanced tools.
    // This regression intentionally opens them before exercising those actions.
    await page.click("#advanced-toggle");
    await page.waitForTimeout(1500);
    await page.waitForFunction(
      () =>
        document
          .getElementById("viewer")
          .contentWindow.canvasModule?.getCanvas?.(0)
          ?.getObjects?.().length === 180,
      { timeout: 30000 },
    );
    await page.waitForFunction(
      () =>
        document
          .getElementById("viewer")
          .contentDocument.querySelectorAll(".mvp57-column-grip").length === 7,
      { timeout: 30000 },
    );
    const vf = page.frameLocator("#viewer");
    const coordinate = await page.evaluate(() => {
      const points = [
          { x: 2, y: 300 },
          { x: 442, y: 333 },
          { x: 792, y: 954 },
        ],
        rows = points.map((canvas) => {
          const screen = __mvp57.canvasToScreen(canvas),
            roundtrip = __mvp57.screenToCanvas(screen);
          return {
            canvas,
            screen,
            roundtrip,
            error: {
              x: Math.abs(canvas.x - roundtrip.x),
              y: Math.abs(canvas.y - roundtrip.y),
            },
          };
        });
      return {
        context: MvpCoordinateAdapter.context(
          document.getElementById("viewer").contentWindow,
          document
            .getElementById("viewer")
            .contentWindow.canvasModule.getCanvas(0),
        ),
        rows,
      };
    });
    write("mvp57-coordinate-adapter.json", coordinate);
    let started = performance.now(),
      moveRequests = requests.length;
    const c2 = vf.locator('.mvp57-column-grip[data-column="2"]'),
      c1 = vf.locator('.mvp57-column-grip[data-column="1"]'),
      b2 = await c2.boundingBox(),
      b1 = await c1.boundingBox(),
      columnDrag = await drag(
        page,
        c2,
        b1.x + b1.width / 2 - (b2.x + b2.width / 2) - 8,
        0,
        8,
        () =>
          page.screenshot({
            path: path.join(shots, "mvp57-column-dragging.png"),
            fullPage: true,
          }),
      );
    await page.waitForFunction(
      () => __mvp51.state().order.join(",") === "0,2,1,3,4,5,6",
    );
    await page.screenshot({
      path: path.join(shots, "mvp57-column-dropped.png"),
      fullPage: true,
    });
    columnDrag.elapsedMs = performance.now() - started;
    columnDrag.saveRequests = requests
      .slice(moveRequests)
      .filter((x) => x.operation === "moveColumn").length;
    const storedMove = await page.evaluate(() =>
      __mvp51.operations.find((x) => x.operation === "moveColumn"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () =>
        window.__mvp57 && __mvp51.state().order.join(",") === "0,2,1,3,4,5,6",
    );
    columnDrag.reloadedOrder = await page.evaluate(() => __mvp51.state().order);
    await page.click("#review-toggle");
    await page.waitForTimeout(1500);
    await page.waitForFunction(
      () =>
        document
          .getElementById("viewer")
          .contentDocument.querySelectorAll(".mvp57-column-grip").length === 7,
      { timeout: 30000 },
    );
    const invalidBefore = requests.length,
      invalid = await drag(
        page,
      vf.locator('.mvp57-column-drag-zone[data-column="2"]'),
        -700,
        0,
      );
    await page.waitForTimeout(250);
    columnDrag.invalid = {
      ...invalid,
      newRequests: requests.length - invalidBefore,
      order: await page.evaluate(() => __mvp51.state().order),
    };
    write("mvp57-column-drag.json", { ...columnDrag, storedMove });
    await page.evaluate(async () => {
      await fetch("/api/structure-operations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          layoutDraftId: "mvp57_direct_e2e",
          projectName: "sample",
          formName: "sample",
          logicalTableKey: "tbl:financial-7col",
          operation: "hideColumn",
          columnIndex: 6,
        }),
      });
      await Promise.all([__mvp51.loadOps(), __mvp52rows.loadOps()]);
    });
    await page.waitForTimeout(300);
    const resizeBefore = requests.length,
      widthBefore = await page.evaluate(() => __mvp51.state().widths[2]);
    started = performance.now();
    const columnResize = await drag(
      page,
      vf.locator('.mvp57-column-boundary[data-column="2"]'),
      30,
      0,
    );
    await page.waitForFunction(() => __mvp51.state().widths[2] === 100);
    columnResize.before = widthBefore;
    columnResize.after = await page.evaluate(() => __mvp51.state().widths[2]);
    columnResize.saveRequests = requests
      .slice(resizeBefore)
      .filter((x) => x.operation === "resizeColumn").length;
    columnResize.elapsedMs = performance.now() - started;
    await page.screenshot({
      path: path.join(shots, "mvp57-column-resize.png"),
      fullPage: true,
    });
    const overflow = await drag(
      page,
      vf.locator('.mvp57-column-boundary[data-column="2"]'),
      500,
      0,
    );
    await page.waitForTimeout(250);
    overflow.clampedWidth = await page.evaluate(
      () => __mvp51.state().widths[2],
    );
    overflow.totalWidth = await page.evaluate(() => __mvp51.state().totalWidth);
    write("mvp57-column-resize.json", { columnResize, overflow });
    const summaryKey = await page.evaluate(
        () =>
          __mvp52rows.rows.find((x) => x.rowRole === "SUMMARY").logicalRowKey,
      ),
      detailKey = await page.evaluate(
        () =>
          __mvp52rows.rows.find((x) => x.rowRole === "RENDERED_DETAIL")
            .logicalRowKey,
      ),
      summaryGutter = vf.locator(
        `.mvp57-row-gutter[data-row-key="${summaryKey}"]`,
      );
    await summaryGutter.click();
    const selectedSummary = await page.evaluate(
      () => __mvp52rows.selected.logicalRowKey,
    );
    const rowBefore = await page.evaluate(
        (k) => __mvp52rows.derived().get(k).height,
        summaryKey,
      ),
      rowReq = requests.length;
    const rowDrag = await drag(
      page,
      vf.locator(`.mvp57-row-boundary[data-row-key="${summaryKey}"]`),
      0,
      12,
    );
    await page.waitForFunction(
      (k) => __mvp52rows.derived().get(k).height === 39,
      summaryKey,
    );
    const rowAfter = await page.evaluate(
      (k) => __mvp52rows.derived().get(k).height,
      summaryKey,
    );
    await vf.locator(`.mvp57-row-gutter[data-row-key="${detailKey}"]`).click();
    const dataDisabled = await page.evaluate(() => ({
      resize: document.querySelector("#mvp52-row-resize").disabled,
      hide: document.querySelector("#mvp52-row-hide").disabled,
      collapse: document.querySelector("#mvp56-row-collapse").disabled,
      status: document.querySelector("#mvp52-row-status").textContent,
    }));
    await page.screenshot({
      path: path.join(shots, "mvp57-row-gutter.png"),
      fullPage: true,
    });
    write("mvp57-row-gutter.json", {
      summaryKey,
      selectedSummary,
      rowDrag,
      before: rowBefore,
      after: rowAfter,
      saveRequests: requests
        .slice(rowReq)
        .filter((x) => x.operation === "resizeRow").length,
      detailKey,
      dataDisabled,
    });
    const tableReq = requests.length,
      tableBefore = await page.evaluate(() => __mvp53.bounds()),
      tableDrag = await drag(page, vf.locator(".mvp57-table-grip"), 30, -20);
    await page.waitForFunction(() =>
      __mvp51.operations.some((x) => x.operation === "moveTable"),
    );
    const tableAfter = await page.evaluate(() => __mvp53.bounds());
    await page.screenshot({
      path: path.join(shots, "mvp57-table-dragged.png"),
      fullPage: true,
    });
    write("mvp57-table-drag.json", {
      tableDrag,
      before: tableBefore,
      after: tableAfter,
      delta: {
        x: tableAfter.left - tableBefore.left,
        y: tableAfter.top - tableBefore.top,
      },
      saveRequests: requests
        .slice(tableReq)
        .filter((x) => x.operation === "moveTable").length,
    });
    await page.screenshot({
      path: path.join(shots, "mvp57-table-grip.png"),
      fullPage: true,
    });
    const tableWidthBefore = await page.evaluate(
        () => __mvp51.state().totalWidth,
      ),
      tableResizeReq = requests.length,
      tableBoundaryHit = await vf
        .locator(".mvp57-table-boundary")
        .evaluate((element) => {
          const r = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            r.left + r.width / 2,
            r.top + r.height / 2,
          );
          return {
            rect: { left: r.left, top: r.top, width: r.width, height: r.height },
            hitClass: hit?.className || null,
          };
        }),
      tableResize = await drag(
        page,
        vf.locator(".mvp57-table-boundary"),
        -20,
        0,
      );
    await page.waitForTimeout(500);
    const tableWidthAfter = await page.evaluate(
      () => __mvp51.state().totalWidth,
    );
    write("mvp57-table-resize.json", {
      tableResize,
      tableBoundaryHit,
      before: tableWidthBefore,
      after: tableWidthAfter,
      saveRequests: requests
        .slice(tableResizeReq)
        .filter((x) => x.operation === "resizeTableWidth").length,
    });
    const rollbackBefore = await page.evaluate(() => __mvp51.state().widths[2]);
    failNext = true;
    await drag(
      page,
      vf.locator('.mvp57-column-boundary[data-column="2"]'),
      -10,
      0,
    );
    await page.waitForTimeout(500);
    const rollbackAfter = await page.evaluate(() => __mvp51.state().widths[2]);
    write("mvp57-failure-rollback.json", {
      interaction: "column-resize",
      forcedCode: "FORCED_FAILURE",
      before: rollbackBefore,
      after: rollbackAfter,
      rolledBack: rollbackBefore === rollbackAfter,
    });
    await page.screenshot({
      path: path.join(shots, "mvp57-collapse-actions.png"),
      fullPage: true,
    });
    await page.click("#mvp56-table-collapse");
    await page.waitForFunction(() =>
      __mvp51.operations.some((x) => x.operation === "collapseTable"),
    );
    const collapseUx = await page.evaluate(() => ({
      editorCollapseButton:
        document.querySelector("#mvp53-collapse").textContent,
      outputHideButton: document.querySelector("#mvp53-hide").textContent,
      collapseOperation: __mvp51.operations.find(
        (x) => x.operation === "collapseTable",
      ),
      visibleMembers: __mvp53.members.filter((x) => x.object.visible !== false)
        .length,
    }));
    write("mvp57-collapse-ux.json", collapseUx);
    const operations = await fetch(`${base}/api/structure-operations?${query}`)
      .then((r) => r.json())
      .then((x) => x.operations);
    const smokeName = makeCandidateName("sample", "mvp57_smoke"),
      smokeRoot = copyProject("sample", smokeName),
      smokeForm = path.join(smokeRoot, "sample/form.ubjf");
    created.push(smokeName);
    const sourceOps = operations.filter((x) =>
      ["moveColumn", "resizeColumn", "hideColumn", "resizeRow"].includes(
        x.operation,
      ),
    );
    adapter.applyStructureOperationsToUbjf({
      sourceFormPath: source,
      candidateFormPath: smokeForm,
      operations: sourceOps,
    });
    vertical.applyVerticalReflowToUbjf({
      sourceFormPath: source,
      candidateFormPath: smokeForm,
      operations: [{ operation: "collapseTable", compositeTableKey: KEY }],
    });
    const smokePage = await browser.newPage({
        viewport: { width: 1500, height: 1050 },
      }),
      smokePdf = await pdf(
        smokePage,
        smokeName,
        "mvp57-direct-source-smoke.pdf",
      );
    // savePDF can briefly rebuild/clear the Viewer canvas. Re-open the candidate
    // and wait for its complete, known object set before recording the Viewer
    // assertion so a cold Tomcat start cannot be mistaken for a source failure.
    await smokePage.goto(
      `${base}/mysuit/UView5/index.jsp?projectName=${smokeName}&formName=sample`,
      { waitUntil: "domcontentloaded" },
    );
    await smokePage.waitForFunction(
      () => canvasModule?.getCanvas?.(0)?.getObjects?.().length === 12,
      { timeout: 30000 },
    );
    const
      smokeViewer = await smokePage.evaluate(() => ({
        objects: canvasModule.getCanvas(0).getObjects().length,
        pageCount: 1,
      }));
    write("mvp57-source-smoke.json", {
      candidate: smokeName,
      operations,
      sourceOps,
      viewer: smokeViewer,
      pdf: smokePdf,
    });
    const metrics = await page.evaluate(() => __mvp57.metrics),
      performanceLog = {
        metrics,
        columnDragMs: columnDrag.elapsedMs,
        columnResizeMs: columnResize.elapsedMs,
        requestCount: requests.length,
      };
    write("mvp57-performance.json", performanceLog);
    const assertions = {
      coordinate: coordinate.rows.every(
        (x) =>
          Number.isFinite(x.error.x) &&
          Number.isFinite(x.error.y) &&
          x.error.x < 0.001 &&
          x.error.y < 0.001,
      ),
      columnReorder:
        columnDrag.saveRequests === 1 &&
        columnDrag.invalid.newRequests === 0 &&
        columnDrag.reloadedOrder.join(",") === "0,2,1,3,4,5,6",
      columnResize:
        columnResize.before === 70 &&
        columnResize.after === 100 &&
        columnResize.saveRequests === 1 &&
        overflow.totalWidth <= 792,
      rowGutter:
        selectedSummary === summaryKey &&
        rowAfter - rowBefore === 12 &&
        dataDisabled.resize &&
        dataDisabled.hide &&
        dataDisabled.collapse,
      tableDrag:
        tableAfter.left - tableBefore.left === 30 &&
        tableAfter.top - tableBefore.top === -20 &&
        requests.slice(tableReq).filter((x) => x.operation === "moveTable")
          .length === 1,
      tableResize: tableWidthAfter - tableWidthBefore === -20,
      collapse: collapseUx.visibleMembers === 0,
      rollback: rollbackBefore === rollbackAfter,
      sourceSmoke:
        smokeViewer.objects === 12 &&
        smokePdf.status === 200 &&
        smokePdf.bytes > 1000,
    };
    write("mvp57-regression.json", { assertions, requests });
    const integrity = {
      before: beforeHash,
      after: { form: sha(source), info: sha(info) },
      unchanged:
        beforeHash.form === sha(source) && beforeHash.info === sha(info),
      existingCandidatesPreserved: [...beforeCandidates].every((x) =>
        fs.existsSync(path.join(config.projectsRoot, x)),
      ),
    };
    write("mvp57-integrity.json", integrity);
    if (
      !Object.values(assertions).every(Boolean) ||
      !integrity.unchanged ||
      !integrity.existingCandidatesPreserved
    )
      throw new Error(JSON.stringify({ assertions }));
    console.log(
      JSON.stringify(
        {
          success: true,
          assertions,
          coordinate,
          columnDrag,
          columnResize,
          row: { before: rowBefore, after: rowAfter, dataDisabled },
          table: {
            before: tableBefore,
            after: tableAfter,
            widthBefore: tableWidthBefore,
            widthAfter: tableWidthAfter,
          },
          collapseUx,
          rollback: { before: rollbackBefore, after: rollbackAfter },
          smoke: { viewer: smokeViewer, pdf: smokePdf },
          integrity,
          performanceLog,
        },
        null,
        2,
      ),
    );
  } finally {
    await fetch(`${base}/api/structure-operations?${query}`, {
      method: "DELETE",
    }).catch(() => {});
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
