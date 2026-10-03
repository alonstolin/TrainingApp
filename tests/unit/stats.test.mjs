import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coreAdherence, easyRunEffortByWeekday,
  e1rmSeries, runSeries, weeklyRunVolume, coreSeries,
  weeklyVolumeByMuscle, personalBests, runMilestones, topSetSeries, easyPaceSecPerKm, estimated1rmSeries,
} from '../../src/core/stats.js';
import { mkSession, mkEntry, mkSet, program } from './_fixtures.mjs';

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

test('core adherence counts lift sessions that carry core and whether any of it was done', () => {
  const host = (did) => mkSession({ kind: 'lift', dayKey: 'lift:B', status: 'completed',
    entries: [mkEntry('back-squat', [mkSet({ weightKg: 100, reps: 5 })]), { ...mkEntry('cable-crunch', did ? [mkSet({ weightKg: 20, reps: 12 })] : []), group: 'core' }] });
  const a = coreAdherence([host(true), host(true), host(true), host(false)], program);
  assert.deepEqual([a.hosts, a.done, a.pct, a.ok], [4, 3, 75, true]);
  const bad = coreAdherence([host(true), host(false), host(false)], program);
  assert.equal(bad.ok, false);
  assert.equal(coreAdherence([], program).hosts, 0);
});

test('easy-run effort is summarised by weekday with CR10 and talk-test failure rate', () => {
  const run = (date, effort, talkTest) => mkSession({ kind: 'run', variant: 'easy', date, status: 'completed', run: { distanceKm: 4.5, durationSec: 1800, effort, talkTest } });
  const rows = easyRunEffortByWeekday([run('2026-09-15', 5, 'no'), run('2026-09-22', 6, 'yes'), run('2026-09-17', 3, 'yes')]);
  const tue = rows.find((r) => r.dow === 2);
  const thu = rows.find((r) => r.dow === 4);
  assert.deepEqual([tue.runs, tue.meanRpe, tue.talkNegativePct], [2, 5.5, 50]);
  assert.deepEqual([thu.runs, thu.meanRpe, thu.talkNegativePct], [1, 3, 0]);
});

test('easy pace is the median of the easy runs in the last 28 days', () => {
  const run = (date, variant, km, durationSec) => mkSession({ kind: 'run', variant, dayKey: `run:${variant}`, date, run: { distanceKm: km, durationSec } });
  const today = '2026-10-31';
  const sessions = [
    run('2026-10-07', 'easy', 5, 1800), // 6:00
    run('2026-10-14', 'easy', 4, 1560), // 6:30
    run('2026-10-28', 'easy', 4, 2160), // 9:00, a walk-run day: the median shrugs it off
    run('2026-10-25', 'long', 8, 2400), // 5:00, a long run — not easy-run pace
    run('2026-09-01', 'easy', 5, 1500), // 5:00, too old to count
  ];
  assert.equal(easyPaceSecPerKm(sessions, today), 390);
  assert.equal(easyPaceSecPerKm(sessions.slice(3), today), null, 'no recent easy run, no pace');
});

// ---- estimated 1RM from probes (issue #7) ----------------------------------
// Epley with RIR: e1RM = load × (1 + (reps + 10 − RPE) / 30).

const probeDay = (date, block, exerciseId, sets, bodyweightKg = 80, role = 'probe') =>
  mkSession({
    date, bodyweightKg,
    programRef: { programId: 'x', version: 5, mesocycle: block, role },
    entries: [mkEntry(exerciseId, sets.map((s) => mkSet(s)))],
  });

test('estimated 1RM comes from probe sets only — back-offs and volume days never contribute', () => {
  const sessions = [
    // Probe 100 × 3 @ 8 → 100 × (1 + 5/30) = 116.7. The back-off 90 × 6 @ 10 (= 108)
    // and a warm-up are ignored even where they would not change the answer…
    probeDay('2026-10-05', 1, 'incline-bench', [
      { type: 'warmup', weightKg: 60, reps: 5 },
      { type: 'probe', weightKg: 100, reps: 3, rpe: 8 },
      { type: 'backoff', weightKg: 90, reps: 6, rpe: 10 },
    ]),
    // …and a volume day with a higher estimate (90 × 10 @ 9 → 123) adds no point.
    probeDay('2026-10-07', 1, 'incline-bench', [{ type: 'work', weightKg: 90, reps: 10, rpe: 9 }]),
  ];
  const s = estimated1rmSeries(sessions, 'incline-bench');
  assert.deepEqual(s.points.map((p) => [p.date, p.value]), [['2026-10-05', 116.7]]);
});

