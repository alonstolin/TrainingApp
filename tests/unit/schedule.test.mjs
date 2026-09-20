import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveCursors, resolveToday, alternatives, longestRecentRunKm } from '../../src/core/schedule.js';
import { mkSession, completedLifts, emptyState, program } from './_fixtures.mjs';

const st = (sessions, meta = {}) => ({
  sessions,
  meta: { startDate: '2026-01-05', bodyweightKg: 80, ...meta },
});

// Calendar anchors used throughout (2026): Mon 17 Aug … Sun 23 Aug.
const MON = '2026-08-17';
const TUE = '2026-08-18';
const WED = '2026-08-19';
const THU = '2026-08-20';
const FRI = '2026-08-21';
const SAT = '2026-08-22';
const SUN = '2026-08-23';

test('fresh state starts at meso 1, week 1, first lift in the cycle', () => {
  const c = deriveCursors([], program);
  assert.equal(c.mesocycle, 1);
  assert.equal(c.weekInMeso, 1);
  assert.equal(c.lift.position, 0);
  assert.equal(c.lift.nextDayKey, 'lift:B');
  assert.equal(c.run.week, 1);
});

test('lift cursor cycles B → A → C → D → B', () => {
  const seen = [];
  for (let i = 0; i < 5; i++) {
    seen.push(deriveCursors(completedLifts(i), program).lift.nextDayKey);
  }
  assert.deepEqual(seen, ['lift:B', 'lift:A', 'lift:C', 'lift:D', 'lift:B']);
});

test('with no running, the mesocycle week is driven by sessions completed, NOT by the calendar', () => {
  // This is the whole point of the cursor model: the deload must arrive after
  // twelve lift sessions, not after 21 days have elapsed. (During the 10K build
  // the lifting week follows the RUN week instead — see meso.test.mjs.)
  const at = (n) => deriveCursors(completedLifts(n), program, { today: '2026-03-01' });
  assert.equal(at(0).weekInMeso, 1);
  assert.equal(at(3).weekInMeso, 1);
  assert.equal(at(4).weekInMeso, 2);
  assert.equal(at(8).weekInMeso, 3);
  assert.equal(at(8).role, 'test');
  assert.equal(at(12).weekInMeso, 4, 'deload week');
  assert.equal(at(12).isDeload, true);
  assert.equal(at(16).weekInMeso, 1, 'new block');
  assert.equal(at(16).mesocycle, 2);
});

test('skipping advances the cycle but NOT the mesocycle week', () => {
  // Otherwise you could skip your way into a deload without training.
  const sessions = [
    mkSession({ kind: 'lift', dayKey: 'lift:B', status: 'completed' }),
    mkSession({ kind: 'lift', dayKey: 'lift:A', status: 'skipped' }),
    mkSession({ kind: 'lift', dayKey: 'lift:C', status: 'completed' }),
  ];
  const c = deriveCursors(sessions, program);
  assert.equal(c.lift.position, 3, 'all three advance the cycle');
  assert.equal(c.lift.completed, 2, 'only two count as training');
  assert.equal(c.lift.nextDayKey, 'lift:D');
  assert.equal(c.weekInMeso, 1, 'two completed sessions is still week 1');
});

test('the optional bonus day never advances the lift cycle', () => {
  const sessions = [
    ...completedLifts(1),
    mkSession({ kind: 'lift', dayKey: 'lift:E', status: 'completed' }),
  ];
  const c = deriveCursors(sessions, program);
  assert.equal(c.lift.position, 1, 'an extra arm day does not consume a programmed session');
  assert.equal(c.lift.nextDayKey, 'lift:A');
});

test('in-progress sessions do not move any cursor', () => {
  const c = deriveCursors([mkSession({ kind: 'lift', status: 'in_progress' })], program);
  assert.equal(c.lift.position, 0);
});

test('run week advances only when the LONG run is banked', () => {
  const easy = Array.from({ length: 5 }, () =>
    mkSession({ kind: 'run', variant: 'easy', status: 'completed' }),
  );
  assert.equal(deriveCursors(easy, program).run.week, 1, 'easy runs never advance the plan');

  const withLong = [...easy, mkSession({ kind: 'run', variant: 'long', status: 'completed' })];
  assert.equal(deriveCursors(withLong, program).run.week, 2);
});

