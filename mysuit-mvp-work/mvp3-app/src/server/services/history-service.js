const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto"),
  config = require("../config"),
  locks = require("../utils/file-lock");
const file = path.join(config.appRoot, "data/history.json"),
  LIMIT = 200;
const formContext = require('./form-context-service');
function fail(code, message, status = 400) {
  throw Object.assign(new Error(message), { code, status });
}
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function normalizeScope(value = {}) {
  const layoutDraftId = value.layoutDraftId || value.draftId;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(layoutDraftId || ""))
    fail("INVALID_HISTORY_SCOPE", "지원하지 않는 History 범위입니다.");
  let context; try { context = formContext.resolve(value); } catch (_) { fail("INVALID_HISTORY_SCOPE", "지원하지 않는 History 범위입니다."); }
  return { layoutDraftId, projectName: context.projectName, formName: context.formName };
}
function key(scope) {
  return `${scope.layoutDraftId}|${scope.projectName}|${scope.formName}`;
}
function load() {
  if (!fs.existsSync(file)) return { schemaVersion: 1, drafts: {} };
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!value || value.schemaVersion !== 1 || typeof value.drafts !== "object")
      throw new Error();
    return value;
  } catch (_) {
    fail("HISTORY_CORRUPTED", "History Store를 읽을 수 없습니다.", 500);
  }
}
function save(value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n");
  fs.renameSync(temp, file);
}
function services() {
  return {
    structure: require("./structure-operation-service"),
    render: require("./render-patch-service"),
    changes: require("./changeset-service"),
    binding: require("./binding-operation-service"),
  };
}
function capture(scope) {
  const s = services(),
    cs = s.changes.findDraft(scope);
  return {
    sourcePatches: clone(cs?.patches || []),
    renderPositionPatches: clone(s.render.list(scope)),
    structureOperations: clone(s.structure.list(scope)),
    bindingOperations: clone(s.binding.list(scope)),
    structuralState: require('./structural-history-service').get(scope),
  };
}
function restore(scope, state) {
  const s = services();
  require('./structural-history-service').replace(scope, state.structuralState || null);
  s.changes.replaceDraftPatches(scope, state.sourcePatches || []);
  s.render.replaceScope(scope, state.renderPositionPatches || []);
  s.structure.replaceScope(scope, state.structureOperations || []);
  s.binding.replaceScope(scope, state.bindingOperations || []);
  return capture(scope);
}
function labelFor(event) {
  const op = event.operation,
    target = event.target || {},
    before = event.before || {},
    after = event.after || {};
  const labels = {
    updateText: `${target.objectLabel || target.sourceObjectId || "객체"} 문구 변경`,
    setFontSize: `${target.objectLabel || "객체"} 글꼴 크기 변경`,
    setFontWeight: `${target.objectLabel || "객체"} 굵기 변경`,
    setTextAlign: `${target.objectLabel || "객체"} 정렬 변경`,
    resizeObject: `${target.objectLabel || "객체"} 크기 변경`,
    hideObject: `${target.objectLabel || "객체"} 숨김`,
    restoreObject: `${target.objectLabel || "객체"} 복원`,
    moveRenderObject: `${target.objectLabel || target.viewerObjectId || "렌더 객체"} 위치 이동`,
    resizeColumn: `${target.columnLabel || `Column ${target.columnIndex ?? ""}`} 너비 ${before.width ?? before.beforeWidth ?? ""} → ${after.width ?? after.afterWidth ?? ""}`,
    moveColumn: `${target.columnLabel || `Column ${target.columnIndex ?? ""}`} 순서 이동`,
    hideColumn: `${target.columnLabel || `Column ${target.columnIndex ?? ""}`} 숨김`,
    restoreColumn: `${target.columnLabel || "Column"} 복원`,
    resizeRow: `${target.rowLabel || "행"} 높이 변경`,
    hideRow: `${target.rowLabel || "행"} 숨김`,
    restoreRow: `${target.rowLabel || "행"} 복원`,
    collapseRow: `${target.rowLabel || "Header 행"} 공간 제거`,
    moveRenderedRow: `${target.rowLabel || "상세 행"} 화면 순서 이동`,
    moveTable: "본문 표 위치 이동",
    resizeTableWidth: "본문 표 너비 변경",
    hideTable: "본문 표 출력 숨김",
    restoreTable: "본문 표 복원",
    collapseTable: "본문 표 출력 및 공간 제거",
    addStaticColumn: `${target.columnLabel || "Static Column"} 추가`,
    removeColumn: `${target.columnLabel || "Column"} 제거`,
    addBoundColumn: `${target.columnLabel || "Bound Column"} 추가`,
    addStaticRow: `${target.rowLabel || "Static Row"} 추가`,
    removeStaticRow: `${target.rowLabel || "Static Row"} 제거`,
    bindField: `${target.objectLabel || target.objectId || "객체"} 데이터 연결`,
    unbindField: `${target.objectLabel || target.objectId || "객체"} 데이터 연결 해제`,
    ARRAY_BINDING_APPLY: `${target.tableId || "표"} 반복 데이터 연결`,
  };
  return labels[op] || op;
}
function publicDraft(draft) {
  const events = (draft?.events || []).map(
      ({ beforeState, afterState, ...event }) => event,
    ),
    cursor = draft?.cursor || 0;
  const activeState = cursor === 0 ? draft?.baseState : draft?.events?.[cursor - 1]?.afterState;
  const structuralState = activeState?.structuralState || null;
  return {
    schemaVersion: 1,
    cursor,
    events,
    canUndo: cursor > 0,
    canRedo: cursor < events.length,
    structuralState,
    previewUrl: structuralState ? require('./structural-history-service').previewUrl(structuralState) : null,
  };
}
function get(scopeValue) {
  const scope = normalizeScope(scopeValue),
    root = load(),
    draft = root.drafts[key(scope)];
  return {
    ...publicDraft(draft),
    draftId: scope.layoutDraftId,
    projectName: scope.projectName,
    formName: scope.formName,
  };
}
function transact(scopeValue, descriptor, mutation) {
  const scope = normalizeScope(scopeValue),
    lockKey = `history:${key(scope)}`;
  if (!locks.acquire(lockKey))
    fail("LOCKED", "History transaction이 진행 중입니다.", 409);
  const before = capture(scope);
  try {
    const result = mutation(),
      after = capture(scope);
    if (JSON.stringify(before) === JSON.stringify(after) && !descriptor.forceRecord)
      return { result, history: get(scope) };
    const root = load(),
      k = key(scope),
      draft = root.drafts[k] || {
        projectName: scope.projectName,
        formName: scope.formName,
        cursor: 0,
        events: [],
        baseState: before,
      };
    if (draft.cursor < draft.events.length)
      draft.events = draft.events.slice(0, draft.cursor);
    if (draft.events.length >= LIMIT) {
      restore(scope, before);
      fail(
        "HISTORY_LIMIT_REACHED",
        `History는 최대 ${LIMIT}개까지 저장할 수 있습니다.`,
        409,
      );
    }
    const now = new Date().toISOString(),
      event = {
        schemaVersion: 1,
        historyEventId: `hist_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
        userActionId:
          descriptor.userActionId ||
          `action_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`,
        sequence: draft.events.length + 1,
        timestamp: now,
        draftId: scope.layoutDraftId,
        projectName: scope.projectName,
        formName: scope.formName,
        scope: descriptor.scope,
        operation: descriptor.operation,
        target: clone(descriptor.target || {}),
        before: clone(descriptor.before || {}),
        after: clone(descriptor.after || {}),
        sourceOperationId:
          descriptor.sourceOperationId ||
          result?.operationId ||
          result?.patchId ||
          null,
        generatedIds: clone(descriptor.generatedIds || {}),
        internalOperations: clone(descriptor.internalOperations || []),
        label: descriptor.label || labelFor(descriptor),
        beforeState: before,
        afterState: after,
      };
    draft.events.push(event);
    draft.cursor = draft.events.length;
    root.drafts[k] = draft;
    try {
      save(root);
    } catch (error) {
      restore(scope, before);
      throw error;
    }
    return {
      result,
      history: publicDraft(draft),
      event: publicDraft({ cursor: 1, events: [event] }).events[0],
    };
  } catch (error) {
    try {
      restore(scope, before);
    } catch (_) {}
    throw error;
  } finally {
    locks.release(lockKey);
  }
}
function moveCursor(scopeValue, direction, options = {}) {
  const scope = normalizeScope(scopeValue),
    lockKey = `history:${key(scope)}`;
  if (!locks.acquire(lockKey))
    fail("LOCKED", "Undo/Redo가 진행 중입니다.", 409);
  const currentState = capture(scope);
  try {
    const root = load(),
      k = key(scope),
      draft = root.drafts[k];
    if (!draft)
      fail(
        direction < 0 ? "NOTHING_TO_UNDO" : "NOTHING_TO_REDO",
        direction < 0
          ? "실행 취소할 변경이 없습니다."
          : "다시 실행할 변경이 없습니다.",
        409,
      );
    const target = draft.cursor + direction;
    if (target < 0 || target > draft.events.length)
      fail(
        direction < 0 ? "NOTHING_TO_UNDO" : "NOTHING_TO_REDO",
        direction < 0
          ? "실행 취소할 변경이 없습니다."
          : "다시 실행할 변경이 없습니다.",
        409,
      );
    if (options.forceFailure)
      fail(
        "HISTORY_REBUILD_FAILED",
        "테스트용 History rebuild 실패입니다.",
        500,
      );
    const state =
      target === 0 ? draft.baseState : draft.events[target - 1].afterState;
    restore(scope, state);
    const previous = draft.cursor;
    draft.cursor = target;
    try {
      save(root);
    } catch (error) {
      restore(scope, currentState);
      draft.cursor = previous;
      throw error;
    }
    return {
      ...publicDraft(draft),
      appliedEvent:
        direction < 0
          ? publicDraft({ cursor: 1, events: [draft.events[target]] }).events[0]
          : publicDraft({ cursor: 1, events: [draft.events[target - 1]] })
              .events[0],
    };
  } catch (error) {
    try {
      restore(scope, currentState);
    } catch (_) {}
    throw error;
  } finally {
    locks.release(lockKey);
  }
}
function undo(scope, options) {
  return moveCursor(scope, -1, options);
}
function redo(scope, options) {
  return moveCursor(scope, 1, options);
}
function clear(scopeValue) {
  const scope = normalizeScope(scopeValue),
    root = load(),
    k = key(scope),
    removed = root.drafts[k] || null;
  delete root.drafts[k];
  save(root);
  require('./structural-history-service').clear(scope);
  return publicDraft(removed);
}
function rebuildEditorStateFromHistory(scopeValue, cursor) {
  const scope = normalizeScope(scopeValue),
    draft = load().drafts[key(scope)];
  if (!draft) return capture(scope);
  const target = Math.max(
    0,
    Math.min(
      Number.isInteger(cursor) ? cursor : draft.cursor,
      draft.events.length,
    ),
  );
  return clone(
    target === 0 ? draft.baseState : draft.events[target - 1].afterState,
  );
}
module.exports = {
  LIMIT,
  normalizeScope,
  load,
  get,
  capture,
  restore,
  transact,
  undo,
  redo,
  clear,
  rebuildEditorStateFromHistory,
  labelFor,
};
