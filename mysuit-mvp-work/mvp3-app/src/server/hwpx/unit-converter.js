const HWPUNIT_PER_INCH = 7200;
const DIM_DPI = 96;
const FALLBACK_PAGE = Object.freeze({ width: 794, height: 1123 });

function hwpToDim(value) { return Number(value) * DIM_DPI / HWPUNIT_PER_INCH; }
function createPageConverter(sourcePage) {
  const rawWidth = Number(sourcePage?.width), rawHeight = Number(sourcePage?.height);
  if (!(rawWidth > 0 && rawHeight > 0)) return { page: { ...FALLBACK_PAGE }, length: hwpToDim, x: hwpToDim, y: hwpToDim, source: 'HWPUNIT_7200_PER_INCH' };
  const portrait = rawHeight >= rawWidth, target = portrait ? FALLBACK_PAGE : { width: FALLBACK_PAGE.height, height: FALLBACK_PAGE.width };
  const sx = target.width / rawWidth, sy = target.height / rawHeight;
  return { page: target, length: (v) => Number(v) * Math.min(sx, sy), x: (v) => Number(v) * sx, y: (v) => Number(v) * sy, source: 'NORMALIZED_TO_IMPORT_TEMPLATE' };
}

module.exports = { HWPUNIT_PER_INCH, DIM_DPI, FALLBACK_PAGE, hwpToDim, createPageConverter };
