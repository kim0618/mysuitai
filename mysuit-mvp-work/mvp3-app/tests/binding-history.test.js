const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const h = require("./history-test-helper");
const config = require("../src/server/config");
const { materializeHistoryCursor } = require("../src/server/ai-builder/history-materializer");
const { readForm, findObjects, decodedText } = require("../src/server/services/form-patch-service");
const { sha256File } = require("../src/server/services/integrity-service");

const projectName = "import_mvp11_20260827_170551_e59e1d";
const formName = "SampleReport_FreeForm";
const targetId = "IMPLB0002";
const titleId = "IMPLB0001";
const tableId = "IMPTB0001";
const datasets = [{ id: "ai_builder_history_test", columns: ["applicantName", "customerName"], rows: [{ applicantName: "홍길동", customerName: "김철수" }] }];
const bindingValue = (column) => ({ dataType: "1", dataSet: "ai_builder_history_test", column, text: `{ai_builder_history_test.${column}}` });
const bindOperation = (column, before = null) => ({ operation: "bindField", target: { objectId: targetId }, before, after: bindingValue(column) });
const unbindOperation = (before) => ({ operation: "unbindField", target: { objectId: targetId }, before, after: null });
const descriptor = (operation) => ({ scope: "BINDING", operation: operation.operation, target: operation.target, before: operation.before, after: operation.after });

let saved, scope, sequence = 0;
const made = [];
const sourceForm = path.join(config.projectsRoot, projectName, formName, "form.ubjf");
const sourceInfo = path.join(config.projectsRoot, projectName, formName, "info.xml");
const original = { form: sha256File(sourceForm), info: sha256File(sourceInfo) };
function destination(label) { const value = `foundation02_test_${process.pid}_${++sequence}_${label}`; made.push(value); return value; }
function transactBinding(operation) { return h.history.transact(scope, descriptor(operation), () => h.binding.upsert({ ...scope, ...operation })); }
function currentBinding() { return h.binding.list(scope)[0] || null; }
function sourcePatch() { return { operation: "updateText", target: { objectId: titleId }, before: { text: "월간 실적 보고서" }, after: { text: "대출상담 및 신청서" } }; }
function transactSource() { const patch = sourcePatch(); return h.history.transact(scope, { scope: "SOURCE_PATCH", operation: "updateText", target: patch.target, before: patch.before, after: patch.after }, () => h.changes.replaceDraftPatches(scope, [patch])); }
function transactStructure() { return h.history.transact(scope, { scope: "STRUCTURE", operation: "resizeColumn", target: { tableId, columnIndex: 1 }, before: { width: 210 }, after: { width: 240 } }, () => h.structure.upsert({ ...scope, logicalTableKey: "tbl:static:IMPTB0001", sourceTableId: tableId, operation: "resizeColumn", columnIndex: 1, afterWidth: 240 })); }
function snapshot() { const state = h.history.capture(scope); return { source: state.sourcePatches[0]?.after?.text || null, width: state.structureOperations[0]?.afterWidth || 210, binding: state.bindingOperations[0]?.after?.column || null, bindingOperation: state.bindingOperations[0]?.operation || null }; }
function materialize(cursor, label) { return materializeHistoryCursor({ scope, cursor, datasets, destinationProject: destination(label) }); }

test.before(() => { saved = h.backup(); scope = { layoutDraftId: `foundation02_${process.pid}`, projectName, formName }; h.setup(scope); });
test.after(() => {
  for (const project of made) { const target = path.join(config.projectsRoot, project); if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: false }); }
  h.restore(saved);
  assert.equal(sha256File(sourceForm), original.form);
  assert.equal(sha256File(sourceInfo), original.info);
});

