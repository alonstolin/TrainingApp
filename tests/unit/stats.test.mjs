import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  e1rmSeries, runSeries, weeklyRunVolume, coreSeries,
  weeklyVolumeByMuscle, personalBests, runMilestones, topSetSeries,
} from '../../src/core/stats.js';
import { mkSession, mkEntry, mkSet } from './_fixtures.mjs';

const liftOn = (date, exerciseId, sets, extra = {}) =>
  mkSession({ kind: 'lift', date, entries: [mkEntry(exerciseId, sets)], ...extra });

test('e1rm series is chronological and skips incomplete sessions', () => {
  const sessions = [
    liftOn('2026-03-01', 'incline-bench', [mkSet({ weightKg: 80, reps: 5, rpe: 8, type: 'top' })]),
    liftOn('2026-02-01', 'incline-bench', [mkSet({ weightKg: 75, reps: 5, rpe: 8, type: 'top' })]),
    liftOn('2026-04-01', 'incline-bench', [mkSet({ weightKg: 999, reps: 5 })], { status: 'in_progress' }),
  ];
  const s = e1rmSeries(sessions, 'incline-bench');
  assert.deepEqual(s.map((x) => x.date), ['2026-02-01', '2026-03-01']);
  assert.ok(s[1].value > s[0].value);
});

test('pull-up e1rm accounts for bodyweight, so it stays honest as weight changes', () => {
  const sessions = [
    liftOn('2026-02-01', 'weighted-pullup', [mkSet({ weightKg: 20, reps: 5, rpe: 8 })], { bodyweightKg: 78 }),
    liftOn('2026-03-01', 'weighted-pullup', [mkSet({ weightKg: 20, reps: 5, rpe: 8 })], { bodyweightKg: 82 }),
  ];
  const s = e1rmSeries(sessions, 'weighted-pullup');
  assert.ok(s[1].value > s[0].value, 'same added load at a heavier bodyweight is more total work');
});

test('e1rm series returns nothing for an exercise never trained', () => {
  assert.deepEqual(e1rmSeries([liftOn('2026-02-01', 'ohp', [mkSet({ weightKg: 60, reps: 5 })])], 'incline-bench'), []);
});

test('topSetSeries reports the heaviest weight actually moved', () => {
  const sessions = [
    liftOn('2026-02-01', 'ohp', [
      mkSet({ weightKg: 60, reps: 5, type: 'top' }),
      mkSet({ weightKg: 50, reps: 8, type: 'backoff' }),
    ]),
  ];
  assert.equal(topSetSeries(sessions, 'ohp')[0].value, 60);
});

test('run series computes pace', () => {
  const sessions = [
    mkSession({ kind: 'run', date: '2026-02-01', run: { distanceKm: 5, durationSec: 1500 } }),
  ];
  assert.equal(runSeries(sessions)[0].pace, 300);
});

test('weekly run volume fills empty weeks with zero rather than skipping them', () => {
  // A gap week must show as a hole in the bar chart, not be silently collapsed.
  const sessions = [
    mkSession({ kind: 'run', date: '2026-08-04', run: { distanceKm: 5, durationSec: 1500 } }),
    mkSession({ kind: 'run', date: '2026-08-18', run: { distanceKm: 7, durationSec: 2100 } }),
  ];
  const weeks = weeklyRunVolume(sessions, '2026-08-18');
  assert.deepEqual(weeks.map((w) => w.weekStart), ['2026-08-03', '2026-08-10', '2026-08-17']);
  assert.deepEqual(weeks.map((w) => w.km), [5, 0, 7]);
});

test('weekly run volume sums multiple runs in a week', () => {
  const sessions = [
    mkSession({ kind: 'run', date: '2026-08-18', run: { distanceKm: 4, durationSec: 1200 } }),
    mkSession({ kind: 'run', date: '2026-08-22', run: { distanceKm: 8.5, durationSec: 3000 } }),
  ];
  assert.equal(weeklyRunVolume(sessions, '2026-08-22')[0].km, 12.5);
});

test('core series reports seconds for holds and reps for rep work', () => {
  const sessions = [
    mkSession({
      kind: 'core', date: '2026-02-01',
      entries: [
        mkEntry('front-plank', [mkSet({ seconds: 45 }), mkSet({ seconds: 60 })]),
        mkEntry('hanging-leg-raise', [mkSet({ reps: 10 })]),
      ],
    }),
  ];
  const plank = coreSeries(sessions, 'front-plank');
  assert.equal(plank[0].value, 60, 'best hold of the session');
  assert.equal(plank[0].unit, 's');
  assert.equal(coreSeries(sessions, 'hanging-leg-raise')[0].unit, 'reps');
});

test('weekly volume by muscle counts hard sets and ignores warmups', () => {
  const sessions = [
    liftOn('2026-08-19', 'cable-lateral-raise', [
      mkSet({ weightKg: 15, reps: 12, type: 'warmup' }),
      mkSet({ weightKg: 15, reps: 12 }),
      mkSet({ weightKg: 15, reps: 12 }),
    ]),
    liftOn('2026-08-21', 'machine-lateral-raise', [mkSet({ weightKg: 20, reps: 15 })]),
  ];
  const vol = weeklyVolumeByMuscle(sessions, '2026-08-17');
  const side = vol.find((v) => v.muscle === 'side-delts');
  assert.equal(side.sets, 3, 'two cable + one machine, warmup excluded');
  assert.equal(side.label, 'Side delts');
});

test('weekly volume only counts the week asked for', () => {
  const sessions = [liftOn('2026-08-10', 'cable-lateral-raise', [mkSet({ weightKg: 15, reps: 12 })])];
  assert.deepEqual(weeklyVolumeByMuscle(sessions, '2026-08-17'), []);
});

test('personal bests track heaviest and best estimated max separately', () => {
  const sessions = [
    liftOn('2026-02-01', 'ohp', [mkSet({ weightKg: 70, reps: 1, rpe: 10 })]),
    liftOn('2026-03-01', 'ohp', [mkSet({ weightKg: 60, reps: 8, rpe: 8 })]),
  ];
  const pb = personalBests(sessions, 'ohp');
  assert.equal(pb.heaviest.weightKg, 70);
  assert.ok(pb.bestE1rm.value > 70, 'a 60x8 @8 implies a max above a grindy 70x1');
});

test('run milestones detect the 10K', () => {
  const before = [mkSession({ kind: 'run', run: { distanceKm: 9.3, durationSec: 3400 } })];
  assert.equal(runMilestones(before).hitTenK, false);

  const after = [...before, mkSession({ kind: 'run', run: { distanceKm: 10.2, durationSec: 3700 } })];
  const m = runMilestones(after);
  assert.equal(m.hitTenK, true);
  assert.equal(m.longest.km, 10.2);
  assert.equal(m.totalKm, 19.5);
});

test('empty history produces empty series rather than throwing', () => {
  assert.deepEqual(e1rmSeries([], 'ohp'), []);
  assert.deepEqual(runSeries([]), []);
  assert.deepEqual(weeklyRunVolume([], '2026-08-17'), []);
  assert.deepEqual(weeklyVolumeByMuscle([], '2026-08-17'), []);
  assert.equal(runMilestones([]).hitTenK, false);
});
