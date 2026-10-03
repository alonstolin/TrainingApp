import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceLedger, shortfallByMuscle, weekPicture } from '../../src/core/attendance.js';
import { resolveLiftSession } from '../../src/core/prescribe.js';
import { addDays } from '../../src/core/dates.js';
import { mkSession, mkEntry, mkSet, program } from './_fixtures.mjs';

/**
 * The shortfall ledger (issue #3): every week counted against the template
 * week of the program version in force, under that week's role. Expected
 * numbers are read off program.v3.js by hand — e.g. Upper Push carries 5
 * triceps sets (overhead cable 3 + pushdown 2), Shoulders & Triceps 3 more.
 */

const MON = '2026-10-05';
const meta = { v3StartedAt: { date: '2026-09-14', weekStart: '2026-09-14', runWeekAtStart: 1, liftCompleted: 0, deloadFirst: false } };
// The template week's lift days, Monday to Sunday (weekTemplate in program.v3.js).
const WEEK = [['lift:B', 0], ['lift:A', 2], ['lift:C', 4], ['lift:D', 6]];

/** A lift session that did every planned set of `dayKey` as prescribed. */
function done(dayKey, date, { role = 'probe', version = program.version, status = 'completed' } = {}) {
  const r = resolveLiftSession(program, dayKey, { role, coreCompleted: 0 });
  return mkSession({
    dayKey, date, status,
    programRef: { programId: program.programId, version, dayKey, role, isDeload: role === 'deload' },
    entries: status === 'skipped' ? [] : r.entries.map((e) => ({ ...mkEntry(e.exerciseId, e.plannedSets.map((p) => mkSet({ type: p.type, reps: 8 }))), group: e.group ?? null })),
  });
}

const fullWeek = (monday, opts) => WEEK.map(([k, d]) => done(k, addDays(monday, d), opts));
const row = (week, muscle) => week.muscles.find((m) => m.muscle === muscle);
const ledgerOf = (sessions, from = MON, to = addDays(MON, 6)) => attendanceLedger(sessions, { from, to, meta });

test('a full week shows every session done and no shortfall', () => {
  const [week] = ledgerOf(fullWeek(MON));
  assert.equal(week.weekStart, MON);
  assert.deepEqual(week.sessions, { done: 4, template: 4 });
  assert.deepEqual(week.skipped, []);
  assert.deepEqual(row(week, 'triceps'), { muscle: 'triceps', label: 'Triceps', template: 8, owed: 8, performed: 8, shortfall: 0 });
  assert.deepEqual(row(week, 'side-delts'), { muscle: 'side-delts', label: 'Side delts', template: 8, owed: 8, performed: 8, shortfall: 0 });
  assert.ok(week.muscles.every((m) => m.shortfall === 0), JSON.stringify(week.muscles));
});

test('a skipped session costs its day\'s direct sets, and is in the skip ledger', () => {
  const sessions = fullWeek(MON);
  sessions[1] = done('lift:A', addDays(MON, 2), { status: 'skipped' });
  const [week] = ledgerOf(sessions);
  assert.deepEqual(week.sessions, { done: 3, template: 4 });
  assert.deepEqual(week.skipped, [{ date: addDays(MON, 2), dayKey: 'lift:A', name: 'Upper Push' }]);
  assert.equal(week.missed, 0, 'skipped is not missed');
  // Upper Push: chest 4, front delts 3, side delts 3, triceps 5 (+ its core).
  assert.equal(row(week, 'triceps').shortfall, 5);
  assert.equal(row(week, 'side-delts').shortfall, 3);
  assert.equal(row(week, 'chest').shortfall, 4);
  assert.equal(row(week, 'back').shortfall, 0, 'a day nobody skipped costs nothing');
});

test('a missed day lowers the session count and is attributed to no muscle', () => {
  // Shoulders & Triceps never happened: no session, so the cursor still owes it.
  const [week] = ledgerOf(fullWeek(MON).slice(0, 3));
  assert.deepEqual(week.sessions, { done: 3, template: 4 });
  assert.deepEqual(week.skipped, []);
  assert.equal(week.missed, 1);
  assert.equal(row(week, 'triceps').template, 8, 'the template week is still the template week');
  assert.equal(row(week, 'triceps').owed, 5, 'but only the settled days are owed');
  assert.equal(row(week, 'triceps').performed, 5);
  assert.ok(week.muscles.every((m) => m.shortfall === 0), JSON.stringify(week.muscles));
});

