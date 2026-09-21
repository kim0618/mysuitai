const fs = require("fs"), path = require("path"), crypto = require("crypto");
process.env.LD_LIBRARY_PATH = "/home/tjd618/mysuit-ai-viewer/mysuit-mvp-work/runtime/browser-libs/root/usr/lib/x86_64-linux-gnu";
const { chromium } = require("/home/tjd618/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const config = require("../src/server/config"), history = require("../src/server/services/history-service"), binding = require("../src/server/services/binding-operation-service"), structure = require("../src/server/services/structure-operation-service"), changes = require("../src/server/services/changeset-service");
const { materializeHistoryCursor } = require("../src/server/ai-builder/history-materializer");
const { sha256File } = require("../src/server/services/integrity-service");
const projectName = "import_mvp11_20260827_170551_e59e1d", formName = "SampleReport_FreeForm", base = "http://127.0.0.1:3100";
const scope = { layoutDraftId: `foundation02_e2e_${process.pid}`, projectName, formName }, created = [], pdfs = [];
const dataFiles = ["history.json", "changesets.json", "structure-operations.json", "render-patches.json", "binding-operations.json"].map((name) => path.join(config.appRoot, "data", name));
const backup = new Map(dataFiles.map((file) => [file, fs.existsSync(file) ? fs.readFileSync(file) : null]));
const sourceForm = path.join(config.projectsRoot, projectName, formName, "form.ubjf"), sourceInfo = path.join(config.projectsRoot, projectName, formName, "info.xml"), original = { form: sha256File(sourceForm), info: sha256File(sourceInfo) };
const datasets = [{ id: "ai_builder_history_test", columns: ["applicantName", "customerName"], rows: [{ applicantName: "홍길동", customerName: "김철수" }] }];
const value = (column) => ({ dataType: "1", dataSet: "ai_builder_history_test", column, text: `{ai_builder_history_test.${column}}` });
function bind(column, before = null) { const operation = { operation: "bindField", target: { objectId: "IMPLB0002" }, before, after: value(column) }; return history.transact(scope, { scope: "BINDING", ...operation }, () => binding.upsert({ ...scope, ...operation })); }
function name(label) { const result = `foundation02_e2e_${process.pid}_${crypto.randomBytes(3).toString("hex")}_${label}`; created.push(result); return result; }
function candidate(cursor, label) { return materializeHistoryCursor({ scope, cursor, datasets, destinationProject: name(label) }); }
async function inspect(page, result) { const response = await page.goto(`${base}${result.previewUrl}`, { waitUntil: "domcontentloaded", timeout: 30000 }); await page.waitForFunction(() => canvasModule?.getCanvas?.(0)?.getObjects?.().some((item) => item.id === "IMPLB0002"), null, { timeout: 60000 }); return page.evaluate((status) => { const objects = canvasModule.getCanvas(0).getObjects(), by = (id) => objects.find((item) => item.id === id); return { http: status, title: by("IMPLB0001")?.text, bound: by("IMPLB0002")?.text, width: Math.round(by("IMPCL0002")?.width || 0) }; }, response.status()); }
async function pdf(page, label) { const wait = page.waitForResponse((response) => response.request().method() === "POST" && response.headers()["content-type"]?.includes("application/pdf"), { timeout: 30000 }); await page.evaluate(() => { canvasModule.captureAll(); mainModule.callService("savePDF"); }); const emitted = await wait, replay = await page.context().request.post(emitted.url(), { data: emitted.request().postData() || "", headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" } }), file = path.join("/tmp", `foundation02-${process.pid}-${label}.pdf`); fs.writeFileSync(file, await replay.body()); pdfs.push(file); return { http: replay.status(), bytes: fs.statSync(file).size, sha256: sha256File(file) }; }
(async () => { let browser; try {
  changes.create(scope); history.clear(scope); structure.clear(scope); binding.clear(scope);
  bind("applicantName");
  history.transact(scope, { scope: "STRUCTURE", operation: "resizeColumn", target: { tableId: "IMPTB0001", columnIndex: 1 }, before: { width: 210 }, after: { width: 240 } }, () => structure.upsert({ ...scope, operation: "resizeColumn", logicalTableKey: "tbl:static:IMPTB0001", columnIndex: 1, afterWidth: 240 }));
  const patch = { operation: "updateText", target: { objectId: "IMPLB0001" }, before: { text: "월간 실적 보고서" }, after: { text: "대출상담 및 신청서" } };
  history.transact(scope, { scope: "SOURCE_PATCH", operation: "updateText", target: patch.target, before: patch.before, after: patch.after }, () => changes.replaceDraftPatches(scope, [patch]));
  bind("customerName", value("applicantName"));
  const results = { base: candidate(0, "base"), mid: candidate(1, "mid"), final: candidate(4, "final") };
  browser = await chromium.launch({ executablePath: "/home/tjd618/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome", headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } }), page = await context.newPage(), errors = []; page.on("pageerror", (error) => errors.push(error.message));
  const states = {};
  for (const label of ["base", "mid", "final"]) { states[label] = await inspect(page, results[label]); states[label].pdf = await pdf(page, label); }
  await page.reload({ waitUntil: "domcontentloaded" }); const reload = await inspect(page, results.final);
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 1000 } }), freshPage = await fresh.newPage(), newContext = await inspect(freshPage, results.final); await fresh.close();
  const pass = states.base.title === "월간 실적 보고서" && states.mid.bound === "홍길동" && states.final.title === "대출상담 및 신청서" && states.final.bound === "김철수" && states.final.width === 240 && states.base.pdf.bytes > 0 && states.mid.pdf.bytes > 0 && states.final.pdf.bytes > 0 && new Set(Object.values(states).map((state) => state.pdf.sha256)).size === 3 && reload.bound === "김철수" && newContext.bound === "김철수" && !errors.length;
  if (!pass) throw new Error(JSON.stringify({ states, reload, newContext, errors }));
  console.log(JSON.stringify({ success: true, states, reload, newContext, errors, signatures: Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.signature])), integrity: { form: sha256File(sourceForm) === original.form, info: sha256File(sourceInfo) === original.info } }, null, 2));
} finally {
  if (browser) await browser.close();
  for (const project of created) { const target = path.join(config.projectsRoot, project); if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false }); }
  for (const file of pdfs) if (fs.existsSync(file)) fs.rmSync(file);
  for (const [file, contents] of backup) contents === null ? fs.rmSync(file, { force: true }) : fs.writeFileSync(file, contents);
  if (sha256File(sourceForm) !== original.form || sha256File(sourceInfo) !== original.info) throw new Error("Original integrity changed");
} })().catch((error) => { console.error(error); process.exit(1); });
