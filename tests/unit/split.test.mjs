import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  muscleLoad, musclesWorked, sharedMuscles, overlapWarning,
} from '../../src/core/schedule.js';
import { resolveLiftSession } from '../../src/core/prescribe.js';
import { program, mkSet } from './_fixtures.mjs';

/**
 * Rear delts are the one permitted adjacency: reverse-pec-deck into face-pull,
 * both light isolation on small muscles that recover fast. Everything else must
 * be clean, and this allowlist is deliberately narrow so that widening it is a
 * conscious act rather than a side effect.
 */
const ALLOWED_ADJACENT_OVERLAP = new Set(['rear-delts']);

test('NO two consecutive days in the cycle share a hard-trained muscle', () => {
  // The invariant the whole restructure exists to hold. If someone later
  // reorders liftCycle or moves an exercise between days, this fails loudly
  // instead of quietly reintroducing back-to-back pull-ups.
  const cycle = program.liftCycle;
  for (let i = 0; i < cycle.length; i++) {
    const a = cycle[i];
    const b = cycle[(i + 1) % cycle.length]; // includes the wrap — the 24h gap
    const shared = sharedMuscles(program, a, b);
    const illegal = shared.filter((m) => !ALLOWED_ADJACENT_OVERLAP.has(m));
    assert.deepEqual(illegal, [], `${a} → ${b} repeats ${illegal.join(', ')}`);
  }
});

test('the wrap-around pair is clean — it is the tightest gap in the week', () => {
  // Template is Mon/Wed/Fri/Sun, so day 4 → day 1 is only ~24h. Every other
  // adjacency gets 48h.
  const cycle = program.liftCycle;
  assert.deepEqual(sharedMuscles(program, cycle[cycle.length - 1], cycle[0]), []);
});

test('pull-ups and biceps never land on adjacent days', () => {
  const cycle = program.liftCycle;
  const pulls = cycle.filter((k) => muscleLoad(program, k).back >= 3);
  const curls = cycle.filter((k) => muscleLoad(program, k).biceps >= 3);
  for (const group of [pulls, curls]) {
    for (const a of group) {
      for (const b of group) {
        if (a === b) continue;
        const gap = Math.abs(cycle.indexOf(a) - cycle.indexOf(b));
        const cyclic = Math.min(gap, cycle.length - gap);
        assert.ok(cyclic > 1, `${a} and ${b} are adjacent in the cycle`);
      }
    }
  }
});

test('priority muscles keep their weekly volume after the restructure', () => {
  const weekly = {};
  for (const k of program.liftCycle) {
    for (const [m, sets] of Object.entries(muscleLoad(program, k))) {
      weekly[m] = (weekly[m] ?? 0) + sets;
    }
  }
  // Shoulders and arms are the stated hypertrophy priority.
  assert.ok(weekly['side-delts'] >= 12, `side delts ${weekly['side-delts']}`);
  assert.ok(weekly['rear-delts'] >= 8, `rear delts ${weekly['rear-delts']}`);
  assert.ok(weekly.triceps >= 12, `triceps ${weekly.triceps}`);
  assert.ok(weekly.biceps >= 12, `biceps ${weekly.biceps}`);
});

test('every main lift still gets a heavy and a volume exposure', () => {
  const seen = {};
  for (const k of program.liftCycle) {
    for (const e of resolveLiftSession(program, k, 1, () => null).entries) {
      if (!['incline-bench', 'ohp', 'weighted-pullup'].includes(e.exerciseId)) continue;
      (seen[e.exerciseId] ??= []).push(e.scheme);
    }
  }
  for (const lift of ['incline-bench', 'ohp', 'weighted-pullup']) {
    assert.equal(seen[lift].filter((x) => x === 'top_backoff').length, 1, `${lift} heavy`);
    assert.equal(seen[lift].filter((x) => x === 'double_progression').length, 1, `${lift} volume`);
  }
});

test('musclesWorked ignores incidental single sets', () => {
  const worked = musclesWorked(program, 'lift:B');
  assert.ok(worked.has('quads'));
  assert.ok(!worked.has('calves'), '2 sets of calves is not a training stimulus worth scheduling around');
});

// ---------------------------------------------------------------------------
// overlapWarning
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-20T18:00:00Z').getTime();
const doneAt = (hoursAgo, dayKey) => ({
  id: `s-${dayKey}-${hoursAgo}`,
  kind: 'lift',
  status: 'completed',
  dayKey,
  completedAt: new Date(NOW - hoursAgo * 3_600_000).toISOString(),
});

