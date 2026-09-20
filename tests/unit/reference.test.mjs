import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  blockReference, loadFromReference, loadForReps, impliedRpe, e1rm,
  suggestDoubleProgression,
} from '../../src/core/progression.js';
import { getExercise } from '../../src/program/exercises.js';
import { mkSet } from './_fixtures.mjs';

/**
 * The block reference is the number every heavy-day load hangs off, so its
 * rules are pinned one at a time (SYNTHESIS §1.1, §1.4).
 */

const incline = getExercise('incline-bench'); // 2.5 → 1.25 after two stalls
const block = { backoff: { sets: 3, repMin: 4, repMax: 6, pctOfReference: 0.8 } };
const probe = (w, reps, rpe) => mkSet({ type: 'probe', weightKg: w, reps, rpe });
const bo = (w, reps, rpe) => mkSet({ type: 'backoff', weightKg: w, reps, rpe });
const row = (date, sets, o = {}) => ({ date, sets, bodyweightKg: 82, role: 'probe', isDeload: false, ...o });

test('no history → no reference', () => {
  const r = blockReference([], block, incline);
  assert.equal(r.e1rm, null);
  assert.equal(r.source, null);
});

test('the first probe seeds the reference, whatever its RPE', () => {
  const r = blockReference([row('2026-09-01', [probe(85, 4, 9)])], block, incline);
  assert.ok(Math.abs(r.e1rm - e1rm(85, 4, 9)) < 1e-9);
  assert.equal(r.source, 'probe');
});

test('a later probe at ≤ RPE 8 that beats the reference raises it; a harder one does not', () => {
  const seed = row('2026-09-01', [probe(85, 4, 8)]); // 102
  const better = row('2026-09-08', [probe(87.5, 4, 8)]); // 105
  assert.equal(blockReference([seed, better], block, incline).e1rm, 105);

  // RPE 9 unplanned: the dose is protected, the reference stays.
  const harder = row('2026-09-08', [probe(92.5, 4, 9)]); // would be 107.9
  assert.equal(blockReference([seed, harder], block, incline).e1rm, 102);

  // A weaker probe at RPE 8 never lowers it either.
  const weaker = row('2026-09-08', [probe(80, 4, 8)]);
  assert.equal(blockReference([seed, weaker], block, incline).e1rm, 102);
});

test('all back-offs at repMax at ≤ RPE 8.5 raise the reference so the bar moves by exactly one increment', () => {
  const seed = row('2026-09-01', [probe(85, 4, 8), bo(82.5, 6, 8), bo(82.5, 6, 8.5), bo(82.5, 6, 8.5)]);
  const r = blockReference([seed], block, incline);
  assert.equal(r.source, 'backoffs');
  const before = loadFromReference(102, 0.8, incline);
  const after = loadFromReference(r.e1rm, 0.8, incline);
  assert.equal(after - before, 2.5);
});

test('one back-off short of the range, or over RPE 8.5, leaves the reference alone', () => {
  const short = row('2026-09-01', [probe(85, 4, 8), bo(82.5, 6, 8), bo(82.5, 5, 8), bo(82.5, 6, 8)]);
  assert.equal(blockReference([short], block, incline).e1rm, 102);
  const hard = row('2026-09-01', [probe(85, 4, 8), bo(82.5, 6, 8), bo(82.5, 6, 9), bo(82.5, 6, 8)]);
  assert.equal(blockReference([hard], block, incline).e1rm, 102);
});

test('the test-week triple sets the NEXT block\'s reference, only once the deload has passed', () => {
  const seed = row('2026-09-01', [probe(85, 4, 8)]); // 102
  const testWeek = row('2026-09-15', [probe(95, 3, 9)], { role: 'test' }); // 95 × (1 + 4/30) = 107.67
  const deload = row('2026-09-22', [probe(75, 3, 6), bo(82.5, 4, 6)], { role: 'deload', isDeload: true });

  assert.equal(blockReference([seed, testWeek], block, incline).e1rm, 102, 'not yet — same block');
  const next = blockReference([seed, testWeek, deload], block, incline);
  assert.ok(Math.abs(next.e1rm - 95 * (1 + 4 / 30)) < 1e-9);
  assert.equal(next.source, 'test');
});

test('deload sessions never touch the reference', () => {
  const seed = row('2026-09-01', [probe(85, 4, 8)]);
  const deload = row('2026-09-22', [probe(100, 3, 6), bo(82.5, 4, 6), bo(82.5, 4, 6)], { role: 'deload', isDeload: true });
  assert.equal(blockReference([seed, deload], block, incline).e1rm, 102);
});

