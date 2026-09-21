const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  config = require("../config"),
  locks = require("../utils/file-lock"),
  formContext = require("./form-context-service");
const { readForm, findObjects } = require("./form-patch-service");

const file = path.join(config.appRoot, "data/binding-operations.json");

function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { code, status });
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function normalizeScope(value = {}) {
  const layoutDraftId = value.layoutDraftId || value.draftId;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(layoutDraftId || ""))
    fail("INVALID_BINDING_SCOPE", "지원하지 않는 Binding 범위입니다.");
  let context;
  try { context = formContext.resolve(value); }
  catch (_) { fail("INVALID_BINDING_SCOPE", "지원하지 않는 Binding 범위입니다."); }
  return { layoutDraftId, projectName: context.projectName, formName: context.formName };
}
function load() {
  if (!fs.existsSync(file)) return [];
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(value) ? value : value.operations || [];
  } catch (_) {
    fail("BINDING_STORE_CORRUPTED", "Binding Store를 읽을 수 없습니다.", 500);
  }
}
function save(operations) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`;
  fs.writeFileSync(temp, JSON.stringify({ schemaVersion: 1, operations }, null, 2) + "\n");
  fs.renameSync(temp, file);
}
const same = (a, b) => a.layoutDraftId === b.layoutDraftId && a.projectName === b.projectName && a.formName === b.formName;
function list(value) {
  const scope = normalizeScope(value);
  return load().filter((operation) => same(operation, scope)).sort((a, b) => a.sequence - b.sequence);
}
function targetId(operation) {
  return operation?.target?.objectId || operation?.sourceObjectId;
}
function validateTarget(scope, id) {
  const context = formContext.resolve(scope);
  const form = context.form || path.join(config.projectsRoot, context.projectName, context.formName, "form.ubjf");
  const matches = findObjects(readForm(form).pages, id);
  if (matches.length !== 1 || !["UBLabel", "Cell"].includes(matches[0].item.className))
    fail("BINDING_TARGET_NOT_FOUND", `Binding target을 정확히 하나 찾을 수 없습니다: ${id}`, 404);
}
function normalize(body, scope) {
  if (!body || !["bindField", "unbindField"].includes(body.operation))
    fail("INVALID_BINDING_OPERATION", "지원하지 않는 Binding operation입니다.");
  const id = targetId(body);
  if (!id) fail("INVALID_BINDING_OPERATION", "Binding target ID가 필요합니다.");
  validateTarget(scope, id);
  if (body.operation === "bindField") {
    const binding = body.after || body.binding;
    if (!binding || !["1", "3"].includes(String(binding.dataType)))
      fail("INVALID_BINDING_OPERATION", "Binding after 값이 올바르지 않습니다.");
    if (String(binding.dataType) === "1" && (!binding.dataSet || !binding.column))
      fail("INVALID_BINDING_OPERATION", "Dataset과 column이 필요합니다.");
    if (String(binding.dataType) === "3" && !binding.parameter)
      fail("INVALID_BINDING_OPERATION", "Parameter가 필요합니다.");
  }
  return { ...clone(body), ...scope, target: { ...(body.target || {}), objectId: id } };
}
function upsert(body) {
  const scope = normalizeScope(body), operation = normalize(body, scope), id = targetId(operation), lockKey = `binding:${scope.layoutDraftId}`;
  if (!locks.acquire(lockKey)) fail("LOCKED", "Binding 저장이 진행 중입니다.", 409);
  try {
    const all = load(), scoped = all.filter((item) => same(item, scope));
    const index = all.findIndex((item) => same(item, scope) && targetId(item) === id);
    const now = new Date().toISOString();
    if (index >= 0) {
      all[index] = { ...all[index], ...operation, bindingOperationId: all[index].bindingOperationId, sequence: all[index].sequence, createdAt: all[index].createdAt, updatedAt: now };
      save(all);
      return clone(all[index]);
    }
    const value = { bindingOperationId: `bop_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`, type: "BINDING", sequence: Math.max(0, ...scoped.map((item) => item.sequence || 0)) + 1, ...operation, createdAt: now, updatedAt: now };
    all.push(value); save(all); return clone(value);
  } finally { locks.release(lockKey); }
}
function clear(value) {
  const scope = normalizeScope(value), all = load(), removed = all.filter((item) => same(item, scope));
  save(all.filter((item) => !same(item, scope)));
  return clone(removed);
}
function replaceScope(value, operations) {
  const scope = normalizeScope(value), all = load();
  const values = (operations || []).map((operation) => normalize(operation, scope));
  const seen = new Set();
  for (const operation of values) {
    const id = targetId(operation);
    if (seen.has(id)) fail("INVALID_BINDING_STATE", `Binding target이 중복되었습니다: ${id}`);
    seen.add(id);
  }
  save([...all.filter((item) => !same(item, scope)), ...values]);
  return list(scope);
}

module.exports = { load, list, upsert, clear, replaceScope, normalizeScope, targetId };
