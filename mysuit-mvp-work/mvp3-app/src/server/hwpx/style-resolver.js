const { descendants, first, attr } = require('./xml');

const color = (value, fallback) => { if (value === undefined || value === null || value === '' || value === 'none') return fallback; const n = String(value).replace(/^#/, '').replace(/^0x/i, '').padStart(6, '0').slice(-6); return /^[0-9a-f]{6}$/i.test(n) ? `#${n.toUpperCase()}` : fallback; };
const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mapAlign = (value) => ({ LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'left', DISTRIBUTE: 'left' }[String(value).toUpperCase()] || 'left');
const mapVertical = (value) => ({ TOP: 'top', CENTER: 'middle', MIDDLE: 'middle', BOTTOM: 'bottom' }[String(value).toUpperCase()] || 'middle');

class StyleResolver {
  constructor(header) {
    this.charProps = new Map(descendants(header, 'charPr').map((n, i) => [String(attr(n, 'id', i)), n]));
    this.paraProps = new Map(descendants(header, 'paraPr').map((n, i) => [String(attr(n, 'id', i)), n]));
    this.borderFills = new Map(descendants(header, 'borderFill').map((n, i) => [String(attr(n, 'id', i)), n]));
    this.fidelity = [];
  }
  missing(kind, id) { this.fidelity.push({ kind, reference: String(id), status: 'PARTIAL', reason: 'REFERENCE_NOT_FOUND' }); }
  char(id) {
    const node = this.charProps.get(String(id)); if (!node) { if (id !== undefined) this.missing('characterProperty', id); return { fontSize: 12, bold: false, textColor: '#000000' }; }
    const bold = Boolean(first(node, 'bold')) || ['1', 'true'].includes(String(attr(node, 'bold')).toLowerCase());
    return { fontSize: Math.max(1, number(attr(node, 'height'), 1200) / 100), bold, textColor: color(attr(node, 'textColor'), '#000000'), ...(attr(node, 'shadeColor') ? { backgroundColor: color(attr(node, 'shadeColor'), '#FFFFFF') } : {}) };
  }
  para(id) { const node = this.paraProps.get(String(id)); if (!node) { if (id !== undefined) this.missing('paragraphProperty', id); return { textAlign: 'left' }; } const align = first(node, 'align'); return { textAlign: mapAlign(attr(align, 'horizontal', attr(node, 'align', 'left'))) }; }
  border(id) {
    const node = this.borderFills.get(String(id)); if (!node) { if (id !== undefined && String(id) !== '0') this.missing('borderFill', id); return {}; }
    const border = {}; for (const side of ['top', 'right', 'bottom', 'left']) { const item = first(node, side) || first(node, `${side}Border`); border[side] = { visible: item ? !['none', 'NONE', '0'].includes(attr(item, 'type', 'SOLID')) : false, color: color(attr(item, 'color'), '#000000'), width: Math.min(2, Math.max(0, number(String(attr(item, 'width', '')).match(/[\d.]+/)?.[0], 1))) }; }
    const fill = first(node, 'winBrush') || first(node, 'solidFill'); return { border, ...(fill ? { backgroundColor: color(attr(fill, 'faceColor', attr(fill, 'color')), '#FFFFFF') } : {}) };
  }
  resolve(charId, paraId, borderFillId, vertical) { return { ...this.char(charId), ...this.para(paraId), ...this.border(borderFillId), ...(vertical ? { verticalAlign: mapVertical(vertical) } : {}) }; }
}

module.exports = { StyleResolver, mapAlign, mapVertical, color };
