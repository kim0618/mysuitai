(function () {
  const $ = (id) => document.getElementById(id),
    context = window.__formContext || {projectName:'sample',formName:'sample',origin:'ORIGINAL'},
    draftId = new URLSearchParams(location.search).get("layoutDraftId") || (context.origin==='IMPORTED'?`import_${context.projectName}_${context.formName}_default`.slice(0,80):"layout_sample_default"),
    scope = { draftId, projectName: context.projectName, formName: context.formName };
  let state = { cursor: 0, events: [], canUndo: false, canRedo: false },
    busy = false;
  async function api(url, options = {}) {
    const r = await fetch(url, {
        headers: { "content-type": "application/json" },
        ...options,
      }),
      d = await r.json();
    if (!r.ok || d.success === false)
      throw new Error(`${d.code}: ${d.message}`);
    return d;
  }
  function render() {
    const events = state.events || [];
    $("history-cursor").textContent = `${state.cursor} / ${events.length}`;
    $("nav-patch-count").textContent = state.cursor;
    $("nav-patch-count").title = `현재 적용된 사용자 작업 ${state.cursor}건`;
    $("history-undo").disabled = busy || !state.canUndo;
    $("history-redo").disabled = busy || !state.canRedo;
    const root = $("history-list");
    root.innerHTML = "";
    if (!events.length) {
      root.innerHTML = '<p class="empty">아직 변경 이력이 없습니다.</p>';
      return;
    }
    events.forEach((event, index) => {
      const item = document.createElement("article");
      item.className =
        "history-event" +
        (index >= state.cursor ? " redo" : "") +
        (index === state.cursor - 1 ? " current" : "");
      const seq = document.createElement("b"),
        label = document.createElement("span"),
        meta = document.createElement("small");
      seq.textContent = `${event.sequence}.`;
      label.textContent = event.label || event.operation;
      meta.textContent = index >= state.cursor ? "다시 실행 가능" : event.scope;
      item.append(seq, label, meta);
      root.append(item);
    });
  }
  async function load() {
    const q = new URLSearchParams(scope),
      d = await api(`/api/history?${q}`);
    state = d;
    render();
    return state;
  }
  async function move(kind) {
    if (busy) return;
    busy = true;
    render();
    try {
      const d = await api(`/api/history/${kind}`, {
        method: "POST",
        body: JSON.stringify(scope),
      });
      state = d;
      if (d.previewUrl) $("viewer").src = d.previewUrl;
      else if (state.structuralState?.kind === "STATIC_SOURCE") $("viewer").src = `/mysuit/UView5/index.jsp?projectName=${state.structuralState.projectName}&formName=${state.structuralState.formName}`;
      await window.mvpHistoryBridge?.refresh?.();
      await window.__mvp12?.loadOps?.();
      await load();
      window.aiBuilder?.renderInspector?.();
      const status = $("status");
      status.textContent =
        kind === "undo"
          ? "직전 사용자 작업을 실행 취소했습니다."
          : "사용자 작업을 다시 실행했습니다.";
      status.style.color = "#08745f";
    } catch (e) {
      const status = $("status");
      status.textContent = e.message;
      status.style.color = "#b42318";
      await load().catch(() => {});
    } finally {
      busy = false;
      render();
    }
  }
  $("history-undo").onclick = () => move("undo");
  $("history-redo").onclick = () => move("redo");
  function editable(target) {
    return (
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) ||
      target?.isContentEditable
    );
  }
  document.addEventListener(
    "keydown",
    (event) => {
      const key = event.key.toLowerCase();
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        !["z", "y"].includes(key) ||
        editable(event.target)
      )
        return;
      event.preventDefault();
      move(key === "y" || event.shiftKey ? "redo" : "undo");
    },
    true,
  );
  async function boot() {
    for (
      let i = 0;
      i < 100 && !window.mvpHistoryBridge?.getState?.().changeSetId;
      i++
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
    await window.mvpHistoryBridge?.refresh?.();
    await load();
  }
  setInterval(() => {
    if (!busy) load().catch(() => {});
  }, 1000);
  boot().catch(() => {});
  window.__mvp58 = {
    get state() {
      return state;
    },
    load,
    undo: () => move("undo"),
    redo: () => move("redo"),
  };
})();
