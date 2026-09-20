import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLiftSession, resolveRunSession, resolveCoreSession, resolveSession, weekModifier, resolveBlock,
} from '../../src/core/prescribe.js';
import { impliedRpe, e1rm } from '../../src/core/progression.js';
import { program, v2, mkSet } from './_fixtures.mjs';

const noHistory = () => null;
const ctx = (over = {}) => ({ role: 'probe', historyFor: noHistory, coreCompleted: 0, bodyweightKg: 82, ...over });
const setsOf = (session, exerciseId) =>
  session.entries.find((e) => e.exerciseId === exerciseId)?.plannedSets ?? [];
const countSets = (session, exerciseId) => setsOf(session, exerciseId).length;
const MAIN = ['incline-bench', 'ohp', 'weighted-pullup'];

// ---------------------------------------------------------------------------
// Week roles
// ---------------------------------------------------------------------------

test('v3 modifiers are keyed by role, and every role resolves', () => {
  for (const role of ['probe', 'test', 'deload']) {
    const m = weekModifier(program, role);
    assert.equal(m.role, role);
    assert.ok(m.probeRpe > 0);
  }
  assert.equal(weekModifier(program, 'deload').deload, true);
  assert.equal(weekModifier(program, 'nonsense').deload, false, 'unknown roles fall back safely');
});

test('probe RPE is fixed at 8, 9 on the test week, 6 on the deload — nothing climbs week to week', () => {
  // Robinson 2024: strength gain is insensitive to proximity to failure across a
  // wide RIR range, and a rising weekly ceiling clusters load increases on the
  // fatigue-inflated last week (SYNTHESIS §1.3).
  assert.deepEqual(['probe', 'test', 'deload'].map((r) => weekModifier(program, r).probeRpe), [8, 9, 6]);
});

test('v2 modifiers are still served by week number', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((w) => weekModifier(v2, w).topRpe), [7.5, 8, 8.5, 9, 6]);
});

// ---------------------------------------------------------------------------
// Heavy day: probe + reference back-offs
// ---------------------------------------------------------------------------

test('main lifts resolve to a probe plus three back-offs at 80% of reference', () => {
  const s = resolveLiftSession(program, 'lift:A', ctx());
  const sets = setsOf(s, 'incline-bench');
  assert.equal(sets[0].type, 'probe');
  assert.equal(sets[0].rpeTarget, 8);
  assert.equal(sets.filter((x) => x.type === 'backoff').length, 3);
  assert.ok(sets.slice(1).every((x) => x.derivedFromReference && x.pctOfReference === 0.8));
  assert.equal(sets[1].targetRepMin, 4);
  assert.equal(sets[1].targetRepMax, 6);
});

test('with no reference the back-offs are null until the probe is logged', () => {
  const s = resolveLiftSession(program, 'lift:A', ctx());
  assert.equal(setsOf(s, 'incline-bench')[1].weightKg, null);
  assert.match(s.entries[0].suggestion, /reference/i);
});

test('with a reference, back-offs are prefilled at 80% and the probe at the RPE-8 load', () => {
  const rows = [{
    date: '2026-09-01', dayKey: 'lift:A', bodyweightKg: 82, role: 'probe',
    sets: [mkSet({ type: 'probe', weightKg: 85, reps: 4, rpe: 8 })],
  }];
  const lookup = (_id, opts) => (opts?.all ? rows : rows[0]);
  const s = resolveLiftSession(program, 'lift:A', ctx({ historyFor: lookup }));
  const sets = setsOf(s, 'incline-bench');
  const ref = 85 * (1 + 6 / 30); // 102
  assert.equal(s.entries[0].reference.e1rm, 102);
  assert.equal(sets[1].weightKg, 82.5, '102 × 0.8 = 81.6 → 82.5');
  assert.equal(sets[0].weightKg, 85, 'the probe is offered at last time\'s RPE-8 load for 4 reps');
  assert.ok(Math.abs(e1rm(sets[0].weightKg, 4, 8) - ref) < 3);
});