test('warns when the next session repeats what was trained yesterday', () => {
  // Force the collision the restructure normally prevents: Upper Pull yesterday,
  // then a day that also hits back and biceps.
  const w = overlapWarning([doneAt(18, 'lift:C')], program, 'lift:B', { now: NOW });
  assert.ok(w, 'lift:B carries pull-up volume and curls — that is a real repeat');
  assert.deepEqual(w.muscles, ['back', 'biceps']);
  assert.equal(w.since.dayKey, 'lift:C');
  assert.equal(w.hoursAgo, 18);
});

test('suggests a day that collides with neither', () => {
  const w = overlapWarning([doneAt(12, 'lift:C')], program, 'lift:B', { now: NOW });
  assert.ok(w.suggestion);
  assert.deepEqual(sharedMuscles(program, w.suggestion, 'lift:C'), [],
    'the suggested day must not repeat yesterday either');
});

test('stays silent for the program as actually designed', () => {
  // Every legitimate consecutive pairing in the cycle must pass without nagging.
  const cycle = program.liftCycle;
  for (let i = 0; i < cycle.length; i++) {
    const prev = cycle[i];
    const next = cycle[(i + 1) % cycle.length];
    const w = overlapWarning([doneAt(20, prev)], program, next, { now: NOW });
    assert.equal(w, null, `${prev} → ${next} should not warn`);
  }
});

test('stays silent once the session is old enough', () => {
  assert.equal(overlapWarning([doneAt(30, 'lift:C')], program, 'lift:B', { now: NOW }), null);
});

test('repeating the same day is a choice, not an accident, so it is not flagged', () => {
  assert.equal(overlapWarning([doneAt(10, 'lift:C')], program, 'lift:C', { now: NOW }), null);
});

test('skipped and in-progress sessions do not trigger a warning', () => {
  const skipped = { ...doneAt(10, 'lift:C'), status: 'skipped' };
  const running = { ...doneAt(10, 'lift:C'), status: 'in_progress' };
  assert.equal(overlapWarning([skipped, running], program, 'lift:B', { now: NOW }), null);
});

test('runs and core never trigger a lift overlap warning', () => {
  assert.equal(overlapWarning([], program, 'run:long', { now: NOW }), null);
  assert.equal(overlapWarning([], program, 'core', { now: NOW }), null);
});

// ---------------------------------------------------------------------------
// historyAliasDayKey — the migration hatch
// ---------------------------------------------------------------------------

test('a moved exercise inherits the history from the day it came from', () => {
  // Incline volume moved lift:C → lift:D. Without the alias the day-scoped
  // lookup finds nothing and restarts the lift from zero.
  const old = {
    date: '2026-08-01',
    dayKey: 'lift:C',
    sets: [mkSet({ weightKg: 70, reps: 12, rpe: 7, type: 'work' })],
    bodyweightKg: 80,
  };
  const lookup = (_id, opts) => (opts?.dayKey === 'lift:C' ? old : null);

  const d = resolveLiftSession(program, 'lift:D', 1, lookup);
  const incline = d.entries.find((e) => e.exerciseId === 'incline-bench');
  assert.equal(incline.plannedSets[0].weightKg, 72.5, 'progression continues from the old day');
});

test('the alias is ignored the moment real history exists on the new day', () => {
  const onOldDay = {
    date: '2026-08-01', dayKey: 'lift:C',
    sets: [mkSet({ weightKg: 70, reps: 12, rpe: 7, type: 'work' })], bodyweightKg: 80,
  };
  const onNewDay = {
    date: '2026-08-15', dayKey: 'lift:D',
    sets: [mkSet({ weightKg: 80, reps: 12, rpe: 7, type: 'work' })], bodyweightKg: 80,
  };
  const lookup = (_id, opts) => (opts?.dayKey === 'lift:D' ? onNewDay : onOldDay);

  const d = resolveLiftSession(program, 'lift:D', 1, lookup);
  const incline = d.entries.find((e) => e.exerciseId === 'incline-bench');
  assert.equal(incline.plannedSets[0].weightKg, 82.5, 'builds on the new day, not the alias');
});

test('blocks without an alias never look outside their own day', () => {
  const seen = [];
  resolveLiftSession(program, 'lift:C', 1, (id, opts) => {
    seen.push({ id, dayKey: opts?.dayKey });
    return null;
  });
  const aliased = new Set(
    program.liftDays.C.blocks.filter((b) => b.historyAliasDayKey).map((b) => b.exerciseId),
  );
  for (const s of seen) {
    if (aliased.has(s.id)) continue;
    assert.equal(s.dayKey, 'lift:C', `${s.id} escaped its day scope`);
  }
});

test('every declared alias points at a day that exists', () => {
  for (const day of Object.values(program.liftDays)) {
    for (const b of day.blocks) {
      if (!b.historyAliasDayKey) continue;
      const letter = b.historyAliasDayKey.split(':')[1];
      assert.ok(program.liftDays[letter], `${b.exerciseId} aliases missing day ${b.historyAliasDayKey}`);
    }
  }
});
