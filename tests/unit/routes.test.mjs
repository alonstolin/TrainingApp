import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  routeDistanceKm, closeLoop, outAndBack, bounds, nearestSegment, pointToSegmentMeters, insertWaypoint, makeRoute, validateRoute,
} from '../../src/core/routes.js';
import { validateBackup, buildBackup } from '../../src/core/schema.js';

// A ~1 km square: 0.0106° of longitude at 32° N ≈ 1.0 km, 0.009° of latitude ≈ 1.0 km.
const SQ = [
  { lat: 32.0804, lon: 34.7805 },
  { lat: 32.0804, lon: 34.7911 },
  { lat: 32.0714, lon: 34.7911 },
  { lat: 32.0714, lon: 34.7805 },
];

test('distance is the sum of straight segments, to two decimals', () => {
  assert.equal(routeDistanceKm([]), 0);
  assert.equal(routeDistanceKm([SQ[0]]), 0);
  const three = routeDistanceKm(SQ);
  assert.ok(three > 2.9 && three < 3.1, `three sides ≈ 3 km, got ${three}`);
  assert.equal(three, Math.round(three * 100) / 100);
});

test('closing the loop appends the start once and is idempotent', () => {
  const closed = closeLoop(SQ);
  assert.equal(closed.length, 5);
  assert.deepEqual(closed[4], SQ[0]);
  assert.equal(closeLoop(closed).length, 5, 'already closed');
  const four = routeDistanceKm(closed);
  assert.ok(four > 3.9 && four < 4.1);
  assert.deepEqual(closeLoop([SQ[0]]), [SQ[0]], 'a single point cannot close');
});

test('out and back mirrors the path and doubles the distance', () => {
  const ob = outAndBack(SQ.slice(0, 3));
  assert.equal(ob.length, 5);
  assert.deepEqual(ob[4], SQ[0]);
  assert.ok(Math.abs(routeDistanceKm(ob) - 2 * routeDistanceKm(SQ.slice(0, 3))) < 0.02);
});

test('bounds cover every waypoint', () => {
  assert.deepEqual(bounds(SQ), { minLat: 32.0714, maxLat: 32.0804, minLon: 34.7805, maxLon: 34.7911 });
  assert.equal(bounds([]), null);
});

test('a tap near the line inserts a corner on that segment; far away it appends', () => {
  const nearEast = { lat: 32.076, lon: 34.79115 }; // ~5 m off the east side
  const seg = nearestSegment(SQ, nearEast);
  assert.equal(seg.index, 2, 'between corners 1 and 2');
  assert.ok(seg.meters < 10);
  const inserted = insertWaypoint(SQ, seg.index, nearEast);
  assert.equal(inserted.length, 5);
  assert.deepEqual(inserted[2], nearEast);

  const far = { lat: 32.09, lon: 34.80 };
  assert.ok(nearestSegment(SQ, far).meters > 500);
  assert.deepEqual(insertWaypoint(SQ, null, far).at(-1), far);
});

test('point-to-segment distance is measured in metres, clamped to the segment', () => {
  const a = { lat: 32.08, lon: 34.78 };
  const b = { lat: 32.08, lon: 34.79 };
  assert.ok(Math.abs(pointToSegmentMeters({ lat: 32.081, lon: 34.785 }, a, b) - 110.5) < 2, 'one thousandth of a degree north ≈ 110 m');
  const beyond = pointToSegmentMeters({ lat: 32.08, lon: 34.80 }, a, b);
  assert.ok(beyond > 900 && beyond < 1000, 'past the end it is the distance to the endpoint');
});

test('makeRoute normalises the record and validateRoute catches junk', () => {
  const r = makeRoute({ id: 'r1', name: '  River loop ', waypoints: closeLoop(SQ), now: 5 });
  assert.equal(r.name, 'River loop');
  assert.equal(r.waypoints.length, 5);
  assert.ok(r.km > 3.9);
  assert.equal(r.createdAt, 5);
  assert.deepEqual(validateRoute(r), []);
  assert.equal(makeRoute({ id: 'x', name: '', waypoints: [] }).name, 'Untitled route');
  assert.ok(validateRoute({ id: 'bad', waypoints: [{ lat: 'x' }] }).length > 0);
  assert.ok(validateRoute(null).length > 0);
});

test('routes travel in the backup envelope and bad ones are dropped with a warning', () => {
  const good = makeRoute({ id: 'r1', name: 'Sq', waypoints: SQ });
  const payload = buildBackup({ startDate: '2026-01-05' }, [], [good, { id: 'r2', waypoints: 'nope' }], 'test');
  const v = validateBackup(payload);
  assert.equal(v.ok, true);
  assert.equal(v.data.routes.length, 1);
  assert.equal(v.data.routes[0].id, 'r1');
  assert.ok(v.warnings.some((w) => /route\[1\]/.test(w)));
  // Old backups without routes still validate and gain an empty list.
  const old = validateBackup({ format: 'trainingapp-backup', schemaVersion: 1, sessions: [], meta: {} });
  assert.deepEqual(old.data.routes, []);
});
