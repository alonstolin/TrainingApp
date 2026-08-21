import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  haversineMeters, acceptPoint, buildTrack, trackDistanceKm,
  downsample, projectTrack, recentPace, DEFAULTS,
  createTrackBuilder, smoothingAlpha,
} from '../../src/core/geo.js';

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: got ${actual}, expected ~${expected}`);

// ---------------------------------------------------------------------------
// Distance
// ---------------------------------------------------------------------------

test('one degree of latitude is ~111.19km anywhere on the globe', () => {
  near(haversineMeters({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 111_195, 60, 'at the equator');
  near(haversineMeters({ lat: 51, lon: -0.1 }, { lat: 52, lon: -0.1 }), 111_195, 300, 'at 51°N');
});

test('longitude shrinks with latitude', () => {
  const atEquator = haversineMeters({ lat: 0, lon: 0 }, { lat: 0, lon: 1 });
  const at60 = haversineMeters({ lat: 60, lon: 0 }, { lat: 60, lon: 1 });
  // 111_195 not 111_320: haversine is spherical (mean radius 6_371_008.8m), so a
  // degree of longitude at the equator equals a degree of latitude. The larger
  // figure is the WGS84 ellipsoid's equatorial value, which does not apply here.
  near(atEquator, 111_195, 100, 'a degree of longitude at the equator');
  // cos(60°) = 0.5 exactly, so this is a clean check that the correction applies.
  near(at60 / atEquator, 0.5, 0.01, 'a degree of longitude at 60°N is half as wide');
});

test('a known real-world pair: London Eye to Big Ben is ~450m', () => {
  near(haversineMeters({ lat: 51.5033, lon: -0.1196 }, { lat: 51.5007, lon: -0.1246 }), 451, 15, 'across the Thames');
});

test('distance is symmetric and zero for a point against itself', () => {
  const a = { lat: 51.5, lon: -0.12 };
  const b = { lat: 51.51, lon: -0.13 };
  assert.equal(haversineMeters(a, a), 0);
  near(haversineMeters(a, b), haversineMeters(b, a), 1e-6, 'symmetry');
  assert.equal(haversineMeters(null, b), 0, 'a missing point is not a distance');
});

// ---------------------------------------------------------------------------
// Filtering — the part that decides whether the numbers are honest
// ---------------------------------------------------------------------------

const at = (lat, lon, t, acc = 5) => ({ lat, lon, t, acc });

test('a poor-accuracy fix is discarded', () => {
  const r = acceptPoint(at(51.5, -0.12, 0), at(51.51, -0.12, 1000, 80));
  assert.equal(r.accept, false);
  assert.equal(r.reason, 'inaccurate');
});

test('standing still accumulates essentially nothing', () => {
  // A stationary phone reports a slowly wandering position. Unfiltered, every
  // wander counts as distance run.
  const fixes = [];
  for (let i = 0; i < 300; i++) {
    fixes.push(at(51.5 + Math.sin(i / 7) * 3e-5, -0.12 + Math.cos(i / 5) * 3e-5, i * 1000, 8));
  }
  const { km } = buildTrack(fixes);
  assert.ok(km <= 0.05, `five minutes on a bench invented ${km}km`);
});

test('genuine slow movement is still counted', () => {
  // The stationary guard must not swallow a walk. 1.2 m/s for 200s = ~240m.
  const fixes = [];
  for (let i = 0; i < 200; i++) fixes.push(at(51.5 + i * (1.2 / 111_195), -0.12, i * 1000, 6));
  const { km } = buildTrack(fixes);
  near(km * 1000, 240, 30, 'a walk is travel, not drift');
});

test('a GPS teleport is rejected rather than added', () => {
  const r = acceptPoint(at(51.5, -0.12, 0), at(51.6, -0.12, 1000));
  assert.equal(r.accept, false);
  assert.equal(r.reason, 'implausible', '11km in one second is not a sprint');
});

test('genuine running movement is kept', () => {
  const r = acceptPoint(at(51.5, -0.12, 0), at(51.5003, -0.12, 12_000));
  assert.equal(r.accept, true);
  near(r.meters, 33, 3, 'about 33m in 12s ≈ 6:00/km');
});

test('a real stride is never rejected as noise', () => {
  // The regression this guards. At 1Hz and ~3.4 m/s a stride is ~3.4m per fix.
  // A fixed 5m "minimum movement" gate is ABOVE that, so it threw away genuine
  // movement and kept only fixes that noise had pushed further — selecting for
  // noise, and over-reporting an 8km urban run as 11.3km.
  const r = acceptPoint(at(51.5, -0.12, 0), at(51.5 + 3.4 / 111_195, -0.12, 1000, 6));
  assert.equal(r.accept, true, 'one second of running must survive the filter');
});

test('the first fix is always accepted', () => {
  assert.equal(acceptPoint(null, at(51.5, -0.12, 0)).accept, true);
});

test('malformed fixes never reach the track', () => {
  for (const bad of [null, {}, { lat: 'x', lon: 1, t: 0 }, { lat: NaN, lon: 0, t: 0 }]) {
    assert.equal(acceptPoint(null, bad).accept, false);
  }
  assert.deepEqual(buildTrack([null, undefined, { lat: NaN, lon: 0, t: 0 }]).points, []);
});

test('a straight run measures its true length', () => {
  // ~1km due north, sampled every second at a realistic pace.
  const fixes = [];
  for (let i = 0; i <= 300; i++) fixes.push(at(51.5 + i * (0.009 / 300), -0.12, i * 1000));
  const { km } = buildTrack(fixes);
  near(km, 1.0, 0.03, 'a kilometre is a kilometre');
});

test('an empty or single-fix track is handled without special-casing by callers', () => {
  assert.equal(buildTrack([]).km, 0);
  assert.equal(buildTrack(undefined).km, 0);
  assert.equal(trackDistanceKm([at(51.5, -0.12, 0)]), 0);
  assert.equal(trackDistanceKm([]), 0);
});

test('DEFAULTS can be overridden per call', () => {
  assert.equal(acceptPoint(at(51.5, -0.12, 0), at(51.5, -0.12, 1000, 30)).reason, 'inaccurate');
  assert.equal(
    acceptPoint(at(51.5, -0.12, 0), at(51.5, -0.12, 1000, 30), { maxAccuracyM: 50 }).accept,
    true,
    'a looser accuracy bar lets it through',
  );
  assert.equal(DEFAULTS.maxAccuracyM, 25, 'defaults themselves are not mutated');
});

test('smoothing strength tracks reported accuracy', () => {
  // A clean fix is barely touched; a ragged one is heavily averaged.
  assert.ok(smoothingAlpha(4) > smoothingAlpha(12));
  assert.ok(smoothingAlpha(12) > smoothingAlpha(25));
  assert.equal(smoothingAlpha(1), DEFAULTS.maxAlpha, 'clamped at the top');
  assert.equal(smoothingAlpha(1000), DEFAULTS.minAlpha, 'clamped at the bottom');
  assert.ok(smoothingAlpha(undefined) > 0, 'a missing accuracy still yields something usable');
});

test('the streaming builder and the batch form agree exactly', () => {
  const fixes = [];
  for (let i = 0; i < 400; i++) fixes.push(at(51.5 + i * 3e-5, -0.12, i * 1000, 6));
  const b = createTrackBuilder();
  for (const f of fixes) b.push(f);
  assert.equal(b.km, buildTrack(fixes).km, 'live tracking must not disagree with a recomputation');
});

// ---------------------------------------------------------------------------
// Storage + rendering
// ---------------------------------------------------------------------------

test('downsampling keeps the endpoints and thins the middle', () => {
  const pts = [];
  for (let i = 0; i <= 500; i++) pts.push(at(51.5 + i * 1e-5, -0.12, i * 1000));
  const thin = downsample(pts, { minMeters: 10 });
  assert.ok(thin.length < pts.length / 3, `expected real thinning, got ${thin.length}`);
  assert.deepEqual(thin[0], pts[0]);
  assert.deepEqual(thin[thin.length - 1], pts[pts.length - 1]);
  near(trackDistanceKm(thin), trackDistanceKm(pts), 0.02, 'distance survives thinning');
});

test('projection fits the box, preserves aspect, and puts north up', () => {
  const pts = [at(51.50, -0.12, 0), at(51.51, -0.12, 1), at(51.51, -0.11, 2)];
  const { path, points } = projectTrack(pts, { width: 300, height: 200, padding: 10 });
  assert.ok(path.startsWith('M'));
  for (const p of points) {
    assert.ok(p.x >= 9.9 && p.x <= 290.1, `x ${p.x} escaped the box`);
    assert.ok(p.y >= 9.9 && p.y <= 190.1, `y ${p.y} escaped the box`);
  }
  assert.ok(points[0].y > points[1].y, 'the northern point sits higher on the screen');
});

test('a there-and-back is not stretched into a loop', () => {
  // Degenerate on one axis: without aspect preservation this would fill the box.
  const pts = [at(51.500, -0.12, 0), at(51.505, -0.12, 1), at(51.500, -0.12, 2)];
  const { points } = projectTrack(pts, { width: 300, height: 200, padding: 10 });
  const xs = points.map((p) => p.x);
  near(Math.max(...xs) - Math.min(...xs), 0, 0.01, 'a straight north-south line stays straight');
});

test('projecting nothing yields an empty path rather than throwing', () => {
  assert.deepEqual(projectTrack([]), { path: '', points: [], bounds: null });
  assert.equal(projectTrack(undefined).path, '');
});

test('recent pace reflects the last stretch, not the whole run', () => {
  // 500m at 5:00/km, then 500m at 7:00/km.
  const pts = [];
  let t = 0;
  const step = 0.009 / 1000; // ~1m of latitude
  let lat = 51.5;
  for (let i = 0; i < 500; i++) { lat += step; t += 300; pts.push(at(lat, -0.12, t)); }
  for (let i = 0; i < 500; i++) { lat += step; t += 420; pts.push(at(lat, -0.12, t)); }
  const pace = recentPace(pts, { windowM: 400 });
  near(pace, 420, 25, 'the recent window should read the slower second half');
});

test('recent pace is null until there is enough to say anything', () => {
  assert.equal(recentPace([], {}), null);
  assert.equal(recentPace([at(51.5, -0.12, 0)], {}), null);
  assert.equal(recentPace([at(51.5, -0.12, 0), at(51.5001, -0.12, 5000)], {}), null);
});
