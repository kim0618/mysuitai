const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const config = require('../src/server/config');
const { analyzeHwpx, importHwpx } = require('../src/server/hwpx/hwpx-import-service');
const projectService = require('../src/server/import/import-project-service');
const { readForm } = require('../src/server/services/form-patch-service');

// Real HWPX originals are kept out of git (public repository). Place them in
// test-input/hwpx/ to run these regressions; otherwise the fixtures are skipped.
const FIXTURES = path.join(config.projectRoot, 'test-input/hwpx');
const PURCHASE_ORDER = path.join(FIXTURES, '발주서.hwpx'), PERSONNEL = path.join(FIXTURES, '인사.hwpx');
const box = (e) => ({ x: e.x, y: e.y, width: e.width, height: e.height });
const within = (e, page) => e.x >= 0 && e.y >= 0 && e.x + e.width <= page.width && e.y + e.height <= page.height;
const tableWithText = (dim, text) => dim.elements.find((e) => e.type === 'table' && e.rows.some((r) => r.cells.some((c) => c.text.includes(text))));
const near = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance;

test('발주서 page geometry: PAPER-anchored objects keep their source offsets', { skip: !fs.existsSync(PURCHASE_ORDER) && 'test-input/hwpx/발주서.hwpx not present' }, () => {
  const runs = [analyzeHwpx(PURCHASE_ORDER), analyzeHwpx(PURCHASE_ORDER), analyzeHwpx(PURCHASE_ORDER)], { semantic, dim } = runs[0];
  assert.deepEqual(runs.map((r) => r.signatures), [runs[0].signatures, runs[0].signatures, runs[0].signatures]);
  assert.deepEqual({ width: semantic.page.width, height: semantic.page.height }, { width: 59549, height: 84224 });
  assert.deepEqual(semantic.page.margins, { left: 0, right: 0, top: 0, bottom: 0, header: 0, footer: 0, gutter: 0 });
  assert.deepEqual(semantic.page.body, { x: 0, y: 0, width: 59549, height: 84224 });
  assert.deepEqual(semantic.page.pageBorder.offset, { left: 1417, right: 1417, top: 1417, bottom: 1417 });
  assert.deepEqual(dim.page, { width: 794, height: 1123 });
  assert.equal(dim.elements.filter((e) => e.type === 'table').length, 9);
  for (const e of dim.elements) assert.ok(within(e, dim.page), `${e.id} inside page`);

  const title = semantic.tables.find((t) => t.cells.some((c) => c.text.includes('발 주 서')));
  assert.deepEqual(box(title), { x: 20399, y: 1874, width: 18749, height: 3000 });
  assert.deepEqual(box(tableWithText(dim, '발 주 서')), { x: 272, y: 25, width: 250, height: 40 });
  assert.deepEqual(box(tableWithText(dim, '발주번호')), { x: 20, y: 79, width: 752, height: 100 });
  assert.deepEqual(box(tableWithText(dim, '구매의뢰번호')), { x: 20, y: 242, width: 752, height: 40 });
  assert.deepEqual(box(tableWithText(dim, '<<발주약정>>')), { x: 20, y: 902, width: 752, height: 199 });
  const main = dim.elements.filter((e) => e.type === 'table').sort((a, b) => b.rows.length - a.rows.length)[0];
  assert.deepEqual([main.rows.length, main.columns.length], [26, 9]);
  assert.deepEqual(box(main), { x: 20, y: 282, width: 752, height: 520 });
  // Vertical gaps between stacked tables come from the source, not from flow spacing.
  const scale = dim.page.height / semantic.page.height, source = [...semantic.tables].sort((a, b) => a.y - b.y), mapped = source.map((t) => dim.elements.find((e) => e.id === t.id));
  for (let i = 1; i < source.length; i++) if (source[i].x === source[i - 1].x) assert.ok(near(mapped[i].y - (mapped[i - 1].y + mapped[i - 1].height), (source[i].y - (source[i - 1].y + source[i - 1].height)) * scale), `${source[i].id} gap`);

  assert.equal(semantic.images.length, 1);
  assert.deepEqual(box(semantic.images[0]), { x: 42224, y: 2399, width: 14999, height: 1874 });
  assert.equal(semantic.images[0].placement.horzRelTo, 'COLUMN');
  const logo = dim.elements.find((e) => e.type === 'image');
  assert.deepEqual(box(logo), { x: 563, y: 32, width: 200, height: 25 });
  assert.equal(dim.assets.find((a) => a.id === logo.source.ref).sha256, semantic.assets[0].sha256);
  // The second picture carries no binaryItemIDRef in the source (empty placeholder).
  assert.deepEqual(semantic.styles.fidelity.filter((f) => f.reason === 'IMAGE_REFERENCE_MISSING').map((f) => [f.placement.horzOffset, f.placement.vertOffset]), [[46724, 61049]]);
});

test('발주서 geometry survives UBJF generation and reload', { skip: !fs.existsSync(PURCHASE_ORDER) && 'test-input/hwpx/발주서.hwpx not present' }, () => {
  const result = importHwpx(PURCHASE_ORDER);
  try {
    const expected = result.dim.elements.map(box), read = () => readForm(result.project.formPath).pages[0].items.filter((x) => ['UBTable', 'UBImage'].includes(x.className)).map(box);
    const first = read();
    assert.deepEqual(first, expected);
    assert.deepEqual(read(), first);
    const image = readForm(result.project.formPath).pages[0].items.find((x) => x.className === 'UBImage');
    assert.deepEqual(box(image), { x: 563, y: 32, width: 200, height: 25 });
    assert.ok(image.data.length > 0);
  } finally { projectService.removeImportedProject(result.project.projectName); }
});

test('인사 Golden fixture keeps structure and moves into the HWPX body area', { skip: !fs.existsSync(PERSONNEL) && 'test-input/hwpx/인사.hwpx not present' }, () => {
  const runs = [analyzeHwpx(PERSONNEL), analyzeHwpx(PERSONNEL), analyzeHwpx(PERSONNEL)], { semantic, dim } = runs[0];
  assert.deepEqual(runs.map((r) => r.signatures), [runs[0].signatures, runs[0].signatures, runs[0].signatures]);
  const cells = semantic.tables.flatMap((t) => t.cells);
  assert.deepEqual([semantic.tables.length, cells.length, cells.filter((c) => c.rowSpan > 1 || c.colSpan > 1).length, semantic.images.length], [8, 186, 56, 1]);
  const text = cells.map((c) => c.text).join('\n');
  for (const value of ['인사기록부', '문서번호', '보존년한', '문서관리', '보안관리', '인적사항', '개인자격', '봉사활동', '면허/자격', '어학', '연수', '가족사항', '성명']) assert.ok(text.includes(value), value);
  assert.deepEqual(semantic.page.body, { x: 1984, y: 2834, width: 55560, height: 78520 });
  const tables = dim.elements.filter((e) => e.type === 'table');
  assert.ok(tables.every((t) => t.x >= 26 && t.y >= 37 && within(t, dim.page)), 'tables start inside the body area');
  assert.deepEqual([tables[0].x, tables[0].y], [30, 42]);
  assert.deepEqual([tables.at(-1).x, tables.at(-1).y], [28, 941]);
  for (const e of dim.elements) assert.ok(within(e, dim.page), `${e.id} inside page`);
});
