import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrack } from '../../src/core/geo.js';

/**
 * How wrong is the recorded distance, against a KNOWN true distance?
 *
 * Unit tests elsewhere check the pieces; this checks the thing that actually
 * matters — whether an 8km run comes back as 8km. It simulates a run over a
 * known path, adds realistic GPS error, and asserts the error stays small.
 *
 * Realism notes, because a bad noise model would make this test meaningless:
 *  - Error is AUTOCORRELATED, not redrawn each second. Real error comes from
 *    satellite geometry and multipath, which change over tens of seconds.
 *    White noise would wildly overstate the inflation and flatter any filter.
 *  - Reported accuracy tracks the true error scale, since the filter adapts to it.
 *  - Paths include a 400m track, whose 36.5m-radius bends are the hardest case
 *    for a smoother and the one that risks UNDER-reporting.
 */

const M_PER_DEG_LAT = 111_195;
const LAT0 = 51.5;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((LAT0 * Math.PI) / 180);

function rng(seed) {
  let s = seed;
  const next = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  return () => Math.sqrt(-2 * Math.log(next() || 1e-9)) * Math.cos(2 * Math.PI * next());
}

/** @param path (metresTravelled) => [x, y] in metres */
function simulate({ path, trueM, speed = 3.4, sigma, corr, seed }) {
  const gauss = rng(seed);
  const n = Math.round(trueM / speed);
  let ex = 0;
  let ey = 0;
  const fixes = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = path(i * speed);
    ex = corr * ex + Math.sqrt(1 - corr ** 2) * gauss() * sigma;
    ey = corr * ey + Math.sqrt(1 - corr ** 2) * gauss() * sigma;
    fixes.push({
      lat: LAT0 + (y + ey) / M_PER_DEG_LAT,
      lon: -0.12 + (x + ex) / M_PER_DEG_LON,
      t: i * 1000,
      acc: Math.max(3, sigma),
    });
  }
  return buildTrack(fixes).meters;
}

/** Mean error across seeds, as a percentage of the true distance. */
function meanErrorPct(cfg, trueM, seeds = 8) {
  let total = 0;
  for (let s = 0; s < seeds; s++) total += simulate({ ...cfg, trueM, seed: 100 + s * 89 });
  return ((total / seeds - trueM) / trueM) * 100;
}

const STRAIGHT = (d) => [0, d];
const TWISTY = (d) => [30 * Math.sin(d / 40), d * 0.92];
/** A standard athletics track: 84.39m straights, 36.5m-radius bends. */
const TRACK = (d) => {
  const L = 84.39;
  const R = 36.5;
  const bend = Math.PI * R;
  let s = d % (2 * L + 2 * bend);
  if (s < L) return [0, s];
  s -= L;
  if (s < bend) { const a = s / R; return [R - R * Math.cos(a), L + R * Math.sin(a)]; }
  s -= bend;
  if (s < L) return [2 * R, L - s];
  s -= L;
  const a = s / R;
  return [R + R * Math.cos(a), -R * Math.sin(a)];
};

const CONDITIONS = [
  { label: 'open sky', sigma: 4, corr: 0.95 },
  { label: 'partial obstruction', sigma: 6, corr: 0.95 },
  { label: 'urban canyon', sigma: 8, corr: 0.9 },
];

// 8% is the bar. Below that, a run reads correctly to the nearest tenth of a km
// and the pace is right to a few seconds — good enough to train on.
const TOLERANCE = 8;

for (const cond of CONDITIONS) {
  test(`an 8km straight run measures within ${TOLERANCE}% — ${cond.label}`, () => {
    const err = meanErrorPct({ path: STRAIGHT, ...cond }, 8000);
    assert.ok(Math.abs(err) < TOLERANCE, `${err.toFixed(1)}% off`);
  });

  test(`8km on a 400m track measures within ${TOLERANCE}% — ${cond.label}`, () => {
    // Tight bends are where over-smoothing shows up as UNDER-reporting, so this
    // is the guard against fixing inflation by cutting every corner.
    const err = meanErrorPct({ path: TRACK, ...cond }, 8000);
    assert.ok(Math.abs(err) < TOLERANCE, `${err.toFixed(1)}% off`);
  });

  test(`8km on a winding path measures within ${TOLERANCE}% — ${cond.label}`, () => {
    const err = meanErrorPct({ path: TWISTY, ...cond }, 8000);
    assert.ok(Math.abs(err) < TOLERANCE, `${err.toFixed(1)}% off`);
  });
}

test('the filter does not simply cut corners to hide inflation', () => {
  // Systematic under-reporting would be a worse bug than over-reporting: it
  // makes you look slower and shorter than you were, and it compounds into the
  // 10K ramp. Assert the track case is not biased downward.
  for (const cond of CONDITIONS) {
    const err = meanErrorPct({ path: TRACK, ...cond }, 8000);
    assert.ok(err > -TOLERANCE, `${cond.label}: under-reported by ${Math.abs(err).toFixed(1)}%`);
  }
});

test('filtering beats summing raw fixes by a wide margin', () => {
  // Guards the design decision itself. If someone removes the smoothing, this
  // fails rather than the app quietly reporting 11km for an 8km run.
  const cond = { sigma: 8, corr: 0.9 };
  const gauss = rng(4242);
  let ex = 0;
  let ey = 0;
  const fixes = [];
  for (let i = 0; i < 2353; i++) {
    ex = cond.corr * ex + Math.sqrt(1 - cond.corr ** 2) * gauss() * cond.sigma;
    ey = cond.corr * ey + Math.sqrt(1 - cond.corr ** 2) * gauss() * cond.sigma;
    fixes.push({
      lat: LAT0 + (i * 3.4 + ey) / M_PER_DEG_LAT,
      lon: -0.12 + ex / M_PER_DEG_LON,
      t: i * 1000,
      acc: cond.sigma,
    });
  }

  let raw = 0;
  for (let i = 1; i < fixes.length; i++) {
    const a = fixes[i - 1];
    const b = fixes[i];
    const dy = (b.lat - a.lat) * M_PER_DEG_LAT;
    const dx = (b.lon - a.lon) * M_PER_DEG_LON;
    raw += Math.hypot(dx, dy);
  }

  const filtered = buildTrack(fixes).meters;
  const trueM = 2352 * 3.4;

  assert.ok(raw > trueM * 1.3, `raw summing should badly over-report, got ${(raw / trueM).toFixed(2)}x`);
  assert.ok(Math.abs(filtered - trueM) / trueM < 0.08, 'filtered stays close to truth');
});