test('every generated back-off set sits inside the RPE 6.5–8.5 band by the app\'s own formula', () => {
  // The reviewer's blocker: 6 reps at 85% is RPE 10.7. At 80% the range 4–6
  // maps to 6.5 → 8.5 exactly, and rounding to a plate moves it by tenths.
  for (const [lift, refs] of [['incline-bench', [60, 82.5, 101.4, 140]], ['ohp', [50, 66.2, 80]], ['weighted-pullup', [95, 110.3, 130]]]) {
    for (const ref of refs) {
      const rows = [{ date: '2026-09-01', dayKey: 'x', bodyweightKg: 82, role: 'probe', sets: [] }];
      // Seed the reference through a probe that produces exactly `ref`.
      const bw = lift === 'weighted-pullup' ? 82 : 0;
      rows[0].sets = [mkSet({ type: 'probe', weightKg: ref / (1 + 6 / 30) - bw, reps: 4, rpe: 8 })];
      const day = lift === 'incline-bench' ? 'lift:A' : lift === 'ohp' ? 'lift:D' : 'lift:C';
      const s = resolveLiftSession(program, day, ctx({ historyFor: (_id, o) => (o?.all ? rows : rows[0]) }));
      const sets = setsOf(s, lift);
      const unrounded = s.entries.find((e) => e.exerciseId === lift).reference.e1rm * 0.8;
      for (const reps of [4, 5, 6]) {
        const ideal = impliedRpe(ref, unrounded, reps);
        assert.ok(ideal >= 6.49 && ideal <= 8.51, `${lift} ${reps} reps @ 80% implies RPE ${ideal}`);
        const actual = impliedRpe(ref, (sets[1].weightKg ?? 0) + bw, reps);
        assert.ok(Math.abs(actual - ideal) <= 0.6, `${lift} ref ${ref}: rounding moved ${reps}-rep RPE to ${actual.toFixed(2)}`);
      }
    }
  }
});

test('pull-up reference and back-offs are computed on system mass, and the belt load is what comes back', () => {
  // 15 kg on the belt at 82 kg, 4 @ RPE 8 → system e1RM 97 × 1.2 = 116.4.
  // 80% of that is 93.1 system → 11.1 on the belt → 11.25.
  const rows = [{ date: '2026-09-01', dayKey: 'lift:C', bodyweightKg: 82, role: 'probe',
    sets: [mkSet({ type: 'probe', weightKg: 15, reps: 4, rpe: 8 })] }];
  const s = resolveLiftSession(program, 'lift:C', ctx({ historyFor: (_id, o) => (o?.all ? rows : rows[0]), bodyweightKg: 82 }));
  const e = s.entries.find((x) => x.exerciseId === 'weighted-pullup');
  assert.ok(Math.abs(e.reference.e1rm - 116.4) < 0.1);
  assert.equal(e.plannedSets[1].weightKg, 11.25);
  // A heavier body at the same reference means less on the belt, not more.
  const heavier = resolveLiftSession(program, 'lift:C', ctx({ historyFor: (_id, o) => (o?.all ? rows : rows[0]), bodyweightKg: 86 }));
  assert.ok(heavier.entries[0].plannedSets[1].weightKg < 11.25);
});

test('the test week asks for one triple at RPE 9; the deload asks for an easy triple and two back-offs', () => {
  const t = resolveLiftSession(program, 'lift:A', ctx({ role: 'test' }));
  const probe = setsOf(t, 'incline-bench')[0];
  assert.equal(probe.rpeTarget, 9);
  assert.equal(probe.targetReps, 3);

  const d = resolveLiftSession(program, 'lift:A', ctx({ role: 'deload' }));
  const sets = setsOf(d, 'incline-bench');
  assert.equal(d.isDeload, true);
  assert.equal(sets[0].rpeTarget, 6);
  assert.equal(sets.filter((x) => x.type === 'backoff').length, 2);
  assert.equal(sets[1].targetReps, 4);
});

