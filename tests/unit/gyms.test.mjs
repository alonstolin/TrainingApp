import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeHistoryLookup } from '../../src/core/schedule.js';
import { resolveLiftSession } from '../../src/core/prescribe.js';
import { getExercise } from '../../src/program/exercises.js';
import { program, mkSession, mkEntry, mkSet } from './_fixtures.mjs';

/**
 * Two gyms, several cable stations: a stack's 40 is not another stack's 40.
 * History for gym-specific exercises is read exact station → same gym → any
 * gym, and says how far it reached (SYNTHESIS gyms feature; see makeHistoryLookup).
 */

const lateral = (date, gymId, station, kg) =>
  mkSession({
    kind: 'lift', dayKey: 'lift:A', date, gymId,
    entries: [{ ...mkEntry('cable-lateral-raise', [mkSet({ weightKg: kg, reps: 15, rpe: 8 }), mkSet({ weightKg: kg, reps: 15, rpe: 8 }), mkSet({ weightKg: kg, reps: 15, rpe: 10 })]), station }],
  });
const ohp = (date, gymId, kg) =>
  mkSession({ kind: 'lift', dayKey: 'lift:A', date, gymId, entries: [mkEntry('ohp', [mkSet({ weightKg: kg, reps: 8, rpe: 7 })])] });

const sessions = [
  lateral('2026-09-01', 'g1', 'left stack', 20),
  lateral('2026-09-03', 'g1', 'right stack', 25),
  lateral('2026-09-05', 'g2', null, 12.5),
  ohp('2026-09-01', 'g1', 60),
  ohp('2026-09-05', 'g2', 62.5),
];

test('exact station first, then the same gym, then anywhere — and the row says which', () => {
  const lookup = makeHistoryLookup(sessions);
  const exact = lookup('cable-lateral-raise', { dayKey: 'lift:A', gymId: 'g1', station: 'left stack' });
  assert.equal(exact.sets[0].weightKg, 20);
  assert.equal(exact.scope, 'exact');

  const sameGym = lookup('cable-lateral-raise', { dayKey: 'lift:A', gymId: 'g1', station: 'new machine' });
  assert.equal(sameGym.sets[0].weightKg, 25, 'newest row at that gym');
  assert.equal(sameGym.scope, 'gym');

  const other = lookup('cable-lateral-raise', { dayKey: 'lift:A', gymId: 'g3' });
  assert.equal(other.sets[0].weightKg, 12.5, 'newest row anywhere');
  assert.equal(other.scope, 'other');
});

test('without a gym in the request the lookup is unscoped and unlabelled', () => {
  const lookup = makeHistoryLookup(sessions);
  const r = lookup('cable-lateral-raise', { dayKey: 'lift:A' });
  assert.equal(r.sets[0].weightKg, 12.5);
  assert.equal(r.scope, undefined);
});

test('the ladder also applies to `all` rows, so a reference is built from one gym only', () => {
  const lookup = makeHistoryLookup(sessions);
  const rows = lookup('cable-lateral-raise', { dayKey: 'lift:A', gymId: 'g1', all: true });
  assert.deepEqual(rows.map((r) => r.sets[0].weightKg), [25, 20]);
  assert.ok(rows.every((r) => r.scope === 'gym'));
});

test('barbell lifts ignore the gym: the newest session anywhere is the basis', () => {
  const lookup = makeHistoryLookup(sessions);
  const s = resolveLiftSession(program, 'lift:A', { role: 'probe', historyFor: lookup, gymId: 'g1', coreCompleted: 0 });
  const ohpEntry = s.entries.find((e) => e.exerciseId === 'ohp');
  assert.equal(ohpEntry.lastTime.sets[0].weightKg, 62.5, 'g2 session is newer and a barbell is a barbell');
  assert.equal(ohpEntry.scope, null);
  assert.equal(getExercise('ohp').gymSpecific, false);
  assert.equal(getExercise('cable-lateral-raise').gymSpecific, true);
});

test('a stack exercise at a gym with no history reads the other gym as a guide, not a target', () => {
  const lookup = makeHistoryLookup(sessions);
  const s = resolveLiftSession(program, 'lift:A', { role: 'probe', historyFor: lookup, gymId: 'g3', coreCompleted: 0 });
  const lat = s.entries.find((e) => e.exerciseId === 'cable-lateral-raise');
  assert.equal(lat.scope, 'other');
  assert.match(lat.suggestion, /another gym — treat it as a guide/);
  const home = resolveLiftSession(program, 'lift:A', { role: 'probe', historyFor: lookup, gymId: 'g1', coreCompleted: 0 });
  assert.equal(home.entries.find((e) => e.exerciseId === 'cable-lateral-raise').scope, 'gym');
});

test('a standing substitution swaps the exercise at resolution, for that gym only', () => {
  const subs = { g2: { 'cable-lateral-raise': 'db-lateral-raise' } };
  const at = (gymId) => resolveLiftSession(program, 'lift:A', { role: 'probe', historyFor: () => null, gymId, substitutions: subs, coreCompleted: 0 });
  const g2 = at('g2').entries[2];
  assert.equal(g2.exerciseId, 'db-lateral-raise');
  assert.equal(g2.swappedFrom, 'cable-lateral-raise');
  assert.equal(g2.plannedSets.length, 3, 'the block\'s scheme stays');
  assert.equal(g2.plannedSets.at(-1).rpeTarget, 10, 'and so does the last-set-to-failure rule');
  assert.equal(at('g1').entries[2].exerciseId, 'cable-lateral-raise');
  assert.equal(at(null).entries[2].exerciseId, 'cable-lateral-raise');
});

test('every programmed exercise offers at least one alternative, and alternatives share the muscle', () => {
  const ids = new Set();
  for (const day of Object.values(program.liftDays)) for (const b of day.blocks) ids.add(b.exerciseId);
  for (const id of ids) {
    const ex = getExercise(id);
    assert.ok(ex.alternatives.length >= 1, `${id} has no alternative`);
    for (const alt of ex.alternatives) {
      assert.equal(getExercise(alt).muscle, ex.muscle, `${alt} is not a like-for-like substitute for ${id}`);
    }
  }
});
