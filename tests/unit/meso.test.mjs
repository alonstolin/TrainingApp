import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mesoState, deriveCursors, raceWeekStatus, thursdayRest } from '../../src/core/schedule.js';
import { mkSession, program, v2 } from './_fixtures.mjs';

/**
 * The phase-aware mesocycle clock (SYNTHESIS §4.4). Dates in 2026:
 * Mon 14 Sep … Sun 20 Sep is the week the athlete moved to v3.
 */

const sat = (n) => {
  // n-th Saturday counting 2026-08-15 as the 1st.
  const d = new Date(2026, 7, 15 + (n - 1) * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const longs = (n) => Array.from({ length: n }, (_, i) => sat(i + 1));
const started = (runWeekAtStart, over = {}) => ({
  v3StartedAt: { date: '2026-09-14', weekStart: '2026-09-14', runWeekAtStart, liftCompleted: 0, deloadFirst: false, ...over },
});

test('the run week as of Monday drives the lifting week, and Sunday stays in Monday\'s week', () => {
  // Five long runs banked before Mon 14 Sep → run week 6 all week, even after
  // Saturday's long run makes it week 7 on the run cursor.
  const meta = started(6);
  const mon = mesoState(program, { longRunDates: longs(5), date: '2026-09-14', meta });
  const sun = mesoState(program, { longRunDates: longs(6), date: '2026-09-20', meta });
  assert.equal(mon.source, 'run');
  assert.equal(mon.runWeek, 6);
  assert.equal(sun.runWeek, 6, 'Saturday\'s long run does not move Sunday\'s lift into the next week');
  assert.equal(sun.weekInMeso, mon.weekInMeso);
  const nextMon = mesoState(program, { longRunDates: longs(6), date: '2026-09-21', meta });
  assert.equal(nextMon.runWeek, 7);
});

test('starting at run week 6: block 1 is weeks 6–7 with the deload on the week-8 down-week', () => {
  const meta = started(6);
  const at = (n, date) => mesoState(program, { longRunDates: longs(n), date, meta });
  assert.deepEqual([at(5, '2026-09-14').role, at(6, '2026-09-21').role, at(7, '2026-09-28').role, at(8, '2026-10-05').role],
    ['probe', 'test', 'deload', 'probe']);
  assert.equal(at(5, '2026-09-14').blockLength, 3, 'two loading weeks + deload');
  assert.equal(at(8, '2026-10-05').mesocycle, 2);
  assert.equal(at(8, '2026-10-05').blockLength, 4, 'block 2 is run weeks 9–12');
});

test('starting at run week 5: three loading weeks, then the week-8 deload', () => {
  const meta = { v3StartedAt: { date: '2026-09-07', weekStart: '2026-09-07', runWeekAtStart: 5, liftCompleted: 0, deloadFirst: false } };
  const at = (n, date) => mesoState(program, { longRunDates: longs(n), date, meta });
  assert.deepEqual([at(4, '2026-09-07').role, at(5, '2026-09-14').role, at(6, '2026-09-21').role, at(7, '2026-09-28').role],
    ['probe', 'probe', 'test', 'deload']);
});

test('starting at run week 7: the week-8 deload is skipped (one loading week is not a block) and block 1 runs to 12', () => {
  const meta = { v3StartedAt: { date: '2026-09-21', weekStart: '2026-09-21', runWeekAtStart: 7, liftCompleted: 0, deloadFirst: false } };
  const at = (n, date) => mesoState(program, { longRunDates: longs(n), date, meta });
  assert.equal(at(6, '2026-09-21').role, 'probe');
  assert.equal(at(7, '2026-09-28').role, 'probe', 'run week 8 is a running down-week but NOT a lifting deload');
  assert.equal(at(7, '2026-09-28').isDeload, false);
  assert.equal(at(10, '2026-10-19').role, 'test', 'week 11');
  assert.equal(at(11, '2026-10-26').role, 'deload', 'week 12');
  assert.equal(at(6, '2026-09-21').blockLength, 6);
});

test('the run cursor maps longCompleted 4 → 5.5 km and 5 → 6.0 km — never the 6.5 km spike', () => {
  for (const [n, km] of [[4, 5.5], [5, 6.0]]) {
    const sessions = Array.from({ length: n }, (_, i) => mkSession({ kind: 'run', variant: 'long', status: 'completed', date: sat(i + 1) }));
    const c = deriveCursors(sessions, program, { today: '2026-09-14' });
    const plan = program.runPlan.find((w) => w.week === c.run.week);
    assert.equal(plan.long.km, km);
    assert.ok(plan.long.km <= 6.0);
  }
});

test('the entry deload: v2 week ≥ 3 at switch-over makes the first four lifts a deload', () => {
  const meta = started(6, { deloadFirst: true, liftCompleted: 10 });
  const lifts = (n) => Array.from({ length: n }, (_, i) => `2026-09-${String(14 + i).padStart(2, '0')}`);
  const during = mesoState(program, { liftDates: lifts(12), longRunDates: longs(5), date: '2026-09-16', meta });
  assert.equal(during.source, 'entry-deload');
  assert.equal(during.isDeload, true);
  const after = mesoState(program, { liftDates: lifts(14), longRunDates: longs(6), date: '2026-09-21', meta });
  assert.equal(after.source, 'run');
  assert.equal(after.role, 'probe');
  assert.equal(after.weekInMeso, 1, 'the probe week starts the block after the entry deload');
});

test('with no long run for 14 days the lift count takes over and the block keeps moving', () => {
  const meta = started(6);
  // Last long run 19 Sep (week 6 banked → week 7 = test). Then nothing.
  const liftsAfter = (n) => Array.from({ length: n }, (_, i) => {
    const d = new Date(2026, 8, 21 + i * 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const fresh = mesoState(program, { liftDates: liftsAfter(4), longRunDates: longs(6), date: '2026-09-28', meta });
  assert.equal(fresh.source, 'run', '9 days later the run-derived clock still holds');
  // Lift count from the Monday after the last long run: 4 lifts = the test
  // week, the next 4 = the deload, then block 2 — not frozen on "test".
  const stale = mesoState(program, { liftDates: liftsAfter(6), longRunDates: longs(6), date: '2026-10-06', meta });
  assert.equal(stale.source, 'lifts');
  assert.equal(stale.role, 'deload');
  const later = mesoState(program, { liftDates: liftsAfter(8), longRunDates: longs(6), date: '2026-10-06', meta });
  assert.equal(later.mesocycle, 2);
  assert.equal(later.role, 'probe');
  assert.equal(later.blockLength, 4);
});

test('after the build, blocks are five weeks on a lift-count clock: probe ×3, test, deload', () => {
  const meta = { v3StartedAt: { date: '2026-06-01', weekStart: '2026-06-01', runWeekAtStart: 1, liftCompleted: 0, deloadFirst: false } };
  const runs = longs(16); // 16th long run = the week-16 down-week, on sat(16)
  const anchorMonday = (() => { const d = new Date(2026, 7, 15 + 15 * 7 + 2); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const liftsFrom = (n) => Array.from({ length: n }, (_, i) => {
    const d = new Date(anchorMonday.slice(0, 4), Number(anchorMonday.slice(5, 7)) - 1, Number(anchorMonday.slice(8, 10)) + i * 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const roles = [0, 4, 8, 12, 16, 20].map((n) => mesoState(program, { liftDates: liftsFrom(n), longRunDates: runs, date: liftsFrom(n + 1).at(-1), meta }));
  assert.deepEqual(roles.map((r) => r.role), ['probe', 'probe', 'probe', 'test', 'deload', 'probe']);
  assert.ok(roles.every((r) => r.blockLength === 5));
  assert.equal(roles[0].source, 'post');
});

test('a fresh install with no runs uses a 4-week lift-count block', () => {
  const lifts = (n) => Array.from({ length: n }, (_, i) => `2026-01-${String(5 + i).padStart(2, '0')}`);
  assert.deepEqual([0, 4, 8, 12, 16].map((n) => mesoState(program, { liftDates: lifts(n), date: '2026-02-01' }).role),
    ['probe', 'probe', 'test', 'deload', 'probe']);
  assert.equal(mesoState(program, { liftDates: lifts(16), date: '2026-02-01' }).mesocycle, 2);
});

test('the v2 program keeps its five-week lift-count clock', () => {
  const lifts = (n) => Array.from({ length: n }, (_, i) => `2026-01-${String(5 + i).padStart(2, '0')}`);
  assert.equal(mesoState(v2, { liftDates: lifts(16) }).weekInMeso, 5);
  assert.equal(mesoState(v2, { liftDates: lifts(16) }).isDeload, true);
});

test('race week: legs go light in the goal run week, and skipping is recommended inside 48 h', () => {
  const cursors = { run: { week: 15 }, role: 'probe' };
  assert.equal(raceWeekStatus(program, { run: { week: 14 } }), null);
  const mon = raceWeekStatus(program, cursors, '2026-11-23'); // a Monday, long run Saturday
  assert.equal(mon.goalWeek, true);
  assert.equal(mon.recommendSkip, false);
  const fri = raceWeekStatus(program, cursors, '2026-11-27');
  assert.equal(fri.recommendSkip, true);
  assert.equal(fri.hoursToLongRun, 24);
});

test('Thursday is rest by default in the test week and once the long run reaches 8 km', () => {
  const thu = '2026-09-17';
  assert.equal(thursdayRest(program, { role: 'test', run: { week: 6 } }, thu), true);
  assert.equal(thursdayRest(program, { role: 'probe', run: { week: 6 } }, thu), false);
  assert.equal(thursdayRest(program, { role: 'probe', run: { week: 11 } }, thu), true, '8.0 km long run');
  assert.equal(thursdayRest(program, { role: 'test', run: { week: 11 } }, '2026-09-16'), false, 'only Thursday');
});
