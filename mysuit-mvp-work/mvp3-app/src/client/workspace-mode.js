// Single source of truth for the Builder workspace mode: 'chat' | 'direct-edit' | 'data-binding'.
// Only direct-edit allows Viewer editing interaction (selection, overlays, handles, formatting toolbar).
// Viewer navigation (zoom, page, search, print, PDF, scroll) and the rendered edit results are unaffected.
// Pages without the Builder shell never change the mode, so the legacy editor keeps direct-edit.
(function () {
  let mode = 'direct-edit';
  window.MvpWorkspaceMode = {
    get mode() { return mode; },
    directEdit() { return mode === 'direct-edit'; },
    set(next) {
      if (!['chat', 'direct-edit', 'data-binding'].includes(next) || next === mode) return;
      const leavingDirectEdit = mode === 'direct-edit';
      mode = next;
      document.body.dataset.workspaceMode = mode;
      window.dispatchEvent(new CustomEvent('mvp:workspace-mode', { detail: { mode, leavingDirectEdit } }));
    },
  };
})();
