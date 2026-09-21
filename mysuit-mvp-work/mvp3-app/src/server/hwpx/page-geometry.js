const { children, descendants, first, attr, textContent } = require('./xml');

// HWPX (OWPML) page and object placement semantics, all in HWPUNIT.
// Paper: pagePr width/height. Body area: paper minus pagePr/margin, where the
// header/footer areas sit inside the top/bottom margins of the body box. The
// pageBorderFill offset only positions the page border line; it is not a layout
// inset and never moves content.
const num = (node, name, fallback = 0) => { const value = Number(attr(node, name)); return Number.isFinite(value) ? value : fallback; };
const FALLBACK_PAPER = Object.freeze({ width: 59528, height: 84188 });

function readPageGeometry(pageNode) {
  const size = pageNode && (first(pageNode, 'pageSz') || pageNode), width = num(size, 'width', FALLBACK_PAPER.width), height = num(size, 'height', FALLBACK_PAPER.height);
  const marginNode = pageNode && first(pageNode, 'margin'), margins = Object.fromEntries(['left', 'right', 'top', 'bottom', 'header', 'footer', 'gutter'].map((key) => [key, num(marginNode, key)]));
  const gutterType = attr(pageNode, 'gutterType', 'LEFT_ONLY'), gutterTop = gutterType === 'TOP_BOTTOM' ? margins.gutter : 0, gutterLeft = gutterTop ? 0 : margins.gutter;
  const body = { x: margins.left + gutterLeft, y: margins.top + margins.header + gutterTop };
  body.width = Math.max(1, width - body.x - margins.right); body.height = Math.max(1, height - body.y - margins.bottom - margins.footer);
  return { width, height, landscape: attr(pageNode, 'landscape', null), gutterType, margins, body, source: pageNode ? 'HWPX_PAGE_PR' : 'FALLBACK_A4' };
}

function readPageBorder(sectionNode) {
  const node = descendants(sectionNode, 'pageBorderFill').find((n) => ['BOTH', 'ODD'].includes(attr(n, 'type')));
  if (!node) return null;
  const offset = first(node, 'offset');
  return { type: attr(node, 'type'), borderFillIDRef: attr(node, 'borderFillIDRef', null), textBorder: attr(node, 'textBorder', null), fillArea: attr(node, 'fillArea', null), offset: Object.fromEntries(['left', 'right', 'top', 'bottom'].map((key) => [key, num(offset, key)])), layoutEffect: 'NONE' };
}

// Characters a run child occupies in paragraph text positions (lineseg textpos).
// Inline controls (section/column definitions, tables, pictures, shapes, fields)
// occupy 8 code units like HWP5 extended controls; tabs are 8-wide inline controls.
function childLength(node) {
  if (node.local !== 't') return 8;
  let length = (node.text || '').length;
  for (const child of node.children || []) length += child.local === 'tab' ? 8 : Math.max(1, textContent(child).length);
  return length;
}

function lineSegments(paragraph) {
  const array = children(paragraph, 'linesegarray')[0];
  return children(array, 'lineseg').map((seg) => ({ textpos: num(seg, 'textpos'), vertpos: num(seg, 'vertpos'), vertsize: num(seg, 'vertsize'), horzpos: num(seg, 'horzpos'), horzsize: num(seg, 'horzsize') }));
}

// Text position of every run-level control in a paragraph.
function controlPositions(paragraph) {
  const out = new Map(); let cursor = 0;
  for (const run of children(paragraph, 'run')) for (const child of run.children || []) { if (child.local !== 't') out.set(child, cursor); cursor += childLength(child); }
  return out;
}

function paragraphBox(paragraph, page) {
  const lines = lineSegments(paragraph); if (!lines.length) return null;
  const top = lines[0], last = lines.at(-1);
  return { x: page.body.x + top.horzpos, y: page.body.y + top.vertpos, width: top.horzsize || page.body.width, height: Math.max(1, last.vertpos + last.vertsize - top.vertpos), lines };
}

function outMargin(node) { const m = children(node, 'outMargin')[0]; return { left: num(m, 'left'), right: num(m, 'right'), top: num(m, 'top'), bottom: num(m, 'bottom') }; }

function axis(align, offset, size, start, length) {
  const value = String(align || '').toUpperCase();
  if (value === 'CENTER') return start + (length - size) / 2 + offset;
  if (['RIGHT', 'BOTTOM', 'OUTSIDE'].includes(value)) return start + length - size - offset;
  return start + offset;
}

// Resolves a top-level object's paper-absolute box from hp:pos. Returns null when
// the object carries no hp:pos so callers keep their legacy placement.
function placeObject(node, size, { page, paragraph, paragraphBox: para, inlineCursor }) {
  const pos = children(node, 'pos')[0]; if (!pos) return null;
  const margin = outMargin(node), treatAsChar = ['1', 'true'].includes(String(attr(pos, 'treatAsChar')).toLowerCase());
  if (treatAsChar) {
    if (!para) return null;
    const textpos = controlPositions(paragraph).get(node) ?? 0, line = [...para.lines].reverse().find((seg) => seg.textpos <= textpos) || para.lines[0];
    const key = `${line.textpos}`, before = inlineCursor.get(key) || 0;
    inlineCursor.set(key, before + margin.left + size.width + margin.right);
    return { x: page.body.x + line.horzpos + before + margin.left, y: page.body.y + line.vertpos + margin.top, placement: { mode: 'INLINE', textpos, lineTextpos: line.textpos, lineVertpos: line.vertpos, lineHorzpos: line.horzpos, outMargin: margin } };
  }
  const horzRelTo = String(attr(pos, 'horzRelTo', 'PARA')).toUpperCase(), vertRelTo = String(attr(pos, 'vertRelTo', 'PARA')).toUpperCase();
  const paraBox = para || { x: page.body.x, y: page.body.y, width: page.body.width };
  // Single-column sections: COLUMN resolves to the body area. Multi-column
  // layouts are outside the import scope and fall back to the same box.
  const horizontal = { PAPER: [0, page.width], PAGE: [page.body.x, page.body.width], COLUMN: [page.body.x, page.body.width], PARA: [paraBox.x, paraBox.width] }[horzRelTo] || [paraBox.x, paraBox.width];
  const vertical = { PAPER: [0, page.height], PAGE: [page.body.y, page.body.height], PARA: [paraBox.y, page.body.y + page.body.height - paraBox.y] }[vertRelTo] || [paraBox.y, page.body.height];
  const horzOffset = num(pos, 'horzOffset'), vertOffset = num(pos, 'vertOffset'), horzAlign = attr(pos, 'horzAlign', 'LEFT'), vertAlign = attr(pos, 'vertAlign', 'TOP');
  return { x: axis(horzAlign, horzOffset, size.width, ...horizontal), y: axis(vertAlign, vertOffset, size.height, ...vertical), placement: { mode: 'ANCHORED', horzRelTo, vertRelTo, horzAlign, vertAlign, horzOffset, vertOffset } };
}

module.exports = { FALLBACK_PAPER, readPageGeometry, readPageBorder, lineSegments, controlPositions, paragraphBox, outMargin, placeObject, childLength };