test('deload keeps main-lift back-offs at 80% of reference — not 72%', () => {
  // Applying the accessory 0.9 to the main lifts would give 72% for 4 reps,
  // RPE ~2, a warm-up (SYNTHESIS §5.2).
  const rows = [{ date: '2026-09-01', dayKey: 'lift:A', bodyweightKg: 82, role: 'probe',
    sets: [mkSet({ type: 'probe', weightKg: 100, reps: 4, rpe: 8 })] }];
  const lookup = (_id, o) => (o?.all ? rows : rows[0]);
  const probeWeek = setsOf(resolveLiftSession(program, 'lift:A', ctx({ historyFor: lookup })), 'incline-bench')[1].weightKg;
  const deload = setsOf(resolveLiftSession(program, 'lift:A', ctx({ role: 'deload', historyFor: lookup })), 'incline-bench')[1].weightKg;
  assert.equal(deload, probeWeek);
});

test('each main lift gets one heavy (probe) and one volume exposure per week', () => {
  const exposure = {};
  for (const k of program.liftCycle) {
    for (const e of resolveLiftSession(program, k, ctx()).entries) {
      if (!MAIN.includes(e.exerciseId)) continue;
      (exposure[e.exerciseId] ??= []).push(e.scheme);
    }
  }
  for (const lift of MAIN) {
    assert.equal(exposure[lift].filter((x) => x === 'probe_backoff').length, 1, `${lift} needs one heavy day`);
    assert.equal(exposure[lift].filter((x) => x === 'double_progression').length, 1, `${lift} needs one volume day`);
  }
});

test('volume days are 3×6–8 at RPE ≤ 8 (pull-ups 5–8)', () => {
  const push = setsOf(resolveLiftSession(program, 'lift:D', ctx()), 'incline-bench');
  assert.equal(push.length, 3);
  assert.deepEqual([push[0].targetRepMin, push[0].targetRepMax, push[0].rpeTarget], [6, 8, 8]);
  const pull = setsOf(resolveLiftSession(program, 'lift:B', ctx()), 'weighted-pullup');
  assert.deepEqual([pull[0].targetRepMin, pull[0].targetRepMax], [5, 8]);
});

test('heavy and volume exposures of the same lift do not read each other', () => {
  // THE bug this guards, and it is a silent killer: the heavy day must never
  // be handed the volume day's sets or it finds no probe and restarts from
  // nothing; the volume day must never inherit the heavy day's load.
  const heavy = { date: '2026-08-05', dayKey: 'lift:A', bodyweightKg: 82, role: 'probe',
    sets: [mkSet({ type: 'probe', weightKg: 100, reps: 4, rpe: 8 })] };
  const volume = { date: '2026-08-07', dayKey: 'lift:D', bodyweightKg: 82, role: 'probe',
    sets: [mkSet({ type: 'work', weightKg: 70, reps: 8, rpe: 7 })] };
  const all = [volume, heavy]; // newest first
  const lookup = (_id, opts) => {
    let c = all;
    if (opts?.dayKey) c = c.filter((r) => r.dayKey === opts.dayKey);
    return opts?.all ? c : (c[0] ?? null);
  };

  const push = resolveLiftSession(program, 'lift:A', ctx({ historyFor: lookup }));
  assert.equal(push.entries[0].reference.e1rm, 120, 'heavy day reads the heavy probe');
  const delts = resolveLiftSession(program, 'lift:D', ctx({ historyFor: lookup }));
  assert.equal(setsOf(delts, 'incline-bench')[0].weightKg, 72.5, 'volume day builds on the volume session');
});

test('prescribe scopes every history lookup to the current day (or a declared alias)', () => {
  const seen = [];
  resolveLiftSession(program, 'lift:D', ctx({ historyFor: (id, opts) => { seen.push({ id, dayKey: opts?.dayKey }); return null; } }));
  assert.ok(seen.length > 0);
  const aliases = new Set(program.liftDays.D.blocks.map((b) => b.historyAliasDayKey).filter(Boolean));
  for (const s of seen) {
    assert.ok(s.dayKey, `${s.id} was looked up without any day scope`);
    assert.ok(s.dayKey === 'lift:D' || aliases.has(s.dayKey), `${s.id} looked up under ${s.dayKey}`);
  }
});