test('bonus-day sets pay back a shortfall and never count toward sessions', () => {
  const sessions = fullWeek(MON);
  sessions[1] = done('lift:A', addDays(MON, 2), { status: 'skipped' });
  // Thursday's bonus day: 2 sets each of laterals, reverse pec deck, curls, pushdowns.
  sessions.push(done('lift:E', addDays(MON, 3)));
  const [week] = ledgerOf(sessions);
  assert.deepEqual(week.sessions, { done: 3, template: 4 });
  assert.equal(row(week, 'triceps').shortfall, 3, '5 lost on Upper Push, 2 paid back by pushdowns');
  assert.equal(row(week, 'side-delts').shortfall, 1, '3 lost, 2 paid back');
  assert.equal(row(week, 'biceps').performed, 10, 'biceps 8 + 2 over the template');
  assert.equal(row(week, 'biceps').shortfall, 0);
});

test('a deload week counts against the deload-adjusted template, not a phantom half-week shortfall', () => {
  const [week] = ledgerOf(fullWeek(MON, { role: 'deload' }));
  assert.equal(week.role, 'deload');
  // Half the sets, rounded per block: triceps 2 + 1 on Upper Push, 2 on Day D.
  assert.deepEqual(row(week, 'triceps'), { muscle: 'triceps', label: 'Triceps', template: 5, owed: 5, performed: 5, shortfall: 0 });
  assert.ok(week.muscles.every((m) => m.shortfall === 0), JSON.stringify(week.muscles));
});

test('a week with no sessions takes its role from where the block stood', () => {
  // Nothing logged at all: the template is the one the engine would have served.
  const [week] = ledgerOf([]);
  assert.equal(week.role, 'probe');
  assert.equal(row(week, 'triceps').template, 8);
  assert.deepEqual(week.sessions, { done: 0, template: 4 });
});

test('each week counts against the version its sessions ran under; an empty week carries the last one forward', () => {
  // The Upper Pull swap: version 3 sessions, then version 4, then a week off.
  const sessions = [...fullWeek(MON, { version: 3 }), ...fullWeek(addDays(MON, 7), { version: 4 })];
  const weeks = ledgerOf(sessions, MON, addDays(MON, 20));
  assert.deepEqual(weeks.map((w) => w.version), [3, 4, 4]);
  // The swap traded one back exercise for another, so it moved no direct set.
  assert.deepEqual(weeks.map((w) => row(w, 'back').template), [13, 13, 13]);
  // With nothing logged before or since, the current program is in force.
  assert.deepEqual(ledgerOf([]).map((w) => w.version), [program.version]);
});

test('a week under an earlier version is charged against that version\'s template, not today\'s', () => {
  // Hypothetical: an earlier version whose Upper Pull row carried 4 sets, not 3.
  const earlier = {
    ...program,
    version: 3,
    liftDays: {
      ...program.liftDays,
      C: { ...program.liftDays.C, blocks: program.liftDays.C.blocks.map((b) => (b.exerciseId === 'chest-supported-row' ? { ...b, sets: 4 } : b)) },
    },
  };
  const programFor = (v) => (v === 3 ? earlier : program);
  const sessions = [...fullWeek(MON, { version: 3 }), ...fullWeek(addDays(MON, 7))];
  const weeks = attendanceLedger(sessions, { from: MON, to: addDays(MON, 13), meta, programFor });
  assert.deepEqual(weeks.map((w) => row(w, 'back').template), [14, 13]);
  assert.equal(row(weeks[0], 'back').shortfall, 1, 'the earlier version asked for the set nobody did');
});

test('shortfall is split by whether attendance was complete in the weeks that produced it', () => {
  // Week 1 skips Upper Push. Week 2 shows up for everything but drops one
  // pushdown set — the only kind of shortfall that argues for more volume.
  const week1 = fullWeek(MON);
  week1[1] = done('lift:A', addDays(MON, 2), { status: 'skipped' });
  const week2 = fullWeek(addDays(MON, 7));
  const pushdown = week2[1].entries.find((e) => e.exerciseId === 'rope-pushdown');
  pushdown.sets = pushdown.sets.slice(1);
  const ledger = ledgerOf([...week1, ...week2], MON, addDays(MON, 13));
  assert.deepEqual(ledger.map((w) => w.attendanceComplete), [false, true]);

  const byMuscle = (m) => shortfallByMuscle(ledger).find((r) => r.muscle === m);
  assert.deepEqual(byMuscle('triceps'), { muscle: 'triceps', label: 'Triceps', shortfall: 6, fullAttendance: 1, incompleteAttendance: 5, reading: 'mixed' });
  assert.deepEqual(byMuscle('side-delts'), { muscle: 'side-delts', label: 'Side delts', shortfall: 3, fullAttendance: 0, incompleteAttendance: 3, reading: 'attendance' });
  assert.equal(byMuscle('back'), undefined, 'a muscle never short is not listed');
});

