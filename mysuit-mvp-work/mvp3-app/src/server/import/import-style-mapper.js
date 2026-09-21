const SIDE_ORDER = Object.freeze(['bottom', 'left', 'right', 'top']);
const SIDE_NAME = Object.freeze({ top: 'borderTop', right: 'borderRight', bottom: 'borderBottom', left: 'borderLeft' });
const DEFAULT_CELL_STYLE = Object.freeze({ fontSize: 12, bold: false, textAlign: 'center', verticalAlign: 'middle', textColor: '#000000', backgroundColor: '#FFFFFF' });

function colorToInteger(hex) { return Number.parseInt(hex.slice(1), 16); }
function resolveCellStyle(style = {}) { return { ...DEFAULT_CELL_STYLE, ...style, border: style.border || {} }; }
function borderString(border = {}) { return SIDE_ORDER.map((side) => { const value=border[side]||{},visible=value.visible===true,color=visible?colorToInteger(value.color||'#000000'):0,width=value.width??1;return `type:${SIDE_NAME[side]},borderType:${visible?'SOLD':'none'},borderColor:${color},borderThickness:${width}` }).join('&'); }
function applyTextStyle(label, style) { label.fontSize=style.fontSize;label.fontWeight=style.bold?'bold':'normal';label.textAlign=style.textAlign;if(style.textColor)label.fontColor=colorToInteger(style.textColor);if(style.backgroundColor)label.backgroundColor=colorToInteger(style.backgroundColor);if(style.verticalAlign)label.verticalAlign=style.verticalAlign;return label; }
function applyCellStyle(wrapper, cell, style) { const resolved=resolveCellStyle(style);cell.fontSize=resolved.fontSize;cell.fontWeight=resolved.bold?'bold':'normal';cell.textAlign=resolved.textAlign;cell.verticalAlign=resolved.verticalAlign;cell.fontColor=colorToInteger(resolved.textColor);cell.backgroundColor=colorToInteger(resolved.backgroundColor);wrapper.borderString=borderString(resolved.border);return resolved; }
module.exports={SIDE_ORDER,DEFAULT_CELL_STYLE,colorToInteger,resolveCellStyle,borderString,applyTextStyle,applyCellStyle};
