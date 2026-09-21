const test = require('node:test'), assert = require('node:assert/strict');
const snap = require('../src/client/object-snap');

const page = { width: 794, height: 1123 };
test('snaps an edge or centre within the snap distance to page lines and nearby objects', () => {
  const centred = snap.snap({ left: 390, top: 500, width: 10, height: 10 }, { page });
  assert.equal(centred.left, 392); assert.deepEqual(centred.guides.map((g) => [g.axis, g.at, g.kind]), [['x', 397, 'page-center']]);
  const edge = snap.snap({ left: 100, top: 96, width: 50, height: 20 }, { page, others: [{ id: 'a', left: 300, top: 100, width: 40, height: 40 }] });
  assert.equal(edge.top, 100); assert.equal(edge.guides[0].kind, 'object-edge');
  const far = snap.snap({ left: 100, top: 300, width: 50, height: 20 }, { page, others: [{ id: 'a', left: 700, top: 1000, width: 10, height: 10 }] });
  assert.deepEqual([far.left, far.top, far.guides.length], [100, 300, 0]);
});
test('the magnet can be switched off and the distance is a setting', () => {
  assert.equal(snap.SNAP.distance, 6);
  assert.deepEqual(snap.snap({ left: 390, top: 500, width: 10, height: 10 }, { page, magnet: false }).guides, []);
  assert.equal(snap.snap({ left: 380, top: 500, width: 10, height: 10 }, { page, distance: 12 }).left, 387);
});
test('structural snap picks the nearest allowed boundary only', () => {
  const boundaries = [{ k: 0, at: 0, allowed: true }, { k: 1, at: 20, allowed: false }, { k: 2, at: 40, allowed: true }];
  assert.equal(snap.nearestBoundary(22, boundaries).k, 2);
  assert.equal(snap.nearestBoundary(9, boundaries).k, 0);
  assert.equal(snap.nearestBoundary(9, boundaries.map((b) => ({ ...b, allowed: false }))), null);
});