test('a deload does NOT reset volume-day loads backwards', () => {
  const real = { date: '2026-08-01', sets: [mkSet({ weightKg: 70, reps: 8, rpe: 7 })], bodyweightKg: 82, isDeload: false };
  const deload = { date: '2026-08-20', sets: [mkSet({ weightKg: 62.5, reps: 6, rpe: 5 })], bodyweightKg: 82, isDeload: true };
  const lookup = (_id, opts) => (opts?.all ? [] : opts?.forProgression ? real : deload);
  const next = resolveLiftSession(program, 'lift:D', ctx({ historyFor: lookup }));
  const vol = setsOf(next, 'incline-bench')[0];
  assert.equal(vol.weightKg, 72.5, 'progression builds on the last real session, not the deload');
  assert.equal(next.entries.find((e) => e.exerciseId === 'incline-bench').lastTime, deload, 'the UI still shows the deload factually');
});

test('a 10-rep v2 history on the new 6–8 range moves the load by exactly one increment', () => {
  // Migration dampener (SYNTHESIS Part 8): the first v3 volume session reads a
  // 10-rep history as "above repMax" and may only add one step, never more.
  const old = { date: '2026-09-10', sets: [mkSet({ weightKg: 70, reps: 10, rpe: 8 }), mkSet({ weightKg: 70, reps: 10, rpe: 8 })], bodyweightKg: 82 };
  const s = resolveLiftSession(program, 'lift:D', ctx({ historyFor: (_id, o) => (o?.all ? [] : old) }));
  assert.equal(setsOf(s, 'incline-bench')[0].weightKg, 72.5);
});

// ---------------------------------------------------------------------------
// Accessories: flat volume, last set to failure
// ---------------------------------------------------------------------------

test('accessory volume is flat across the block — no ramp', () => {
  for (const role of ['probe', 'test']) {
    const s = resolveLiftSession(program, 'lift:D', ctx({ role }));
    assert.equal(countSets(s, 'cable-lateral-raise'), 3, `${role}: laterals stay at 3`);
    assert.equal(countSets(s, 'face-pull'), 3);
  }
});

test('the last set of each priority accessory is to failure; the deload and the bonus day never are', () => {
  const s = resolveLiftSession(program, 'lift:A', ctx());
  const lat = setsOf(s, 'cable-lateral-raise');
  assert.equal(lat[lat.length - 1].rpeTarget, 10);
  assert.equal(lat[0].rpeTarget, 9);
  assert.match(s.entries.find((e) => e.exerciseId === 'cable-lateral-raise').label, /last set to 10/);

  const ohpVolume = setsOf(s, 'ohp');
  assert.equal(ohpVolume[ohpVolume.length - 1].rpeTarget, 8, 'main-lift volume day is not an accessory');

  const d = resolveLiftSession(program, 'lift:A', ctx({ role: 'deload' }));
  assert.ok(setsOf(d, 'cable-lateral-raise').every((x) => x.rpeTarget !== 10));

  const e = resolveLiftSession(program, 'lift:E', ctx());
  assert.ok(e.entries.every((en) => en.plannedSets.every((x) => x.rpeTarget !== 10)));
  assert.ok(e.entries.every((en) => en.plannedSets.length === 2), 'bonus day is two sets each');
});

test('weekly direct sets for the priority muscles sit at ~8–10, flat', () => {
  const direct = {};
  for (const k of program.liftCycle) {
    for (const e of resolveLiftSession(program, k, ctx()).entries) {
      const m = e.group === 'core' ? null : ({
        'cable-lateral-raise': 'side-delts', 'machine-lateral-raise': 'side-delts',
        'reverse-pec-deck': 'rear-delts', 'face-pull': 'rear-delts',
        'overhead-cable-tricep': 'triceps', 'rope-pushdown': 'triceps', 'ez-overhead-tricep': 'triceps',
        'bayesian-curl': 'biceps', 'incline-db-curl': 'biceps', 'preacher-curl': 'biceps',
      })[e.exerciseId];
      if (m) direct[m] = (direct[m] ?? 0) + e.plannedSets.length;
    }
  }
  assert.equal(direct['side-delts'], 8);
  assert.equal(direct.triceps, 8);
  assert.equal(direct.biceps, 8);
  assert.equal(direct['rear-delts'], 6);
});