test("binding snapshot save and restore", () => {
  transactBinding(bindOperation("applicantName"));
  const state = h.history.rebuildEditorStateFromHistory(scope, 1);
  assert.equal(state.bindingOperations[0].after.column, "applicantName");
  h.history.undo(scope); assert.equal(currentBinding(), null);
  h.history.redo(scope); assert.equal(currentBinding().after.column, "applicantName");
});
test("bind undo and redo", () => { h.history.undo(scope); assert.equal(currentBinding(), null); h.history.redo(scope); assert.equal(currentBinding().after.column, "applicantName"); });
test("unbind undo and redo", () => {
  transactBinding(unbindOperation(bindingValue("applicantName")));
  assert.equal(currentBinding().operation, "unbindField");
  h.history.undo(scope); assert.equal(currentBinding().after.column, "applicantName");
  h.history.redo(scope); assert.equal(currentBinding().operation, "unbindField");
  h.history.undo(scope);
});
test("rebind undo and redo", () => {
  transactBinding(bindOperation("customerName", bindingValue("applicantName")));
  h.history.undo(scope); assert.equal(currentBinding().after.column, "applicantName");
  h.history.redo(scope); assert.equal(currentBinding().after.column, "customerName");
  h.history.undo(scope);
});
test("source + binding mixed history", () => { transactSource(); assert.deepEqual(snapshot(), { source: "대출상담 및 신청서", width: 210, binding: "applicantName", bindingOperation: "bindField" }); h.history.undo(scope); });
test("structure + binding mixed history", () => { transactStructure(); assert.deepEqual(snapshot(), { source: null, width: 240, binding: "applicantName", bindingOperation: "bindField" }); h.history.undo(scope); });
test("source + structure + binding mixed timeline restores every cursor", () => {
  transactStructure(); transactSource(); transactBinding(bindOperation("customerName", bindingValue("applicantName")));
  assert.deepEqual(snapshot(), { source: "대출상담 및 신청서", width: 240, binding: "customerName", bindingOperation: "bindField" });
  const expected = [
    { source: "대출상담 및 신청서", width: 240, binding: "applicantName", bindingOperation: "bindField" },
    { source: null, width: 240, binding: "applicantName", bindingOperation: "bindField" },
    { source: null, width: 210, binding: "applicantName", bindingOperation: "bindField" },
    { source: null, width: 210, binding: null, bindingOperation: null },
  ];
  for (const value of expected) { h.history.undo(scope); assert.deepEqual(snapshot(), value); }
  for (let i = expected.length - 2; i >= 0; i--) { h.history.redo(scope); assert.deepEqual(snapshot(), expected[i]); }
  h.history.redo(scope); assert.deepEqual(snapshot(), { source: "대출상담 및 신청서", width: 240, binding: "customerName", bindingOperation: "bindField" });
});
test("redo branch is removed by a binding event", () => {
  h.history.undo(scope);
  transactBinding(unbindOperation(bindingValue("applicantName")));
  assert.equal(h.history.get(scope).canRedo, false);
  assert.throws(() => h.history.redo(scope), (error) => error.code === "NOTHING_TO_REDO");
  h.history.undo(scope);
  transactBinding(bindOperation("customerName", bindingValue("applicantName")));
});
test("binding history persists through store reload", () => {
  const persisted = JSON.parse(fs.readFileSync(path.join(config.appRoot, "data/history.json"), "utf8"));
  const draft = Object.values(persisted.drafts).find((value) => value.projectName === projectName && value.formName === formName);
  assert.equal(draft.events[draft.cursor - 1].afterState.bindingOperations[0].after.column, "customerName");
  assert.equal(h.history.get(scope).cursor, draft.cursor);
});
test("old snapshots without binding field restore as empty", () => {
  const oldState = h.history.capture(scope); delete oldState.bindingOperations;
  h.history.restore(scope, oldState); assert.equal(currentBinding(), null);
  h.history.restore(scope, h.history.rebuildEditorStateFromHistory(scope)); assert.equal(currentBinding().after.column, "customerName");
});
test("binding stores are isolated by draft", () => {
  const other = { ...scope, layoutDraftId: `${scope.layoutDraftId}_other` }; h.setup(other);
  h.binding.upsert({ ...other, ...bindOperation("applicantName") });
  assert.equal(h.binding.list(other)[0].after.column, "applicantName"); assert.equal(currentBinding().after.column, "customerName"); h.cleanup(other);
});
test("forced undo failure preserves cursor and every store", () => {
  const cursor = h.history.get(scope).cursor, state = h.history.capture(scope);
  assert.throws(() => h.history.undo(scope, { forceFailure: true }), (error) => error.code === "HISTORY_REBUILD_FAILED");
  assert.equal(h.history.get(scope).cursor, cursor); assert.deepEqual(h.history.capture(scope), state);
});
test("forced redo failure preserves cursor and every store", () => {
  h.history.undo(scope); const cursor = h.history.get(scope).cursor, state = h.history.capture(scope);
  assert.throws(() => h.history.redo(scope, { forceFailure: true }), (error) => error.code === "HISTORY_REBUILD_FAILED");
  assert.equal(h.history.get(scope).cursor, cursor); assert.deepEqual(h.history.capture(scope), state); h.history.redo(scope);
});
test("invalid binding target fails closed", () => assert.throws(() => h.binding.replaceScope(scope, [bindOperation("applicantName"), { ...bindOperation("applicantName"), target: { objectId: "MISSING" } }]), (error) => error.code === "BINDING_TARGET_NOT_FOUND"));
test("current cursor unified materialization", () => {
  const finalCursor = h.history.get(scope).cursor;
  const cursors = [0, 1, 2, 3, finalCursor];
  for (const cursor of cursors) assert.equal(materialize(cursor, `cursor_${cursor}`).validation.parseBack, true);
});
test("base, mid, and final candidates carry distinct semantic states", () => {
  const finalCursor = h.history.get(scope).cursor;
  const results = [materialize(0, "base"), materialize(1, "mid"), materialize(finalCursor, "final")];
  assert.equal(new Set(results.map((result) => result.signature)).size, 3);
  const mid = readForm(results[1].candidateFormPath), final = readForm(results[2].candidateFormPath);
  assert.equal(findObjects(mid.pages, targetId)[0].item.column, "applicantName");
  assert.equal(findObjects(final.pages, targetId)[0].item.column, "customerName");
  assert.equal(decodedText(findObjects(final.pages, titleId)[0].item.text), "대출상담 및 신청서");
  assert.equal(findObjects(final.pages, tableId)[0].item.table[0][1].width, 240);
});
