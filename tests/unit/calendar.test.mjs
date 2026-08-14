import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, projectGoalDate, weekPattern, monthGrid, slotLabel } from '../../src/core/calendar.js';
import { mkSession, completedLifts, emptyState, program } from './_fixtures.mjs';

const st = (sessions, meta = {}) => ({
  sessions,
  meta: { startDate: '2026-08-17', bodyweightKg: 80, ...meta },
});

const MON = '2026-08-17';
const TUE = '2026-08-18';
const SAT = '2026-08-22';
const SUN = '2026-08-23';

const day = (days, date) => days.find((d) => d.date === date);
const keysOn = (days, date) => day(days, date).entries.map((e) => e.key);

test('the weekly pattern matches the program template, Monday first', () => {
  const wk = weekPattern(program);
  assert.deepEqual(wk.map((d) => d.day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  assert.deepEqual(wk[0].slots.map((s) => s.key), ['lift:B']);
  assert.deepEqual(wk[1].slots.map((s) => s.key), ['run:easy', 'core']);
  assert.equal(wk[3].isRest, true, 'Thursday is optional-only');
  assert.deepEqual(wk[5].slots.map((s) => s.key), ['run:long', 'core']);
});

test('future days are projected from the cursor, cycling the lift days in order', () => {
  const days = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-08-23', today: MON, includeOptional: false,
  });

  assert.deepEqual(keysOn(days, MON), ['lift:B']);
  assert.deepEqual(keysOn(days, '2026-08-19'), ['lift:A']);
  assert.deepEqual(keysOn(days, '2026-08-21'), ['lift:C', 'core']);
  assert.deepEqual(keysOn(days, SUN), ['lift:D']);
});

test('every future entry is marked projected, never presented as fact', () => {
  const days = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-09-30', today: MON,
  });
  for (const d of days) {
    for (const e of d.entries) {
      assert.equal(e.projected, true, `${d.date} ${e.key} should be projected`);
      assert.equal(e.status, 'projected');
    }
  }
});

test('the projection starts from where the cursor actually is, not from day one', () => {
  // Two lifts already done, so the next projected lift is the third in the cycle.
  const days = buildCalendar(st(completedLifts(2)), program, {
    from: MON, to: MON, today: MON, includeOptional: false,
  });
  assert.deepEqual(keysOn(days, MON), ['lift:C']);
});

test('projected mesocycle week advances every four projected lifts', () => {
  const days = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-10-30', today: MON, includeOptional: false,
  });
  const lifts = days.flatMap((d) => d.entries.filter((e) => e.track === 'lift'));
  assert.equal(lifts[0].weekInMeso, 1);
  assert.equal(lifts[3].weekInMeso, 1);
  assert.equal(lifts[4].weekInMeso, 2);
  assert.equal(lifts[16].weekInMeso, 5);
  assert.equal(lifts[16].isDeload, true, 'the deload is visible in advance');
  assert.equal(lifts[20].weekInMeso, 1);
  assert.equal(lifts[20].mesocycle, 2);
});

test('the run plan advances only on projected LONG runs', () => {
  const days = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-09-20', today: MON, includeOptional: false,
  });
  const runs = days.flatMap((d) => d.entries.filter((e) => e.track === 'run'));
  const week1 = runs.filter((r) => r.runWeek === 1);
  assert.ok(week1.length >= 2, 'easy and long share a run week');
  const longs = runs.filter((r) => r.key === 'run:long');
  assert.deepEqual(longs.slice(0, 4).map((r) => r.runWeek), [1, 2, 3, 4]);
});

test('the optional bonus day does not shift the rest of the plan', () => {
  const withOpt = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-09-30', today: MON, includeOptional: true,
  });
  const withoutOpt = buildCalendar(emptyState({ startDate: MON }), program, {
    from: MON, to: '2026-09-30', today: MON, includeOptional: false,
  });
  const liftsOf = (days) =>
    days.flatMap((d) => d.entries.filter((e) => e.track === 'lift' && !e.optional).map((e) => `${d.date}:${e.key}`));
  assert.deepEqual(liftsOf(withOpt), liftsOf(withoutOpt));

  const thu = day(withOpt, '2026-08-20');
  assert.ok(thu.entries.some((e) => e.optional), 'Thursday still offers the bonus');
});

test('past days show what was actually done, not a forecast', () => {
  const sessions = [
    mkSession({ kind: 'lift', dayKey: 'lift:B', date: MON, status: 'completed' }),
    mkSession({ kind: 'run', variant: 'easy', date: TUE, status: 'completed', run: { distanceKm: 4.2, durationSec: 1500 } }),
  ];
  const days = buildCalendar(st(sessions), program, {
    from: MON, to: '2026-08-19', today: '2026-08-19',
  });

  const mon = day(days, MON);
  assert.equal(mon.entries[0].status, 'completed');
  assert.equal(mon.entries[0].projected, false);

  const tue = day(days, TUE);
  const run = tue.entries.find((e) => e.track === 'run');
  assert.equal(run.status, 'completed');
  assert.equal(run.detail, '4.2 km');
});

