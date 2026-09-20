import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRunSpike, runLoadWarnings, SPIKE_LIMIT, WEEKLY_JUMP_LIMIT } from '../../src/core/progression.js';
import { mkSession } from './_fixtures.mjs';

const run = (date, km, o = {}) => mkSession({ kind: 'run', date, status: 'completed', run: { distanceKm: km, durationSec: km * 400 }, ...o });

test('the spike rail sits at 10%, and the copy says "associated with", not "the main driver"', () => {
  assert.equal(SPIKE_LIMIT, 1.10);
  assert.equal(checkRunSpike(5.5, 5.0).ok, true, '5.5 from 5.0 is exactly 10%');
  const r = checkRunSpike(6.0, 5.0);
  assert.equal(r.ok, false);
  assert.match(r.message, /associated with more injuries/);
  assert.doesNotMatch(r.message, /main driver/);
  assert.match(r.message, /5\.5 km keeps you inside/);
});

test('a previous injury hardens the copy to a stop', () => {
  assert.match(checkRunSpike(6.5, 5.0, { priorInjury: true }).message, /treat this as a stop/);
  assert.doesNotMatch(checkRunSpike(6.5, 5.0).message, /stop/);
});

test('runLoadWarnings flags a single-run spike against the 30-day longest, ignoring the run being judged', () => {
  const sessions = [run('2026-09-05', 5.0), run('2026-09-12', 5.25), run('2026-06-01', 12)];
  assert.deepEqual(runLoadWarnings(sessions, { km: 5.5, date: '2026-09-19' }, { today: '2026-09-19' }), []);
  const w = runLoadWarnings(sessions, { km: 6.5, date: '2026-09-19' }, { today: '2026-09-19' });
  assert.equal(w.length, 1);
  assert.equal(w[0].kind, 'spike');
  // The same run already in the log must not be its own comparison.
  const logged = run('2026-09-19', 6.5, { id: 'me' });
  const w2 = runLoadWarnings([...sessions, logged], { km: 6.5, date: '2026-09-19', sessionId: 'me' }, { today: '2026-09-19' });
  assert.equal(w2.length, 1);
});

test('runLoadWarnings flags a weekly total more than 30% over last week', () => {
  assert.equal(WEEKLY_JUMP_LIMIT, 1.30);
  const sessions = [run('2026-09-08', 4.5), run('2026-09-12', 5.5), run('2026-09-15', 4.5)]; // last week 10, this week 4.5
  // A 5.5 long run → 10.0 this week: flat. A 9.0 long run → 13.5: +35%, and also a spike.
  assert.deepEqual(runLoadWarnings(sessions, { km: 5.5, date: '2026-09-19' }, { today: '2026-09-19' }), []);
  const kinds = runLoadWarnings(sessions, { km: 9.0, date: '2026-09-19' }, { today: '2026-09-19' }).map((w) => w.kind);
  assert.deepEqual(kinds, ['spike', 'weekly']);
});

test('no history → no warnings', () => {
  assert.deepEqual(runLoadWarnings([], { km: 10, date: '2026-09-19' }, { today: '2026-09-19' }), []);
});