test('a missed day leaves the week incomplete, though it costs no muscle anything', () => {
  const [week] = ledgerOf(fullWeek(MON).slice(0, 3));
  assert.equal(week.attendanceComplete, false);
  assert.deepEqual(shortfallByMuscle([week]), []);
});

test('a week the range ends inside is marked partial: its unsettled days are not yet owed', () => {
  // Wednesday of a week where only Monday's Lower is logged.
  const weeks = ledgerOf(fullWeek(MON).slice(0, 1), MON, addDays(MON, 2));
  assert.equal(weeks.length, 1);
  assert.equal(weeks[0].partial, true);
  assert.ok(weeks[0].muscles.every((m) => m.shortfall === 0));
  assert.equal(ledgerOf(fullWeek(MON))[0].partial, false);
});

test('a range that starts mid-week counts only what happened from its first day', () => {
  // v3 began on Wednesday: Monday's Lower ran under the old program and is not
  // this ledger's to judge. Wednesday's Upper Push was skipped.
  const sessions = fullWeek(MON);
  sessions[1] = done('lift:A', addDays(MON, 2), { status: 'skipped' });
  const [week] = ledgerOf(sessions, addDays(MON, 2), addDays(MON, 6));
  assert.equal(week.weekStart, MON);
  assert.equal(week.partial, true);
  assert.deepEqual(week.sessions, { done: 2, template: 4 });
  assert.equal(row(week, 'quads').performed, 0, 'Monday is before the range');
  assert.equal(row(week, 'quads').shortfall, 0);
  assert.equal(row(week, 'triceps').shortfall, 5, 'the skip inside the range still costs');
});

test('a partial week is judged on the days settled so far: a dropped set with nothing skipped reads as volume', () => {
  // Wednesday of the current week: Lower and Upper Push done, one pushdown set dropped.
  const sessions = fullWeek(MON).slice(0, 2);
  const pushdown = sessions[1].entries.find((e) => e.exerciseId === 'rope-pushdown');
  pushdown.sets = pushdown.sets.slice(1);
  const ledger = ledgerOf(sessions, MON, addDays(MON, 2));
  assert.equal(ledger[0].partial, true);
  assert.equal(ledger[0].missed, 0, 'days still ahead are not missed');
  assert.equal(ledger[0].attendanceComplete, true);
  assert.deepEqual(shortfallByMuscle(ledger).map((m) => [m.muscle, m.shortfall, m.reading]), [['triceps', 1, 'volume']]);

  // The same week with a skip in it is not complete.
  sessions[1] = done('lift:A', addDays(MON, 2), { status: 'skipped' });
  assert.equal(ledgerOf(sessions, MON, addDays(MON, 2))[0].attendanceComplete, false);
});

// ---- the current week, for Today (issue #5) --------------------------------
// Per muscle: direct sets done this week, direct sets still ahead in the
// calendar projection, and the band. Hand counts from program.v3.js: side
// delts are Upper Push 3 + Shoulders & Triceps 5, triceps 5 + 3, biceps
// Lower 3 + Upper Pull 5.

const pictureOf = (sessions, today, m = meta) => weekPicture({ sessions, meta: m }, program, { today });
const muscleIn = (pic, muscle) => pic.muscles.find((m) => m.muscle === muscle);

test('"still ahead" is the rest of the week as the calendar projects it', () => {
  // Wednesday, Monday's Lower done: Upper Push, Upper Pull and Shoulders & Triceps remain.
  const pic = pictureOf(fullWeek(MON).slice(0, 1), addDays(MON, 2));
  assert.deepEqual(pic.sessions, { done: 1, template: 4 });
  assert.deepEqual([muscleIn(pic, 'side-delts').done, muscleIn(pic, 'side-delts').ahead], [0, 8]);
  assert.deepEqual([muscleIn(pic, 'triceps').done, muscleIn(pic, 'triceps').ahead], [0, 8]);
  assert.deepEqual([muscleIn(pic, 'biceps').done, muscleIn(pic, 'biceps').ahead], [3, 5]);
});

