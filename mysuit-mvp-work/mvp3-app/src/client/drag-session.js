// One drag lifecycle for Direct Edit: start → update → finish | cancel.
// A session listens on the Builder window and on the Viewer frame window, so releasing the pointer anywhere (over the
// right panel, outside the Viewer, after the window lost focus) ends it. finish/cancel always run the same cleanup:
// listeners removed, pointer capture released, cursor reset and the session's temporary overlays cleared.
(function (root) {
  let active = null;
  function end(kind, event) {
    const session = active; if (!session) return;
    active = null;
    for (const [target, type, fn] of session.listeners) target.removeEventListener(type, fn, true);
    try { if (session.captureTarget?.hasPointerCapture?.(session.pointerId)) session.captureTarget.releasePointerCapture(session.pointerId); } catch (_) {}
    for (const doc of session.cursorDocs) { doc.documentElement.style.cursor = ''; doc.body?.classList.remove('mvp-dragging'); }
    try { session.cleanup?.(); } catch (_) {}
    try { if (kind === 'finish') session.onFinish?.(event); else session.onCancel?.(event); } catch (error) { root.console?.error?.(error); }
  }
  function start(options) {
    if (active) end('cancel');
    const windows = [...new Set([root, ...(options.windows || [])].filter(Boolean))];
    const session = { ...options, pointerId: options.pointerId, listeners: [], cursorDocs: windows.map((w) => w.document).filter(Boolean) };
    active = session;
    const on = (target, type, fn) => { target.addEventListener(type, fn, true); session.listeners.push([target, type, fn]); };
    for (const w of windows) {
      on(w, 'pointermove', (e) => { if (active !== session) return; if (e.buttons === 0) return end('finish', e); session.onUpdate?.(e, w); });
      on(w, 'pointerup', (e) => end('finish', e));
      on(w, 'pointercancel', (e) => end('cancel', e));
      // Only a real loss of focus cancels; focus moving between the Builder and the Viewer frame does not.
      on(w, 'blur', (e) => setTimeout(() => { if (active === session && !root.document.hasFocus()) end('cancel', e); }));
      on(w, 'keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); end('cancel', e); } });
    }
    try { if (options.captureTarget && options.pointerId !== undefined) options.captureTarget.setPointerCapture(options.pointerId); } catch (_) {}
    for (const doc of session.cursorDocs) { doc.documentElement.style.cursor = options.cursor || 'grabbing'; doc.body?.classList.add('mvp-dragging'); }
    return session;
  }
  root.MvpDragSession = { start, finish: (event) => end('finish', event), cancel: (event) => end('cancel', event), get active() { return Boolean(active); } };
})(typeof window !== 'undefined' ? window : globalThis);