test('two stalls switch incline to the 1.25 kg step; a raise resets the count', () => {
  const seed = row('2026-09-01', [probe(85, 4, 8), bo(82.5, 5, 8), bo(82.5, 5, 8), bo(82.5, 5, 8)]);
  const miss1 = row('2026-09-08', [probe(85, 4, 8), bo(82.5, 5, 8.5), bo(82.5, 5, 8.5), bo(82.5, 5, 8.5)]);
  const miss2 = row('2026-09-15', [probe(85, 4, 8), bo(82.5, 6, 8.5), bo(82.5, 5, 8.5), bo(82.5, 5, 8.5)]);
  assert.equal(blockReference([seed], block, incline).increment, 2.5);
  const stalled = blockReference([seed, miss1, miss2], block, incline);
  assert.equal(stalled.stalls, 2, 'the seeding session is not a stall');
  assert.equal(stalled.increment, 1.25);

  const win = row('2026-09-22', [probe(85, 4, 8), bo(82.5, 6, 8), bo(82.5, 6, 8), bo(82.5, 6, 8)]);
  const raised = blockReference([seed, miss1, miss2, win], block, incline);
  assert.equal(raised.stalls, 0);
  assert.equal(raised.increment, 2.5);
  assert.equal(loadFromReference(raised.e1rm, 0.8, incline, null, { increment: 1.25 }) - 82.5, 1.25, 'the stalled step is what was applied');
});

test('OHP has no smaller step to fall back to — it is already 1.25', () => {
  const ohp = getExercise('ohp');
  const seed = row('2026-09-01', [probe(60, 4, 8)]);
  const misses = [1, 2, 3].map((i) => row(`2026-09-0${i + 1}`, [probe(60, 4, 8.5), bo(57.5, 5, 8.5), bo(57.5, 5, 8.5), bo(57.5, 5, 8.5)]));
  assert.equal(blockReference([seed, ...misses], block, ohp).increment, 1.25);
});

test('pull-ups: reference on system mass, loads back on the belt', () => {
  const pu = getExercise('weighted-pullup');
  const seed = row('2026-09-01', [probe(15, 4, 8)]); // system 97 × 1.2 = 116.4
  const r = blockReference([seed], block, pu);
  assert.ok(Math.abs(r.e1rm - 116.4) < 1e-9);
  assert.equal(loadFromReference(r.e1rm, 0.8, pu, 82), 11.25);
  assert.equal(loadForReps(r.e1rm, 3, 9, pu, 82), 21.25, '116.4 / (1 + 4/30) = 102.7 → 20.7 on the belt → 21.25');
});

test('implied RPE at 80%: 4 → 6.5, 5 → 7.5, 6 → 8.5 — the band the review demanded', () => {
  assert.deepEqual([4, 5, 6].map((r) => impliedRpe(100, 80, r)), [6.5, 7.5, 8.5]);
  assert.ok(impliedRpe(100, 85, 6) > 10, '6 reps at 85% is past failure — the v2 corner');
});

test('loadForReps is the inverse of e1rm', () => {
  const ex = { loadModel: 'external', increment: 0.01 };
  for (const [reps, rpe] of [[3, 9], [4, 8], [5, 7]]) {
    const load = loadForReps(100, reps, rpe, ex);
    assert.ok(Math.abs(e1rm(load, reps, rpe) - 100) < 0.02);
  }
});

test('double progression judges effort on the sets before the to-failure set', () => {
  const b = { repMin: 12, repMax: 15, rpeCap: 9, lastSetToFailure: true };
  const ex = getExercise('cable-lateral-raise');
  const sets = [mkSet({ weightKg: 20, reps: 15, rpe: 8.5 }), mkSet({ weightKg: 20, reps: 15, rpe: 9 }), mkSet({ weightKg: 20, reps: 16, rpe: 10 })];
  assert.equal(suggestDoubleProgression(sets, b, ex).weightKg, 22.5, 'the RPE-10 last set is by design, not a red flag');
  const noFailureBlock = { ...b, lastSetToFailure: false };
  assert.equal(suggestDoubleProgression(sets, noFailureBlock, ex).weightKg, 20, 'without the flag RPE 10 means too hard');
});

test('v2 sessions seed the reference through their top set but their back-offs never raise it', () => {
  const v2row = row('2026-09-01', [mkSet({ type: 'top', weightKg: 85, reps: 5, rpe: 8 }), bo(72.5, 6, 6), bo(72.5, 6, 6), bo(72.5, 6, 6)], { programVersion: 2 });
  const r = blockReference([v2row], block, incline);
  assert.ok(Math.abs(r.e1rm - e1rm(85, 5, 8)) < 1e-9, 'seeded from the top set');
  assert.equal(r.source, 'probe');
  assert.equal(r.lastBackoffLoad, null, 'v2 back-offs at 85% of a top set are not double-progression evidence');
});