test('each block counts its best probe, the all-time best is marked, and the line can fall', () => {
  const probe = (date, block, weightKg, reps, rpe) => probeDay(date, block, 'incline-bench', [{ type: 'probe', weightKg, reps, rpe }]);
  const sessions = [
    probe('2026-10-05', 1, 100, 3, 8), // 116.7
    probe('2026-10-12', 1, 100, 4, 8), // 120   ← block 1's best, and the best ever
    probe('2026-11-02', 2, 95, 3, 8), //  110.8
    probe('2026-11-09', 2, 100, 2, 8), // 113.3 ← block 2's best: lower than block 1's
  ];
  const s = estimated1rmSeries(sessions, 'incline-bench');
  assert.equal(s.points.length, 4, 'one point per probe');
  assert.deepEqual(s.blockBests.map((p) => [p.block, p.date, p.value]), [[1, '2026-10-12', 120], [2, '2026-11-09', 113.3]]);
  assert.deepEqual([s.best.date, s.best.value], ['2026-10-12', 120]);
  assert.ok(s.blockBests[1].value < s.blockBests[0].value, 'unlike the block reference, the estimate falls');
});

test('the pull-up reads as belt load at today\'s bodyweight; system mass does not move with it', () => {
  // At 80 kg, +20 × 3 @ 8 → system mass 100 × (1 + 5/30) = 116.7.
  const sessions = [probeDay('2026-10-09', 1, 'weighted-pullup', [{ type: 'probe', weightKg: 20, reps: 3, rpe: 8 }], 80)];
  const at80 = estimated1rmSeries(sessions, 'weighted-pullup', { bodyweightKg: 80 }).best;
  const at85 = estimated1rmSeries(sessions, 'weighted-pullup', { bodyweightKg: 85 }).best;
  assert.deepEqual([at80.systemKg, at80.value], [116.7, 36.7]);
  assert.deepEqual([at85.systemKg, at85.value], [116.7, 31.7], 'five kilos heavier, five fewer on the belt');
});

test('with no bodyweight given, every pull-up point is read at the latest logged bodyweight', () => {
  // The same system mass lifted at 80 kg and then at 85 kg is the same strength:
  // it must not read as five kilos lost off the belt.
  const sessions = [
    probeDay('2026-10-09', 1, 'weighted-pullup', [{ type: 'probe', weightKg: 20, reps: 3, rpe: 8 }], 80),
    probeDay('2026-11-06', 2, 'weighted-pullup', [{ type: 'probe', weightKg: 15, reps: 3, rpe: 8 }], 85),
  ];
  const s = estimated1rmSeries(sessions, 'weighted-pullup');
  assert.deepEqual(s.blockBests.map((p) => [p.systemKg, p.value]), [[116.7, 31.7], [116.7, 31.7]]);
});

test('a block number the engine hands out twice is still two blocks, and the entry deload is its own', () => {
  const probe = (date, block, weightKg, role) => probeDay(date, block, 'incline-bench', [{ type: 'probe', weightKg, reps: 3, rpe: 8 }], 80, role);
  const sessions = [
    probe('2026-09-14', 1, 90, 'deload'), // the v3 entry deload records block 1…
    probe('2026-09-21', 1, 100, 'probe'), // …and so does the first real block
    probe('2026-10-19', 2, 105, 'probe'),
    probe('2026-11-16', 1, 95, 'probe'), //  a fallback period that numbered itself 1 again
  ];
  const s = estimated1rmSeries(sessions, 'incline-bench');
  assert.deepEqual(s.blockBests.map((p) => p.date), ['2026-09-14', '2026-09-21', '2026-10-19', '2026-11-16']);
});
