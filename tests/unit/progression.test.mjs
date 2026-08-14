import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  e1rm, effectiveLoad, roundToIncrement, suggestDoubleProgression,
  suggestTopSet, backoffLoad, paceSecPerKm, formatPace, checkRunSpike, bestE1rm,
} from '../../src/core/progression.js';
import { getExercise } from '../../src/program/exercises.js';
import { mkSet } from './_fixtures.mjs';

const bench = getExercise('incline-bench');
const pullup = getExercise('weighted-pullup');
const lateral = getExercise('cable-lateral-raise');

test('roundToIncrement snaps to usable plate jumps', () => {
  assert.equal(roundToIncrement(73.1, 2.5), 72.5);
  assert.equal(roundToIncrement(74, 2.5), 75);
  assert.equal(roundToIncrement(21.3, 1.25), 21.25);
  assert.equal(roundToIncrement(50, 0), 50, 'zero increment is a no-op');
});

test('effectiveLoad adds bodyweight only for bodyweight_plus lifts', () => {
  assert.equal(effectiveLoad({ weightKg: 80 }, bench, 78), 80);
  assert.equal(effectiveLoad({ weightKg: 20 }, pullup, 78), 98);
  assert.equal(effectiveLoad({ weightKg: 0 }, pullup, 78), 78, 'unweighted pull-up still loads bodyweight');
});

test('e1rm is RPE-aware', () => {
  // 100kg x 5 @ RPE 8 → 2 reps in reserve → treated as a 7-rep effort.
  assert.equal(Math.round(e1rm(100, 5, 8)), 123);
  // Same set at RPE 10 has nothing left → lower estimate.
  assert.equal(Math.round(e1rm(100, 5, 10)), 117);
  assert.ok(e1rm(100, 5, 8) > e1rm(100, 5, 10), 'more reps in reserve implies a higher true max');
  assert.equal(e1rm(0, 5, 8), 0);
  assert.equal(e1rm(100, 0, 8), 0);
});

test('e1rm without RPE falls back to plain Epley and does not inflate', () => {
  assert.equal(e1rm(100, 5, null), e1rm(100, 5, 10));
});

test('bestE1rm ignores unfinished sets', () => {
  const sets = [
    mkSet({ weightKg: 100, reps: 5, rpe: 8 }),
    mkSet({ weightKg: 120, reps: 5, rpe: 8, done: false }),
  ];
  assert.equal(Math.round(bestE1rm(sets, bench, 80)), 123);
});

test('double progression: adds load once the rep range is filled inside the RPE cap', () => {
  const block = { repMin: 12, repMax: 15, rpeCap: 9 };
  const last = [
    mkSet({ weightKg: 15, reps: 15, rpe: 8 }),
    mkSet({ weightKg: 15, reps: 15, rpe: 9 }),
  ];
  const s = suggestDoubleProgression(last, block, lateral);
  assert.equal(s.weightKg, 17.5);
  assert.equal(s.reps, 12, 'reset to the bottom of the range');
});

test('double progression: holds load when the range is filled but RPE blew past the cap', () => {
  const block = { repMin: 12, repMax: 15, rpeCap: 9 };
  const last = [mkSet({ weightKg: 15, reps: 15, rpe: 10 })];
  const s = suggestDoubleProgression(last, block, lateral);
  assert.equal(s.weightKg, 15, 'no load jump on an over-cap effort');
  assert.match(s.reason, /RPE/);
});

test('double progression: chases one more rep when short of the range', () => {
  const block = { repMin: 12, repMax: 15, rpeCap: 9 };
  const last = [
    mkSet({ weightKg: 15, reps: 13, rpe: 8 }),
    mkSet({ weightKg: 15, reps: 12, rpe: 9 }),
  ];
  const s = suggestDoubleProgression(last, block, lateral);
  assert.equal(s.weightKg, 15);
  assert.equal(s.reps, 13, 'target is the worst set plus one');
});