test('falling behind shows in what is still ahead: the projection follows the cursor, not the weekday', () => {
  // Monday missed: the cursor still owes Lower, so Wednesday projects Lower,
  // Friday Upper Push, Sunday Upper Pull — and Shoulders & Triceps falls out of the week.
  const pic = pictureOf([], addDays(MON, 2));
  assert.deepEqual(pic.sessions, { done: 0, template: 4 });
  assert.equal(muscleIn(pic, 'side-delts').ahead, 3);
  assert.equal(muscleIn(pic, 'triceps').ahead, 5);
  assert.equal(muscleIn(pic, 'biceps').ahead, 8);
});

test('early in the week nothing is short while done plus ahead still reaches the band', () => {
  // Monday morning, nothing done: every set is still ahead.
  const pic = pictureOf([], MON);
  assert.deepEqual(muscleIn(pic, 'side-delts'), { muscle: 'side-delts', label: 'Side delts', done: 0, ahead: 8, band: { min: 8, max: 10 }, short: false });
  assert.equal(pic.musclesShort, 0);
  assert.deepEqual(pic.muscles.filter((m) => m.short), []);
  // In the program's band order — the priority muscles first.
  assert.deepEqual(pic.muscles.slice(0, 4).map((m) => m.muscle), ['side-delts', 'rear-delts', 'triceps', 'biceps']);
});

test('a skipped day makes its muscles short once the rest of the week cannot cover them', () => {
  // Friday: Lower done, Upper Push skipped. Upper Pull and Shoulders & Triceps remain.
  const sessions = [done('lift:B', MON), done('lift:A', addDays(MON, 2), { status: 'skipped' })];
  const pic = pictureOf(sessions, addDays(MON, 4));
  assert.deepEqual(pic.sessions, { done: 1, template: 4 });
  assert.deepEqual([muscleIn(pic, 'side-delts').ahead, muscleIn(pic, 'side-delts').short], [5, true]);
  assert.deepEqual([muscleIn(pic, 'triceps').ahead, muscleIn(pic, 'triceps').short], [3, true]);
  assert.equal(muscleIn(pic, 'chest').short, false, 'Shoulders & Triceps still brings 3 chest sets, the band\'s low edge');
  assert.equal(muscleIn(pic, 'core').short, false, 'Lower already banked 8 core sets against a low edge of 6');
  assert.deepEqual(pic.muscles.filter((m) => m.short).map((m) => m.muscle).sort(), ['side-delts', 'triceps']);
  assert.equal(pic.musclesShort, 2);
});

test('a deload week halves the bands and what is still ahead, so it reads as no shortfall', () => {
  // The v3 entry deload: Monday, nothing done, every day ahead resolved as a deload.
  const deloadMeta = { v3StartedAt: { ...meta.v3StartedAt, deloadFirst: true } };
  const pic = pictureOf([], MON, deloadMeta);
  assert.equal(pic.role, 'deload');
  // Side delts: 3 → 2 on Upper Push, 3 → 2 and 2 → 1 on Shoulders & Triceps.
  assert.deepEqual(muscleIn(pic, 'side-delts'), { muscle: 'side-delts', label: 'Side delts', done: 0, ahead: 5, band: { min: 4, max: 5 }, short: false });
  assert.deepEqual(muscleIn(pic, 'back').band, { min: 3, max: 7 }, 'an odd band rounds toward the lenient side');
  assert.equal(pic.musclesShort, 0);
  assert.equal(pictureOf([], MON).role, 'probe');
});

test('the band follows the role the week\'s sessions ran under, even once the cursor has moved on', () => {
  // The entry deload, all four days done by Thursday: the cursor has moved on
  // to the first probe week, but this week was a deload and is judged as one.
  const deloadMeta = { v3StartedAt: { ...meta.v3StartedAt, deloadFirst: true } };
  const sessions = WEEK.map(([k], i) => done(k, addDays(MON, i), { role: 'deload' }));
  const pic = pictureOf(sessions, addDays(MON, 4), deloadMeta);
  assert.equal(pic.role, 'deload');
  assert.deepEqual(muscleIn(pic, 'side-delts').band, { min: 4, max: 5 });
  assert.equal(muscleIn(pic, 'side-delts').short, false);
});
