// Designer Band overlay (developer 편집하기 only).
// Bands come from the form the Viewer is showing (/api/ai-builder/bands). A band's area on the page is where its objects
// were rendered (repeated DataBand rows included); a band without rendered objects falls back to its design box.
// Imported HWPX forms have no bands; nothing is invented for them.
(function () {
  if (window.__formContext?.origin === undefined) return;
  // The overlay lives in the Viewer frame, which cannot read the Studio CSS variables; they are read from the Builder page.
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  // Fills are translucent tints of the accent so the document stays readable underneath.
  // The label is a small mint chip with green text, so it never competes with the document.
  const palette = () => { const primary = token('--studio-primary'); return { line: `color-mix(in srgb, ${primary} 30%, transparent)`, fill: `color-mix(in srgb, ${primary} 3%, transparent)`, selected: primary, selectedFill: `color-mix(in srgb, ${primary} 6%, transparent)`, chip: token('--studio-primary-soft'), chipLine: token('--studio-primary-border'), accent: primary, onAccent: token('--studio-surface'), muted: token('--studio-text-muted'), font: token('--studio-font') }; };
  let colors = palette();
  let info = null, frame = null, canvas = null, overlays = [], visible = true, selected = null, loading = null;
  const developer = () => document.body.dataset.surface === 'developer';
  const editing = () => window.MvpWorkspaceMode?.directEdit?.() !== false;
  const bandOf = (id) => /^[A-Za-z][A-Za-z0-9]*_([A-Za-z][A-Za-z0-9_]*)_ROW\d+$/.exec(id || '')?.[1] || null;
  function clear() { for (const node of overlays) node.remove(); overlays = []; }
  // Canvas extent of a band: the union of its rendered objects, else its design box.
  function extent(band) {
    const objects = (canvas?.getObjects?.() || []).filter((o) => { const b = bandOf(o.id); return b && (b === band.id || b.endsWith(`_${band.id}`)) && o.visible !== false; });
    if (!objects.length) return { left: band.x, top: band.y, width: band.width, height: band.height };
    const top = Math.min(...objects.map((o) => o.top)), bottom = Math.max(...objects.map((o) => o.top + o.height * (o.scaleY || 1)));
    return { left: band.x, top, width: band.width, height: Math.max(bottom - top, 4) };
  }
  function draw() {
    clear(); colors = palette();
    if (!developer() || !visible || !editing() || !info?.bands?.length || !frame || !canvas || !window.MvpCoordinateAdapter) return;
    for (const band of info.bands) {
      let rect; try { rect = MvpCoordinateAdapter.canvasRectToScreen(frame, canvas, extent(band)); } catch (_) { return; }
      const chosen = selected === band.id;
      const box = frame.document.createElement('div');
      box.className = `studio-band${chosen ? ' selected' : ''}`; box.dataset.bandId = band.id;
      Object.assign(box.style, { position: 'fixed', zIndex: 2147482990, left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, boxSizing: 'border-box', border: chosen ? `1.5px solid ${colors.selected}` : `1px dashed ${colors.line}`, background: chosen ? colors.selectedFill : colors.fill, backgroundClip: 'padding-box', pointerEvents: 'none', borderRadius: '2px' });
      // The label is the only interactive part, so the band never blocks clicks on the document content.
      const chip = frame.document.createElement('button');
      chip.type = 'button'; chip.className = 'studio-band-label';
      chip.title = `${band.label} · ${band.engine}`;
      Object.assign(chip.style, { position: 'absolute', top: '-1px', right: '-1px', transform: 'translateY(-100%)', display: 'flex', alignItems: 'baseline', gap: '5px', margin: '0', padding: '0 6px', border: `1px solid ${chosen ? colors.selected : colors.chipLine}`, borderBottom: '0', borderRadius: '4px 4px 0 0', background: chosen ? colors.accent : colors.chip, color: chosen ? colors.onAccent : colors.accent, font: `600 10px/15px ${colors.font}`, whiteSpace: 'nowrap', opacity: chosen ? '1' : '.9', pointerEvents: 'auto', cursor: 'pointer' });
      const name = frame.document.createElement('span'); name.textContent = band.label;
      const engine = frame.document.createElement('small'); engine.textContent = band.dataSet ? `${band.engine} · ${band.dataSet}` : band.engine;
      // The engine name stays in the label for tooltips and tests but is shown only for the selected or hovered band.
      Object.assign(engine.style, { display: chosen ? 'inline' : 'none', font: `500 9px/15px ${colors.font}`, color: chosen ? colors.onAccent : colors.muted });
      chip.append(name, engine);
      chip.addEventListener('mouseenter', () => { engine.style.display = 'inline'; chip.style.opacity = '1'; });
      chip.addEventListener('mouseleave', () => { if (!chosen) { engine.style.display = 'none'; chip.style.opacity = '.9'; } });
      chip.addEventListener('mousedown', (event) => event.stopPropagation());
      chip.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); select(band.id); });
      box.append(chip); frame.document.body.appendChild(box); overlays.push(box);
    }
  }
  function select(id) {
    selected = info?.bands?.some((b) => b.id === id) ? id : null; draw();
    window.dispatchEvent(new CustomEvent('studio-band-selected', { detail: selected ? { band: info.bands.find((b) => b.id === selected), info } : null }));
  }
  async function load() {
    const viewer = document.getElementById('viewer'), scope = window.aiBuilder?.scope;
    frame = viewer?.contentWindow; canvas = frame?.canvasModule?.getCanvas?.(0);
    if (!developer() || !scope || !canvas) return null;
    const viewProject = new URL(viewer.src, location.href).searchParams.get('projectName') || scope.projectName;
    const response = await fetch(`/api/ai-builder/bands?${new URLSearchParams({ projectName: scope.projectName, formName: scope.formName, viewProject })}`), body = await response.json();
    if (!response.ok || body.success === false) { info = null; draw(); return null; }
    info = body; if (selected && !info.bands.some((b) => b.id === selected)) selected = null;
    frame.addEventListener('resize', draw); frame.addEventListener('scroll', draw, true);
    draw(); window.dispatchEvent(new CustomEvent('studio-bands-loaded', { detail: info }));
    return info;
  }
  const refresh = () => (loading = load().catch(() => null));
  window.addEventListener('mysuit-editor-attached', () => setTimeout(refresh, 300));
  window.addEventListener('mvp:workspace-mode', draw);
  window.addEventListener('mysuit-static-structure-changed', () => setTimeout(draw, 50));
  window.addEventListener('mysuit-previews-applied', () => setTimeout(draw, 50));
  window.MvpDesignerBands = { refresh, draw, select, clear: () => { if (selected) { selected = null; draw(); } }, setVisible(value) { visible = Boolean(value); draw(); }, get visible() { return visible; }, get selected() { return selected; }, get info() { return info; }, get ready() { return loading; } };
})();
