import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateBackup, buildBackup, mergeSessions, validateSession, migrate, SCHEMA_VERSION,
} from '../../src/core/schema.js';
import { mkSession, mkEntry, mkSet } from './_fixtures.mjs';

test('a freshly built backup validates', () => {
  const backup = buildBackup({ startDate: '2026-01-05' }, [mkSession()], '1.0.0');
  const r = validateBackup(backup);
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.data.sessions.length, 1);
});

test('export → import round-trips without losing anything', () => {
  const sessions = [
    mkSession({
      kind: 'lift',
      entries: [mkEntry('incline-bench', [mkSet({ weightKg: 82.5, reps: 5, rpe: 8, type: 'top' })])],
    }),
    mkSession({ kind: 'run', variant: 'long', run: { distanceKm: 8.5, durationSec: 3060, effort: 5 } }),
    mkSession({ kind: 'core' }),
  ];
  const text = JSON.stringify(buildBackup({ bodyweightKg: 78 }, sessions, '1.0.0'));
  const r = validateBackup(text);

  assert.equal(r.ok, true);
  assert.equal(r.data.sessions.length, 3);
  assert.equal(r.data.meta.bodyweightKg, 78);
  assert.deepEqual(r.data.sessions[0].entries[0].sets[0].weightKg, 82.5);
  assert.equal(r.data.sessions[1].run.distanceKm, 8.5);
});

test('garbage is rejected rather than half-imported', () => {
  assert.equal(validateBackup('not json at all').ok, false);
  assert.equal(validateBackup({ sessions: [] }).ok, false, 'missing format tag');
  assert.equal(validateBackup({ format: 'trainingapp-backup' }).ok, false, 'missing sessions');
  assert.equal(validateBackup(null).ok, false);
});

test('a backup from a newer schema is refused, not silently mangled', () => {
  const r = validateBackup({
    format: 'trainingapp-backup',
    schemaVersion: SCHEMA_VERSION + 5,
    sessions: [],
  });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /Update the app first/);
});

test('individually corrupt sessions are dropped with a warning, the rest survive', () => {
  const r = validateBackup({
    format: 'trainingapp-backup',
    schemaVersion: 1,
    sessions: [mkSession(), { id: 'x', date: 'nonsense', kind: 'lift', status: 'completed' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.data.sessions.length, 1, 'the good one is kept');
  assert.ok(r.warnings.length > 0, 'and the bad one is reported');
});

test('validateSession catches the fields the app cannot function without', () => {
  assert.deepEqual(validateSession(mkSession()), []);
  assert.ok(validateSession({ ...mkSession(), date: '17/08/2026' }).length);
  assert.ok(validateSession({ ...mkSession(), kind: 'yoga' }).length);
  assert.ok(validateSession({ ...mkSession(), status: 'maybe' }).length);
  assert.ok(validateSession({ ...mkSession(), id: '' }).length);
  assert.ok(
    validateSession({ ...mkSession({ kind: 'run' }), run: null, status: 'completed' }).length,
    'a completed run with no run data is broken',
  );
});

test('merge unions by id and lets the newer record win', () => {
  const a = mkSession({ id: 'same', updatedAt: 100, notes: 'old' });
  const b = { ...mkSession({ id: 'same', updatedAt: 200 }), notes: 'new' };
  const other = mkSession({ id: 'other' });

  const r = mergeSessions([a, other], [b]);
  assert.equal(r.sessions.length, 2);
  assert.equal(r.updated, 1);
  assert.equal(r.sessions.find((s) => s.id === 'same').notes, 'new');
});

test('importing an older backup never clobbers newer work', () => {
  const current = mkSession({ id: 'same', updatedAt: 500, notes: 'current' });
  const stale = { ...mkSession({ id: 'same', updatedAt: 100 }), notes: 'stale' };
  const r = mergeSessions([current], [stale]);
  assert.equal(r.ignored, 1);
  assert.equal(r.sessions[0].notes, 'current');
});

test('merge adds genuinely new sessions and sorts by date', () => {
  const r = mergeSessions(
    [mkSession({ id: 'b', date: '2026-02-01' })],
    [mkSession({ id: 'a', date: '2026-01-01' })],
  );
  assert.equal(r.added, 1);
  assert.deepEqual(r.sessions.map((s) => s.id), ['a', 'b']);
});

test('migrate stamps the current schema version', () => {
  assert.equal(migrate({ schemaVersion: 1, sessions: [] }).schemaVersion, SCHEMA_VERSION);
});

test('meta defaults are filled in for backups that predate a field', () => {
  const r = validateBackup({ format: 'trainingapp-backup', schemaVersion: 1, sessions: [], meta: {} });
  assert.equal(r.ok, true);
  assert.equal(r.data.meta.unit, 'kg');
  assert.equal(r.data.meta.onboarded, false);
});