test('a skipped long run repeats the week rather than skipping ahead', () => {
  // Advancing here would let you jump a distance step you never actually built
  // tolerance for — precisely the single-session spike that drives injuries.
  const sessions = [mkSession({ kind: 'run', variant: 'long', status: 'skipped' })];
  assert.equal(deriveCursors(sessions, program).run.week, 1);
});

test('core phase is gated on completed core sessions — standalone or attached to a lift day', () => {
  const core = (n, status = 'completed') =>
    Array.from({ length: n }, () => mkSession({ kind: 'core', status }));
  assert.equal(deriveCursors(core(0), program).core.completed, 0);
  assert.equal(deriveCursors(core(12), program).core.completed, 12);
  assert.equal(deriveCursors(core(5, 'skipped'), program).core.completed, 0);

  const withCore = mkSession({ kind: 'lift', dayKey: 'lift:B', status: 'completed',
    entries: [{ entryId: 'e0', exerciseId: 'back-squat', sets: [{ done: true, reps: 5 }] }, { entryId: 'e9', exerciseId: 'cable-crunch', group: 'core', sets: [{ done: true, reps: 12 }] }] });
  const skippedCore = mkSession({ kind: 'lift', dayKey: 'lift:B', status: 'completed',
    entries: [{ entryId: 'e0', exerciseId: 'back-squat', sets: [{ done: true, reps: 5 }] }, { entryId: 'e9', exerciseId: 'cable-crunch', group: 'core', sets: [] }] });
  assert.equal(deriveCursors([withCore, skippedCore], program).core.completed, 1, 'only the lift that actually did its core counts');
});

test('Today serves the calendar slot when you are on schedule', () => {
  const today = resolveToday(emptyState(), program, MON);
  assert.equal(today.primary.key, 'lift:B');
  assert.equal(today.primary.offSchedule, false);
  assert.equal(today.isRestDay, false);
});

test('Today serves what you OWE, not what the calendar says, when you are behind', () => {
  // Nothing done yet, but it is now Wednesday (the calendar's Upper Push day).
  // The cursor still owes Lower, so that is what you get — the session is never lost.
  const today = resolveToday(emptyState(), program, WED);
  assert.equal(today.slotKeyIsB ?? today.primary.slotKey, 'lift:A', 'the calendar slot is Upper Push');
  assert.equal(today.primary.key, 'lift:B', 'but the cursor owes Lower');
  assert.equal(today.primary.offSchedule, true);
  assert.ok(today.drift.lift >= 1, 'and it reports being behind');
});

test('Thursday is a rest day with both extras offered in a probe week', () => {
  const today = resolveToday(emptyState(), program, THU);
  assert.equal(today.isRestDay, true);
  assert.equal(today.primary, null);
  assert.equal(today.restByDefault, false);
  const keys = today.optional.map((o) => o.slotKey).sort();
  assert.deepEqual(keys, ['lift:E', 'run:easy']);
});

test('in the test week Thursday is rest by default and the bonus day is withdrawn', () => {
  const t = resolveToday(st(completedLifts(8)), program, THU); // lift-count clock: week 3 = test
  assert.equal(t.role, 'test');
  assert.equal(t.restByDefault, true);
  assert.deepEqual(t.optional.map((o) => o.slotKey), ['run:easy'], 'lift:E is not offered outside probe weeks');
});

test('Saturday leads with the long run; core is optional, not owed', () => {
  const today = resolveToday(emptyState(), program, SAT);
  assert.equal(today.primary.key, 'run:long');
  assert.deepEqual(today.also, []);
  assert.deepEqual(today.optional.map((c) => c.key), ['core']);
});

test('Tuesday is the easy run and nothing else — core lives at the end of Lower and Push now', () => {
  const today = resolveToday(emptyState(), program, TUE);
  assert.equal(today.primary.key, 'run:easy');
  assert.deepEqual(today.also, []);
});

test('Friday leads with the lift and nothing else', () => {
  const t = resolveToday(st(completedLifts(2)), program, FRI);
  assert.equal(t.primary.track, 'lift');
  assert.deepEqual(t.also, []);
});

test('Lower and Push carry core entries at the end; Pull and Delts do not', () => {
  const mon = resolveToday(emptyState(), program, MON);
  assert.ok(mon.primary.session.entries.some((e) => e.group === 'core'));
  const fri = resolveToday(st(completedLifts(2)), program, FRI);
  assert.equal(fri.primary.key, 'lift:C');
  assert.ok(!fri.primary.session.entries.some((e) => e.group === 'core'));
});