test('the deload halves accessory sets, takes 10% off their load, and never drops a block below one set', () => {
  const rows = { date: '2026-09-01', sets: [mkSet({ weightKg: 20, reps: 15, rpe: 8 }), mkSet({ weightKg: 20, reps: 15, rpe: 8 }), mkSet({ weightKg: 20, reps: 15, rpe: 10 })], bodyweightKg: 82 };
  const lookup = (_id, o) => (o?.all ? [] : rows);
  const w = resolveLiftSession(program, 'lift:D', ctx({ historyFor: lookup }));
  const d = resolveLiftSession(program, 'lift:D', ctx({ role: 'deload', historyFor: lookup }));
  assert.ok(countSets(d, 'cable-lateral-raise') < countSets(w, 'cable-lateral-raise'));
  assert.ok(setsOf(d, 'cable-lateral-raise')[0].weightKg < setsOf(w, 'cable-lateral-raise')[0].weightKg);
  for (const e of d.entries) assert.ok(e.plannedSets.length >= 1, `${e.exerciseId} was zeroed out`);
});

test('the bonus day is only allowed in probe weeks', () => {
  assert.equal(resolveLiftSession(program, 'lift:E', ctx({ role: 'probe' })).allowedThisWeek, true);
  assert.equal(resolveLiftSession(program, 'lift:E', ctx({ role: 'test' })).allowedThisWeek, false);
  assert.equal(resolveLiftSession(program, 'lift:E', ctx({ role: 'deload' })).allowedThisWeek, false);
  assert.equal(resolveLiftSession(program, 'lift:A', ctx({ role: 'test' })).allowedThisWeek, true);
});

// ---------------------------------------------------------------------------
// Legs, race week, core
// ---------------------------------------------------------------------------

test('legs are maintenance: ~10 sets, one unilateral pattern, no leg press or leg curl', () => {
  const b = resolveLiftSession(program, 'lift:B', ctx());
  const legs = b.entries.filter((e) => ['back-squat', 'split-squat', 'rdl', 'calf-raise'].includes(e.exerciseId));
  assert.equal(legs.reduce((n, e) => n + e.plannedSets.length, 0), 10);
  assert.ok(!b.entries.some((e) => ['leg-press', 'leg-curl'].includes(e.exerciseId)));
  assert.equal(b.entries[0].exerciseId, 'weighted-pullup', 'pull-up volume goes first');
});

test('race week halves the leg work and caps it at RPE 6, leaving pull-ups and curls alone', () => {
  const normal = resolveLiftSession(program, 'lift:B', ctx());
  const race = resolveLiftSession(program, 'lift:B', ctx({ raceWeek: 'light' }));
  assert.ok(countSets(race, 'back-squat') < countSets(normal, 'back-squat'));
  assert.equal(setsOf(race, 'back-squat')[0].rpeTarget, 6);
  assert.equal(countSets(race, 'weighted-pullup'), countSets(normal, 'weighted-pullup'));
  assert.equal(countSets(race, 'bayesian-curl'), countSets(normal, 'bayesian-curl'));
  assert.equal(setsOf(race, 'bayesian-curl').at(-1).rpeTarget, 10, 'curls still finish to failure');
  // Upper days are untouched by the race week.
  const a = resolveLiftSession(program, 'lift:A', ctx({ raceWeek: 'light' }));
  assert.equal(countSets(a, 'ohp'), 3);
});