test('a scheduled slot with nothing logged shows as missed', () => {
  const days = buildCalendar(st([], { startDate: MON }), program, {
    from: MON, to: TUE, today: '2026-08-19',
  });
  const mon = day(days, MON);
  assert.equal(mon.entries.length, 1);
  assert.equal(mon.entries[0].status, 'missed');
  assert.equal(mon.entries[0].key, 'lift:B');
});

test('an optional slot missed in the past is not reported as a miss', () => {
  // Thursday is optional; not doing it is not a failure.
  const days = buildCalendar(st([], { startDate: MON }), program, {
    from: '2026-08-20', to: '2026-08-20', today: '2026-08-21',
  });
  assert.deepEqual(day(days, '2026-08-20').entries, []);
});

test('a skipped session reads as skipped, not missed', () => {
  const sessions = [mkSession({ kind: 'lift', dayKey: 'lift:B', date: MON, status: 'skipped' })];
  const days = buildCalendar(st(sessions), program, { from: MON, to: MON, today: TUE });
  const e = day(days, MON).entries[0];
  assert.equal(e.status, 'skipped');
  assert.equal(e.detail, 'skipped');
});

test("today shows what is done as fact and what remains as forecast", () => {
  const sessions = [mkSession({ kind: 'run', variant: 'easy', date: TUE, status: 'completed' })];
  const days = buildCalendar(st(sessions), program, { from: TUE, to: TUE, today: TUE });
  const t = day(days, TUE);
  assert.equal(t.entries.filter((e) => e.status === 'completed').length, 1, 'the run is logged');
  const remaining = t.entries.filter((e) => e.projected);
  assert.deepEqual(remaining.map((e) => e.key), ['core'], 'only core is still outstanding');
});

test('a fully completed day projects nothing further', () => {
  const sessions = [
    mkSession({ kind: 'run', variant: 'long', date: SAT, status: 'completed' }),
    mkSession({ kind: 'core', date: SAT, status: 'completed' }),
  ];
  const days = buildCalendar(st(sessions), program, { from: SAT, to: SAT, today: SAT });
  assert.equal(day(days, SAT).entries.every((e) => !e.projected), true);
});

test('the 10K goal date is projected and moves out when you fall behind', () => {
  const onTrack = projectGoalDate(emptyState({ startDate: MON }), program, MON);
  assert.ok(onTrack, 'a goal date should be projected');
  assert.equal(onTrack.km, 10);
  // 14 run weeks, one long run each, one long run a week.
  assert.ok(onTrack.weeksAway >= 13 && onTrack.weeksAway <= 15, `got ${onTrack.weeksAway} weeks`);

  const ahead = projectGoalDate(
    st(Array.from({ length: 6 }, () => mkSession({ kind: 'run', variant: 'long', status: 'completed' }))),
    program,
    MON,
  );
  assert.ok(ahead.weeksAway < onTrack.weeksAway, 'banking long runs brings the goal closer');
});

test('the goal date is null once the 10K is banked', () => {
  const done = Array.from({ length: 14 }, () =>
    mkSession({ kind: 'run', variant: 'long', status: 'completed' }),
  );
  assert.equal(projectGoalDate(st(done), program, MON), null);
});

test('monthGrid pads to a Monday-first grid', () => {
  // 1 Aug 2026 is a Saturday → five leading blanks.
  const aug = monthGrid(2026, 7);
  assert.equal(aug.lead, 5);
  assert.equal(aug.dates.length, 31);
  assert.equal(aug.first, '2026-08-01');
  assert.equal(aug.last, '2026-08-31');

  // 1 Feb 2027 is a Monday → no padding.
  assert.equal(monthGrid(2027, 1).lead, 0);
  assert.equal(monthGrid(2024, 1).dates.length, 29, 'leap February');
});

test('slot labels describe runs by their target and core by its phase', () => {
  assert.equal(slotLabel(program, 'run:long', { runWeek: 1 }).target, '25 min');
  assert.equal(slotLabel(program, 'run:long', { runWeek: 14 }).target, '10 km');
  assert.equal(slotLabel(program, 'run:long', { runWeek: 14 }).isGoal, true);
  assert.equal(slotLabel(program, 'run:long', { runWeek: 8 }).isDown, true);
  assert.equal(slotLabel(program, 'core', { coreCompleted: 0 }).phase, 1);
  assert.equal(slotLabel(program, 'core', { coreCompleted: 30 }).phase, 3);
  assert.equal(slotLabel(program, 'lift:D', {}).short, 'Delts');
});

test('an inverted range yields nothing rather than looping', () => {
  assert.deepEqual(buildCalendar(emptyState(), program, { from: SUN, to: MON, today: MON }), []);
});
