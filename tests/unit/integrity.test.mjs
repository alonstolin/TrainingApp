import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionIntegrity } from '../../src/core/schema.js';
import { resolveLiftSession } from '../../src/core/prescribe.js';
import { program, v2, mkSession, mkEntry, mkSet } from './_fixtures.mjs';

const snapOf = (dayKey, p = program) =>
  resolveLiftSession(p, dayKey, { role: 'probe', historyFor: () => null, coreCompleted: 0 });

const sessionFrom = (snap, over = {}) =>
  mkSession({
    kind: 'lift',
    dayKey: snap.dayKey,
    programRef: { programId: program.programId, version: program.version, dayKey: snap.dayKey },
    prescriptionSnapshot: snap,
    entries: snap.entries.map((e) => mkEntry(e.exerciseId, [mkSet({ weightKg: 20, reps: 8 })])),
    ...over,
  });

test('a session started from its own prescription passes', () => {
  for (const k of program.liftCycle) assert.equal(sessionIntegrity(sessionFrom(snapOf(k)), program).ok, true, k);
});

test('a "Shoulders & Triceps" title over Upper Push\'s exercises is caught, with both names', () => {
  const snap = { ...snapOf('lift:A'), dayKey: 'lift:D', name: program.liftDays.D.name };
  const s = sessionFrom(snap, { dayKey: 'lift:D', programRef: { version: program.version, dayKey: 'lift:D' } });
  const r = sessionIntegrity(s, program);
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => /overhead-cable-tricep is not part of lift:D/.test(p)), r.problems.join(' | '));
});

test('a dayKey that disagrees with its snapshot or program reference is caught', () => {
  const snap = snapOf('lift:A');
  const r = sessionIntegrity(sessionFrom(snap, { dayKey: 'lift:C' }), program);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(' '), /snapshot is lift:A but the session is filed as lift:C/);
});

test('a stale title is reported only against the program version the session ran under', () => {
  // v2 called day D "Shoulders & Arms". A v2 session keeps that title and is
  // fine when checked against v2; the rename is not retroactive.
  const snap = snapOf('lift:D', v2);
  const s = sessionFrom(snap, { programRef: { version: 2, dayKey: 'lift:D' } });
  assert.equal(sessionIntegrity(s, v2).ok, true);
  assert.equal(snap.name, 'Shoulders & Arms');
});

test('swapped and added exercises are not mismatches', () => {
  const snap = snapOf('lift:A');
  const s = sessionFrom(snap);
  s.entries[2] = { ...mkEntry('db-lateral-raise', [mkSet({ weightKg: 10, reps: 15 })]), swappedFrom: 'cable-lateral-raise' };
  s.entries.push({ ...mkEntry('hammer-curl', [mkSet({ weightKg: 10, reps: 12 })]), added: true });
  assert.equal(sessionIntegrity(s, program).ok, true);
});

test('core work attached to the day is part of the day', () => {
  const s = sessionFrom(snapOf('lift:B'));
  assert.ok(s.entries.some((e) => e.exerciseId === 'cable-crunch'));
  assert.equal(sessionIntegrity(s, program).ok, true);
});

test('runs and sessions without a snapshot are never flagged', () => {
  assert.equal(sessionIntegrity(mkSession({ kind: 'run' }), program).ok, true);
  assert.equal(sessionIntegrity(mkSession({ kind: 'lift', prescriptionSnapshot: null }), program).ok, true);
});