test('double progression: never targets past repMax', () => {
  const block = { repMin: 12, repMax: 15, rpeCap: 9 };
  const last = [mkSet({ weightKg: 15, reps: 15, rpe: 10 })];
  assert.ok(suggestDoubleProgression(last, block, lateral).reps <= 15);
});

test('double progression: judges only sets at the heaviest load used', () => {
  const block = { repMin: 8, repMax: 12, rpeCap: 9 };
  // A back-off/drop set at a lighter load must not veto the progression.
  const last = [
    mkSet({ weightKg: 30, reps: 12, rpe: 8 }),
    mkSet({ weightKg: 20, reps: 6, rpe: 9 }),
  ];
  const s = suggestDoubleProgression(last, block, lateral);
  assert.equal(s.weightKg, 32.5);
});

test('double progression: no history asks the user to pick a load', () => {
  const s = suggestDoubleProgression([], { repMin: 8, repMax: 12, rpeCap: 9 }, lateral);
  assert.equal(s.weightKg, null);
  assert.equal(s.reps, 8);
});

test('double progression ignores warmups', () => {
  const block = { repMin: 8, repMax: 12, rpeCap: 9 };
  const last = [
    mkSet({ weightKg: 60, reps: 12, rpe: 3, type: 'warmup' }),
    mkSet({ weightKg: 100, reps: 12, rpe: 8 }),
  ];
  assert.equal(suggestDoubleProgression(last, block, lateral).weightKg, 102.5);
});

test('top set: advances only on repMax at or under the week RPE target', () => {
  const block = { top: { repMin: 4, repMax: 6 } };
  const hit = suggestTopSet(mkSet({ weightKg: 80, reps: 6, rpe: 8, type: 'top' }), block, bench, 8);
  assert.equal(hit.weightKg, 82.5);
  assert.equal(hit.reps, 4);

  const overshot = suggestTopSet(mkSet({ weightKg: 80, reps: 6, rpe: 9.5, type: 'top' }), block, bench, 8);
  assert.equal(overshot.weightKg, 80, 'RPE above the target holds the load');

  const short = suggestTopSet(mkSet({ weightKg: 80, reps: 4, rpe: 8, type: 'top' }), block, bench, 8);
  assert.equal(short.weightKg, 80);
  assert.equal(short.reps, 5, 'one more rep at the same load');
});

test('top set: pull-ups advance in 1.25kg steps', () => {
  const block = { top: { repMin: 4, repMax: 6 } };
  const s = suggestTopSet(mkSet({ weightKg: 20, reps: 6, rpe: 7, type: 'top' }), block, pullup, 8);
  assert.equal(s.weightKg, 21.25);
});

test('top set: no history', () => {
  const s = suggestTopSet(null, { top: { repMin: 4, repMax: 6 } }, bench, 8);
  assert.equal(s.weightKg, null);
});

test('backoffLoad rounds to the exercise increment', () => {
  assert.equal(backoffLoad(100, 0.85, bench), 85);
  assert.equal(backoffLoad(82.5, 0.85, bench), 70, '70.125 snaps to 70');
  assert.equal(backoffLoad(null, 0.85, bench), null);
});

test('pace maths', () => {
  assert.equal(paceSecPerKm(5, 1500), 300);
  assert.equal(formatPace(300), '5:00 /km');
  assert.equal(formatPace(342), '5:42 /km');
  assert.equal(formatPace(null), '—');
  assert.equal(paceSecPerKm(0, 1500), null);
});

test('formatPace does not render a 60-second remainder', () => {
  // 359.7 rounds to 60 seconds, which must roll into the next minute.
  assert.equal(formatPace(359.7), '6:00 /km');
});

test('run spike check flags single-session jumps', () => {
  assert.equal(checkRunSpike(9, 8.5).ok, true, 'a normal weekly step is fine');
  const bad = checkRunSpike(12, 8);
  assert.equal(bad.ok, false);
  assert.match(bad.message, /longest run/);
  assert.equal(checkRunSpike(10, 0).ok, true, 'no history means nothing to compare against');
});