test('core rides at the end of Lower and Push, phased by completed core sessions', () => {
  for (const k of ['lift:B', 'lift:A']) {
    const s = resolveLiftSession(program, k, ctx({ coreCompleted: 0 }));
    const core = s.entries.filter((e) => e.group === 'core');
    assert.equal(core.length, 5, `${k} carries five core moves`);
    assert.ok(s.entries.slice(0, -5).every((e) => e.group !== 'core'), 'core is the tail, not the head');
    assert.equal(s.corePhase, 1);
  }
  for (const k of ['lift:C', 'lift:D', 'lift:E']) {
    assert.ok(!resolveLiftSession(program, k, ctx()).entries.some((e) => e.group === 'core'), `${k} has no core`);
  }
  assert.equal(resolveLiftSession(program, 'lift:B', ctx({ coreCompleted: 8 })).corePhase, 2);
  assert.equal(resolveLiftSession(program, 'lift:B', ctx({ coreCompleted: 16 })).corePhase, 3);
  assert.equal(resolveLiftSession(program, 'lift:B', ctx({ coreCompleted: 500 })).corePhase, 3, 'stays at the top phase');
});

test('core covers the three families plus foot work, with no mat exercises', () => {
  const s = resolveCoreSession(program, 0);
  const fams = new Set(s.entries.map((e) => e.family));
  for (const f of ['anti-extension', 'anti-rotation', 'anti-lateral', 'foot']) assert.ok(fams.has(f), `missing ${f}`);
  for (const mat of ['dead-bug', 'bird-dog', 'front-plank', 'side-plank']) {
    assert.ok(!s.entries.some((e) => e.exerciseId === mat), `${mat} is mat work and was skipped for a reason`);
  }
  assert.ok(s.entries.some((e) => e.plannedSets[0].targetSeconds != null), 'needs a timed hold or carry');
  assert.ok(s.entries.some((e) => e.plannedSets[0].targetReps != null), 'needs rep-based work');
});

test('a loaded carry resolves as weight × seconds', () => {
  const s = resolveCoreSession(program, 0);
  const carry = s.entries.find((e) => e.exerciseId === 'suitcase-carry');
  assert.equal(carry.scheme, 'weight_time');
  assert.equal(carry.plannedSets[0].targetSeconds, 40);
  assert.equal(carry.plannedSets[0].weightKg, null, 'load is chosen on the day when there is no history');
});

test('resolveBlock can re-resolve one block for a substitute exercise against its own history', () => {
  const block = program.liftDays.A.blocks.find((b) => b.exerciseId === 'cable-lateral-raise');
  const dbHistory = { date: '2026-09-01', sets: [mkSet({ weightKg: 10, reps: 15, rpe: 8 }), mkSet({ weightKg: 10, reps: 15, rpe: 8 }), mkSet({ weightKg: 10, reps: 15, rpe: 10 })], bodyweightKg: 82 };
  const historyFor = (id, o) => (id === 'db-lateral-raise' && !o?.all ? dbHistory : o?.all ? [] : null);
  const e = resolveBlock(program, block, { dayKey: 'lift:A', mod: weekModifier(program, 'probe'), day: program.liftDays.A, historyFor, order: 2 }, { exerciseId: 'db-lateral-raise' });
  assert.equal(e.exerciseId, 'db-lateral-raise');
  assert.equal(e.swappedFrom, 'cable-lateral-raise');
  assert.equal(e.plannedSets.length, 3, 'the block\'s scheme is kept');
  assert.equal(e.plannedSets[0].weightKg, 11, 'the substitute progresses on its own history, in its own increment');
  assert.equal(e.plannedSets.at(-1).rpeTarget, 10);
});

// ---------------------------------------------------------------------------
// Running
// ---------------------------------------------------------------------------

test('run weeks 1-4 are time-based; long runs are distance-based from week 5, easy runs stay 30 min', () => {
  assert.equal(resolveRunSession(program, 'long', 4).target.kind, 'time');
  assert.equal(resolveRunSession(program, 'long', 5).target.km, 5.5);
  for (let w = 5; w <= 15; w++) assert.equal(resolveRunSession(program, 'easy', w).target.minutes, 30);
});

test('the run plan reaches exactly 10 km at week 15, the goal', () => {
  const goal = resolveRunSession(program, 'long', 15);
  assert.equal(goal.target.km, 10);
  assert.equal(goal.isGoal, true);
});