test('Sunday serves Shoulders & Triceps when on schedule', () => {
  const t = resolveToday(st(completedLifts(3)), program, SUN);
  assert.equal(t.primary.key, 'lift:D');
  assert.equal(t.primary.offSchedule, false);
});

test('a session already completed today drops off the card', () => {
  const sessions = [mkSession({ kind: 'lift', dayKey: 'lift:B', date: MON, status: 'completed' })];
  const today = resolveToday(st(sessions), program, MON);
  assert.equal(today.isRestDay, true, 'nothing left to do today');
  assert.equal(today.completedToday.length, 1);
});

test('an in-progress session surfaces as resumable', () => {
  const s = mkSession({ kind: 'lift', dayKey: 'lift:B', date: MON, status: 'in_progress' });
  const today = resolveToday(st([s]), program, MON);
  assert.equal(today.resume?.id, s.id);
});

test('training out of order just works', () => {
  // Did Upper Pull (position 3 in the cycle) first. The cursor is positional,
  // so the next session is simply whatever follows in the cycle.
  const sessions = [mkSession({ kind: 'lift', dayKey: 'lift:C', status: 'completed' })];
  const c = deriveCursors(sessions, program);
  assert.equal(c.lift.position, 1);
  assert.equal(c.lift.nextDayKey, 'lift:A');
});

test('drift counts missed sessions, and the catch-up prompt fires at three', () => {
  // Started 5 Jan, trained nothing, and it is now three weeks later.
  const today = resolveToday(emptyState({ startDate: '2026-08-03' }), program, MON);
  assert.ok(today.drift.lift >= 3, `expected 3+ missed lifts, got ${today.drift.lift}`);
  assert.equal(today.needsCatchUp, true);
});

test('drift is zero when you are keeping up', () => {
  const sessions = [mkSession({ kind: 'lift', dayKey: 'lift:B', date: SUN, status: 'completed' })];
  const t = resolveToday(st(sessions, { startDate: SUN }), program, MON);
  assert.equal(t.drift.lift, 0);
});

test('deload week is flagged on the Today payload', () => {
  const t = resolveToday(st(completedLifts(12)), program, MON);
  assert.equal(t.weekInMeso, 4);
  assert.equal(t.role, 'deload');
  assert.equal(t.isDeload, true);
  assert.match(t.weekNote, /DELOAD/);
  assert.equal(t.primary.session.isDeload, true);
});

test('the lift card resolves with the block role, the athlete\'s bodyweight and gym', () => {
  const t = resolveToday(st([], { bodyweightKg: 84, lastGymId: 'g1' }), program, MON);
  assert.equal(t.primary.session.role, 'probe');
  assert.equal(t.primary.session.gymId, 'g1');
});

test('alternatives offer every session, with what you owe first', () => {
  const alts = alternatives(emptyState(), program, THU);
  assert.equal(alts[0].key, 'lift:B');
  assert.equal(alts[0].isNext, true);
  const keys = alts.map((a) => a.key);
  for (const k of ['lift:A', 'lift:C', 'lift:D', 'lift:E', 'run:easy', 'run:long', 'core']) {
    assert.ok(keys.includes(k), `missing ${k}`);
  }
});

test('alternatives rotate to start at the owed lift', () => {
  const alts = alternatives(st(completedLifts(2)), program, THU);
  assert.deepEqual(alts.slice(0, 4).map((a) => a.key), ['lift:C', 'lift:D', 'lift:B', 'lift:A']);
});

test('longestRecentRunKm only looks at the trailing window', () => {
  const sessions = [
    mkSession({ kind: 'run', date: '2026-08-15', status: 'completed', run: { distanceKm: 8, durationSec: 2880 } }),
    mkSession({ kind: 'run', date: '2026-05-01', status: 'completed', run: { distanceKm: 12, durationSec: 4000 } }),
  ];
  assert.equal(longestRecentRunKm(sessions, MON, 30), 8, 'the 12km is months old and does not count');
});

test('longestRecentRunKm ignores skipped runs', () => {
  const sessions = [
    mkSession({ kind: 'run', date: '2026-08-15', status: 'skipped', run: { distanceKm: 20, durationSec: 1 } }),
  ];
  assert.equal(longestRecentRunKm(sessions, MON, 30), 0);
});
