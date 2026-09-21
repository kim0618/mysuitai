// Magnet / snap foundation for free objects (text, image) in Direct Edit.
// Pure geometry: given the dragged rectangle, the page and nearby object rectangles, it returns the snapped position and
// the guide lines to draw. Distances are in canvas (page) pixels; nothing here depends on a particular document.
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; else root.MvpObjectSnap = api; })(typeof window !== 'undefined' ? window : globalThis, function () {
  const SNAP = Object.freeze({ distance: 6, nearbyRange: 240 });
  let enabled = true;
  const edges = (r) => ({ x: [r.left, r.left + r.width / 2, r.left + r.width], y: [r.top, r.top + r.height / 2, r.top + r.height] });
  // Candidate lines: page edges and centres, plus edges and centres of objects near the dragged one.
  function targets(page, others = [], moving, range = SNAP.nearbyRange) {
    const x = [{ at: 0, kind: 'page' }, { at: page.width / 2, kind: 'page-center' }, { at: page.width, kind: 'page' }];
    const y = [{ at: 0, kind: 'page' }, { at: page.height / 2, kind: 'page-center' }, { at: page.height, kind: 'page' }];
    for (const o of others) {
      if (moving && (o.left > moving.left + moving.width + range || o.left + o.width < moving.left - range || o.top > moving.top + moving.height + range || o.top + o.height < moving.top - range)) continue;
      const e = edges(o); e.x.forEach((at, i) => x.push({ at, kind: i === 1 ? 'object-center' : 'object-edge', id: o.id })); e.y.forEach((at, i) => y.push({ at, kind: i === 1 ? 'object-center' : 'object-edge', id: o.id }));
    }
    return { x, y };
  }
  function axis(points, lines, distance) {
    let best = null;
    for (const p of points) for (const line of lines) { const d = line.at - p; if (Math.abs(d) <= distance && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line }; }
    return best;
  }
  // Returns { left, top, guides:[{axis:'x'|'y', at, kind}] }. With the magnet off it returns the input unchanged.
  function snap(rect, { page, others = [], distance = SNAP.distance, magnet = enabled } = {}) {
    if (!magnet || !page) return { left: rect.left, top: rect.top, guides: [] };
    const t = targets(page, others, rect), e = edges(rect), sx = axis(e.x, t.x, distance), sy = axis(e.y, t.y, distance), guides = [];
    if (sx) guides.push({ axis: 'x', at: sx.line.at, kind: sx.line.kind });
    if (sy) guides.push({ axis: 'y', at: sy.line.at, kind: sy.line.kind });
    return { left: rect.left + (sx ? sx.delta : 0), top: rect.top + (sy ? sy.delta : 0), guides };
  }
  // Structural snap for table tracks: the nearest allowed boundary to a pointer coordinate (no free positions).
  function nearestBoundary(pointer, boundaries) {
    let best = null; for (const b of boundaries) if (b.allowed && (!best || Math.abs(b.at - pointer) < Math.abs(best.at - pointer))) best = b;
    return best;
  }
  return { SNAP, snap, targets, nearestBoundary, get enabled() { return enabled; }, setEnabled(value) { enabled = Boolean(value); } };
});