test('no long run steps up by more than 10% of the longest so far — the injury rail', () => {
  // Frandsen 2025: > 10% over the 30-day longest, HRR 1.64. Down weeks step back.
  const distances = program.runPlan.filter((w) => w.long.kind === 'distance');
  let longest = 0;
  for (const w of distances) {
    if (longest > 0 && w.long.km > longest) {
      const ratio = w.long.km / longest;
      assert.ok(ratio <= 1.10001, `week ${w.week}: ${w.long.km} km is ${(ratio * 100).toFixed(0)}% of ${longest} km`);
    }
    longest = Math.max(longest, w.long.km);
  }
});

test('no weekly total rises by more than 20% over the previous week (at ~5 km of easy running)', () => {
  const easyKm = 4.5; // 30 min at ~9 km/h
  let prev = null;
  for (const w of program.runPlan) {
    if (w.long.kind !== 'distance') continue;
    const total = easyKm + w.long.km;
    if (prev != null) assert.ok(total / prev <= 1.2001, `week ${w.week}: ${total} vs ${prev}`);
    prev = total;
  }
});

test('the run plan has a down week every fourth week, and the 5.5 km rung is the next step from a 5 km base', () => {
  assert.deepEqual(program.runPlan.filter((w) => w.down).map((w) => w.week), [4, 8, 12]);
  assert.equal(program.runPlan[4].long.km, 5.5);
  assert.ok(5.5 / 5.25 <= 1.1, 'inside 10% of a 5.25 km longest');
});

test('post-10K maintenance is one 7–8 km easy run and one 4–5 km with strides', () => {
  const long = resolveRunSession(program, 'long', 20);
  const easy = resolveRunSession(program, 'easy', 20);
  assert.equal(long.beyondPlan, true);
  assert.equal(long.target.km, 7.5);
  assert.equal(easy.target.km, 4.5);
  assert.match(easy.label, /strides/);
});

test('down weeks are flagged so the UI can say why it got easier', () => {
  assert.equal(resolveRunSession(program, 'long', 8).isDown, true);
  assert.match(resolveRunSession(program, 'long', 8).note, /Down week/);
});

// ---------------------------------------------------------------------------
// Dispatch and catalogue
// ---------------------------------------------------------------------------

test('resolveSession dispatches on the slot key', () => {
  const c = { role: 'probe', runWeek: 1, coreCompleted: 0, historyFor: noHistory };
  assert.equal(resolveSession(program, 'lift:A', c).kind, 'lift');
  assert.equal(resolveSession(program, 'run:long', c).kind, 'run');
  assert.equal(resolveSession(program, 'core', c).kind, 'core');
  assert.throws(() => resolveSession(program, 'nonsense', c), /Unknown session key/);
});

test('unknown lift day throws rather than silently prescribing nothing', () => {
  assert.throws(() => resolveLiftSession(program, 'lift:Z', ctx()), /Unknown lift day/);
});

test('the v2 program still resolves through the same engine (old snapshots and the entry rule depend on it)', () => {
  const s = resolveLiftSession(v2, 'lift:A', 3, noHistory);
  assert.equal(s.entries[0].scheme, 'top_backoff');
  assert.equal(s.entries[0].plannedSets[0].rpeTarget, 8.5);
});

test('every programmed exercise exists in the catalog, and every alternative points at a real exercise', async () => {
  const { EXERCISES } = await import('../../src/program/exercises.js');
  const ids = new Set();
  for (const day of Object.values(program.liftDays)) for (const b of day.blocks) ids.add(b.exerciseId);
  for (const p of program.core.phases) for (const b of p.blocks) ids.add(b.exerciseId);
  for (const id of ids) assert.ok(EXERCISES[id], `${id} is prescribed but not defined in exercises.js`);
  for (const ex of Object.values(EXERCISES)) {
    for (const alt of ex.alternatives) assert.ok(EXERCISES[alt], `${ex.id} lists unknown alternative ${alt}`);
  }
});
