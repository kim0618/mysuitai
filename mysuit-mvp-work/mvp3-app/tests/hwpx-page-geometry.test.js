const test = require('node:test');
const assert = require('node:assert/strict');
const { parseXml } = require('../src/server/hwpx/xml');
const { readPageGeometry, readPageBorder, paragraphBox, placeObject, controlPositions } = require('../src/server/hwpx/page-geometry');

const ns = 'xmlns:hp="urn:p"';
const page = (margin, extra = '') => parseXml(`<hp:pagePr ${ns} width="60000" height="80000" gutterType="LEFT_ONLY"><hp:margin ${margin}/>${extra}</hp:pagePr>`);
const pos = (attrs) => `<hp:pos treatAsChar="0" vertRelTo="PAPER" horzRelTo="PAPER" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0" ${attrs}/>`;
function anchored(posAttrs, geometry = readPageGeometry(page('left="3000" right="2000" top="1000" bottom="1500" header="500" footer="700" gutter="0"'))) {
  const node = parseXml(`<hp:tbl ${ns}>${pos(posAttrs)}<hp:sz width="10000" height="4000"/></hp:tbl>`);
  return placeObject(node, { width: 10000, height: 4000 }, { page: geometry, paragraph: null, paragraphBox: { x: 3500, y: 2500, width: 50000, lines: [] }, inlineCursor: new Map() });
}

test('page geometry derives the body area from pagePr margins including header and gutter', () => {
  const g = readPageGeometry(page('left="3000" right="2000" top="1000" bottom="1500" header="500" footer="700" gutter="400"'));
  assert.deepEqual({ width: g.width, height: g.height }, { width: 60000, height: 80000 });
  assert.deepEqual(g.body, { x: 3400, y: 1500, width: 54600, height: 76300 });
  const top = readPageGeometry(parseXml(`<hp:pagePr ${ns} width="60000" height="80000" gutterType="TOP_BOTTOM"><hp:margin left="0" right="0" top="1000" bottom="0" header="0" footer="0" gutter="400"/></hp:pagePr>`));
  assert.deepEqual(top.body, { x: 0, y: 1400, width: 60000, height: 78600 });
  assert.equal(readPageGeometry(null).source, 'FALLBACK_A4');
});

test('page border offset is recorded but never becomes a layout inset', () => {
  const section = parseXml(`<hp:sec ${ns}><hp:pagePr width="60000" height="80000"><hp:margin left="0" right="0" top="0" bottom="0" header="0" footer="0" gutter="0"/></hp:pagePr><hp:pageBorderFill type="BOTH" textBorder="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:sec>`);
  const border = readPageBorder(section), geometry = readPageGeometry(section.children[0]);
  assert.deepEqual(border.offset, { left: 1417, right: 1417, top: 1417, bottom: 1417 });
  assert.equal(border.layoutEffect, 'NONE');
  assert.deepEqual(geometry.body, { x: 0, y: 0, width: 60000, height: 80000 });
});

test('anchored objects resolve horzRelTo/vertRelTo against paper, page body, column and paragraph', () => {
  assert.deepEqual([anchored('horzOffset="1500" vertOffset="5924"').x, anchored('horzOffset="1500" vertOffset="5924"').y], [1500, 5924]);
  const onPage = anchored('horzRelTo="PAGE" vertRelTo="PAGE" horzOffset="100" vertOffset="200"');
  assert.deepEqual([onPage.x, onPage.y], [3100, 1700]);
  assert.equal(anchored('horzRelTo="COLUMN" horzOffset="100"').x, 3100);
  const onPara = anchored('horzRelTo="PARA" vertRelTo="PARA" horzOffset="10" vertOffset="20"');
  assert.deepEqual([onPara.x, onPara.y], [3510, 2520]);
  assert.equal(onPara.placement.mode, 'ANCHORED');
});

test('anchored alignment centers or right/bottom-aligns within the reference box', () => {
  assert.equal(anchored('horzAlign="CENTER"').x, 25000);
  assert.equal(anchored('horzAlign="RIGHT" horzOffset="1000"').x, 49000);
  assert.equal(anchored('vertAlign="BOTTOM" vertOffset="500"').y, 75500);
});

test('inline objects follow the lineseg that contains their text position, inside the body area', () => {
  const geometry = readPageGeometry(page('left="2000" right="2000" top="1000" bottom="1000" header="1000" footer="1000" gutter="0"'));
  const tbl = (w) => `<hp:tbl>${pos('treatAsChar="1" vertRelTo="PARA" horzRelTo="PARA"')}<hp:sz width="${w}" height="3000"/><hp:outMargin left="100" right="100" top="200" bottom="200"/></hp:tbl>`;
  const p = parseXml(`<hp:p ${ns}><hp:run><hp:t>ab</hp:t>${tbl(5000)}${tbl(6000)}</hp:run><hp:run>${tbl(7000)}</hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="3400" horzpos="0" horzsize="56000"/><hp:lineseg textpos="18" vertpos="4000" vertsize="3400" horzpos="0" horzsize="56000"/></hp:linesegarray></hp:p>`);
  const objects = p.children.flatMap((run) => run.children.filter((x) => x.local === 'tbl'));
  assert.deepEqual([...controlPositions(p).values()], [2, 10, 18]);
  const box = paragraphBox(p, geometry), cursor = new Map();
  const placed = objects.map((node, i) => placeObject(node, { width: [5000, 6000, 7000][i], height: 3000 }, { page: geometry, paragraph: p, paragraphBox: box, inlineCursor: cursor }));
  assert.deepEqual(placed.map(({ x, y }) => [x, y]), [[2100, 2200], [7300, 2200], [2100, 6200]]);
  assert.equal(placed[2].placement.lineTextpos, 18);
});

test('objects without hp:pos keep legacy placement', () => {
  const node = parseXml(`<hp:pic ${ns}><hp:offset x="1000" y="2000"/></hp:pic>`);
  assert.equal(placeObject(node, { width: 1, height: 1 }, { page: readPageGeometry(null), paragraph: null, paragraphBox: null, inlineCursor: new Map() }), null);
});
