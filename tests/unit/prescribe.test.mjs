import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLiftSession, resolveRunSession, resolveCoreSession, resolveSession, weekModifier,
} from '../../src/core/prescribe.js';
import { program, mkSet } from './_fixtures.mjs';

const noHistory = () => null;
const setsOf = (session, exerciseId) =>
  session.entries.find((e) => e.exerciseId === exerciseId)?.plannedSets ?? [];
const countSets = (session, exerciseId) => setsOf(session, exerciseId).length;

test('week modifiers cover every week of the mesocycle', () => {
  for (let w = 1; w <= program.mesocycleWeeks; w++) {
    const m = weekModifier(program, w);
    assert.equal(m.week, w);
    assert.ok(m.topRpe > 0);
  }
  assert.equal(weekModifier(program, 5).deload, true);
  assert.equal(weekModifier(program, 99).deload, false, 'unknown weeks fall back safely');
});

test('top-set RPE climbs across the block then drops for the deload', () => {
  const rpes = [1, 2, 3, 4, 5].map((w) => weekModifier(program, w).topRpe);
  assert.deepEqual(rpes, [7.5, 8, 8.5, 9, 6]);
});

test('main lifts resolve to a top set plus back-offs', () => {
  const s = resolveLiftSession(program, 'lift:A', 1, noHistory);
  const sets = setsOf(s, 'incline-bench');
  assert.equal(sets[0].type, 'top');
  assert.equal(sets.filter((x) => x.type === 'backoff').length, 3);
  assert.equal(sets[0].rpeTarget, 7.5);
});

test('each main lift gets one heavy and one volume exposure per week', () => {
  const days = ['lift:A', 'lift:B', 'lift:C', 'lift:D'].map((k) =>
    resolveLiftSession(program, k, 1, noHistory),
  );
  const exposure = {};
  for (const day of days) {
    for (const e of day.entries) {
      if (!['incline-bench', 'ohp', 'weighted-pullup'].includes(e.exerciseId)) continue;
      exposure[e.exerciseId] ??= [];
      exposure[e.exerciseId].push(e.scheme);
    }
  }
  for (const lift of ['incline-bench', 'ohp', 'weighted-pullup']) {
    const schemes = exposure[lift] ?? [];
    assert.equal(schemes.length, 2, `${lift} should appear exactly twice a week`);
    assert.equal(schemes.filter((x) => x === 'top_backoff').length, 1, `${lift} needs one heavy day`);
    assert.equal(schemes.filter((x) => x === 'double_progression').length, 1, `${lift} needs one volume day`);
  }
});

test('the second incline exposure is the barbell lift itself, not a variation', () => {
  // Incline bench is a named strength goal, so exposure #2 has to be specific to
  // the lift we are adding weight to. It lives on Shoulders & Arms rather than
  // Upper Pull so that chest work never lands on two adjacent days.
  const d = resolveLiftSession(program, 'lift:D', 1, noHistory);
  const incline = d.entries.find((e) => e.exerciseId === 'incline-bench');
  assert.ok(incline, 'Shoulders & Arms should carry the incline volume exposure');
  assert.equal(incline.scheme, 'double_progression');

  const c = resolveLiftSession(program, 'lift:C', 1, noHistory);
  assert.ok(
    !c.entries.some((e) => e.exerciseId === 'incline-bench'),
    'Upper Pull must not press — it neighbours the Shoulders & Arms day',
  );
});

test('heavy and volume exposures of the same lift do not read each other', () => {
  // THE bug this guards, and it is a silent killer: incline bench is heavy
  // (top set + back-offs) on Upper Push and volume (3x8-12) on Shoulders & Arms. If
  // "last time" just returns the most recent session containing the exercise,
  // the heavy day frequently gets handed the volume day's sets, finds no set of
  // type 'top', concludes it has never been done, and restarts from nothing.
  // Result: none of the three main lifts ever add weight — the entire point of
  // the program fails, and nothing visibly breaks while it does.
  const heavyDay = {
    date: '2026-08-05',
    dayKey: 'lift:A',
    sets: [mkSet({ weightKg: 100, reps: 6, rpe: 7, type: 'top' })],
    bodyweightKg: 80,
  };
  const volumeDay = {
    date: '2026-08-07', // more recent
    dayKey: 'lift:D',
    sets: [mkSet({ weightKg: 70, reps: 12, rpe: 7, type: 'work' })],
    bodyweightKg: 80,
  };
  const all = [volumeDay, heavyDay]; // newest first

  const lookup = (_id, opts) => {
    let c = all;
    if (opts?.dayKey) c = c.filter((r) => r.dayKey === opts.dayKey);
    return c[0] ?? null;
  };

  const push = resolveLiftSession(program, 'lift:A', 1, lookup);
  const top = setsOf(push, 'incline-bench')[0];
  assert.equal(top.type, 'top');
  assert.equal(top.weightKg, 102.5, 'heavy day must build on the last HEAVY session, not the volume one');

  const delts = resolveLiftSession(program, 'lift:D', 1, lookup);
  const volume = setsOf(delts, 'incline-bench')[0];
  assert.equal(volume.weightKg, 72.5, 'volume day must build on the last VOLUME session, not the heavy one');
});

test('prescribe scopes its history lookups to the current day', () => {
  const seen = [];
  resolveLiftSession(program, 'lift:D', 1, (id, opts) => {
    seen.push({ id, dayKey: opts?.dayKey });
    return null;
  });
  assert.ok(seen.length > 0);

  // Every lookup must be day-scoped. The only dayKey other than the current one
  // that may appear is a migration alias the block explicitly declares.
  const aliases = new Set(
    program.liftDays.D.blocks.map((b) => b.historyAliasDayKey).filter(Boolean),
  );
  for (const s of seen) {
    assert.ok(s.dayKey, `${s.id} was looked up without any day scope`);
    assert.ok(
      s.dayKey === 'lift:D' || aliases.has(s.dayKey),
      `${s.id} was looked up under an undeclared day scope ${s.dayKey}`,
    );
  }
});

test('a deload does NOT reset working loads backwards', () => {
  // The bug this guards: after a deload, "last time" is the deliberately-light
  // deload session. Naive progression reads that as an easy session, bumps it a
  // notch, and prescribes ~15% under what was actually being lifted — every block.
  const real = {
    date: '2026-08-01',
    sets: [mkSet({ weightKg: 100, reps: 6, rpe: 7, type: 'top' })],
    bodyweightKg: 80,
    isDeload: false,
  };
  const deload = {
    date: '2026-08-20',
    sets: [mkSet({ weightKg: 87.5, reps: 6, rpe: 5, type: 'top' })],
    bodyweightKg: 80,
    isDeload: true,
  };

  const lookup = (_id, opts) => (opts?.forProgression ? real : deload);
  const next = resolveLiftSession(program, 'lift:A', 1, lookup);
  const top = setsOf(next, 'incline-bench')[0];

  assert.equal(top.weightKg, 102.5, 'progression builds on the last real session, not the deload');
  assert.ok(top.weightKg > 100, 'and must never come back under the pre-deload load');

  // The UI still shows the deload factually — only progression ignores it.
  assert.equal(next.entries[0].lastTime, deload);
});

test('deload week judges the previous session against accumulation RPE, not its own', () => {
  // Deload prescribes RPE ~6; if that were the bar the last session had to clear,
  // every deload would freeze progression permanently.
  const history = () => ({
    date: '2026-08-01',
    sets: [mkSet({ weightKg: 100, reps: 6, rpe: 8, type: 'top' })],
    bodyweightKg: 80,
    isDeload: false,
  });
  const w5 = resolveLiftSession(program, 'lift:A', 5, history);
  assert.equal(setsOf(w5, 'incline-bench')[0].weightKg, 87.5, '102.5 x 0.85 = 87.1 → 87.5');
});

test('ramped accessories add sets across the block; non-ramped ones do not', () => {
  const w1 = resolveLiftSession(program, 'lift:D', 1, noHistory);
  const w4 = resolveLiftSession(program, 'lift:D', 4, noHistory);
  assert.equal(countSets(w1, 'cable-lateral-raise'), 3);
  assert.equal(countSets(w4, 'cable-lateral-raise'), 5, 'week 4 adds two sets');

  const lowerW1 = resolveLiftSession(program, 'lift:B', 1, noHistory);
  const lowerW4 = resolveLiftSession(program, 'lift:B', 4, noHistory);
  assert.equal(
    countSets(lowerW1, 'back-squat'),
    countSets(lowerW4, 'back-squat'),
    'legs are maintenance work and do not ramp',
  );
});

test('weekly side-delt volume climbs 8 → 14 sets and stays inside the MAV band', () => {
  const sideDelt = ['cable-lateral-raise', 'machine-lateral-raise'];
  const weekly = (w) =>
    ['lift:A', 'lift:B', 'lift:C', 'lift:D']
      .map((k) => resolveLiftSession(program, k, w, noHistory))
      .reduce(
        (sum, day) =>
          sum + day.entries.filter((e) => sideDelt.includes(e.exerciseId))
            .reduce((n, e) => n + e.plannedSets.length, 0),
        0,
      );

  assert.equal(weekly(1), 8, 'week 1 sits at RP MEV for side delts');
  assert.equal(weekly(4), 14, 'week 4 peaks well inside MAV (8–24)');
  assert.ok(weekly(4) < 24, 'never approaches MRV');
});

test('deload halves the sets and cuts the load', () => {
  const w4 = resolveLiftSession(program, 'lift:D', 4, noHistory);
  const w5 = resolveLiftSession(program, 'lift:D', 5, noHistory);
  assert.equal(w5.isDeload, true);
  assert.ok(
    countSets(w5, 'cable-lateral-raise') < countSets(w4, 'cable-lateral-raise'),
    'deload cuts accessory volume',
  );
  assert.equal(setsOf(w5, 'ohp')[0].rpeTarget, 6, 'and drops the top-set RPE');
});

test('deload never drops a block below one set', () => {
  const w5 = resolveLiftSession(program, 'lift:D', 5, noHistory);
  for (const e of w5.entries) {
    assert.ok(e.plannedSets.length >= 1, `${e.exerciseId} was zeroed out`);
  }
});

test('deload scales the prescribed load below the accumulation weeks', () => {
  const history = () => ({
    date: '2026-08-01',
    sets: [mkSet({ weightKg: 100, reps: 6, rpe: 7, type: 'top' })],
    bodyweightKg: 80,
  });
  const top4 = setsOf(resolveLiftSession(program, 'lift:A', 4, history), 'incline-bench')[0].weightKg;
  const top5 = setsOf(resolveLiftSession(program, 'lift:A', 5, history), 'incline-bench')[0].weightKg;
  assert.ok(top5 < top4, `deload load ${top5} should be under ${top4}`);
});

test('back-off loads are derived from the top set', () => {
  const history = () => ({
    date: '2026-08-01',
    sets: [mkSet({ weightKg: 80, reps: 6, rpe: 7, type: 'top' })],
    bodyweightKg: 80,
  });
  const s = resolveLiftSession(program, 'lift:A', 1, history);
  const sets = setsOf(s, 'incline-bench');
  assert.equal(sets[0].weightKg, 82.5, 'top set progressed');
  assert.equal(sets[1].weightKg, 70, '82.5 x 0.85 = 70.1 → 70');
  assert.equal(sets[1].derivedFromTop, true, 'and stays live for recalculation');
});

test('back-offs are null until a top set exists', () => {
  const s = resolveLiftSession(program, 'lift:A', 1, noHistory);
  assert.equal(setsOf(s, 'incline-bench')[1].weightKg, null);
});

test('prescriptions carry last time through for the UI', () => {
  const last = { date: '2026-08-01', sets: [mkSet({ weightKg: 50, reps: 12, rpe: 8 })], bodyweightKg: 80 };
  const s = resolveLiftSession(program, 'lift:A', 1, () => last);
  assert.equal(s.entries[0].lastTime, last);
});

test('unknown lift day throws rather than silently prescribing nothing', () => {
  assert.throws(() => resolveLiftSession(program, 'lift:Z', 1, noHistory), /Unknown lift day/);
});

test('run weeks 1-4 are time-based, 5+ are distance-based', () => {
  assert.equal(resolveRunSession(program, 'long', 1).target.kind, 'time');
  assert.equal(resolveRunSession(program, 'long', 4).target.kind, 'time');
  assert.equal(resolveRunSession(program, 'long', 5).target.kind, 'distance');
});

test('the run plan reaches exactly 10km at week 14', () => {
  const goal = resolveRunSession(program, 'long', 14);
  assert.equal(goal.target.km, 10);
  assert.equal(goal.isGoal, true);
});

test('no long run exceeds 110% of the previous longest — the injury rail', () => {
  // Aarhus/BJSM 2025: single-session distance spikes drive injury risk far more
  // than weekly mileage. Down weeks are exempt since they step backwards.
  const distances = program.runPlan.filter((w) => w.long.kind === 'distance');
  let longestSoFar = 0;
  for (const w of distances) {
    const km = w.long.km;
    if (longestSoFar > 0 && km > longestSoFar) {
      const ratio = km / longestSoFar;
      assert.ok(ratio <= 1.10001, `week ${w.week}: ${km}km is ${(ratio * 100).toFixed(0)}% of ${longestSoFar}km`);
    }
    longestSoFar = Math.max(longestSoFar, km);
  }
});

test('the run plan has a down week every fourth week', () => {
  assert.deepEqual(program.runPlan.filter((w) => w.down).map((w) => w.week), [4, 8, 12]);
});

test('running past week 14 holds at maintenance rather than escalating', () => {
  const s = resolveRunSession(program, 'long', 20);
  assert.equal(s.beyondPlan, true);
  assert.equal(s.target.km, 10);
});

test('down weeks are flagged so the UI can say why it got easier', () => {
  assert.equal(resolveRunSession(program, 'long', 8).isDown, true);
  assert.match(resolveRunSession(program, 'long', 8).note, /Down week/);
});

test('core phases advance on completed sessions', () => {
  assert.equal(resolveCoreSession(program, 0).phase, 1);
  assert.equal(resolveCoreSession(program, 11).phase, 1);
  assert.equal(resolveCoreSession(program, 12).phase, 2);
  assert.equal(resolveCoreSession(program, 27).phase, 3);
  assert.equal(resolveCoreSession(program, 500).phase, 3, 'stays at the top phase');
});

test('phase 1 core is McGill Big 3 only — no loaded spinal flexion', () => {
  const s = resolveCoreSession(program, 0);
  const ids = s.entries.map((e) => e.exerciseId);
  for (const loaded of ['cable-crunch', 'ab-wheel', 'hanging-leg-raise', 'weighted-plank']) {
    assert.ok(!ids.includes(loaded), `${loaded} must not appear before bracing endurance is built`);
  }
  assert.ok(ids.includes('dead-bug') && ids.includes('bird-dog') && ids.includes('side-plank'));
});

test('core mixes time-based holds and rep-based work', () => {
  const s = resolveCoreSession(program, 12);
  assert.ok(s.entries.some((e) => e.plannedSets[0].targetSeconds != null), 'needs a timed hold');
  assert.ok(s.entries.some((e) => e.plannedSets[0].targetReps != null), 'needs a rep-based movement');
});

test('resolveSession dispatches on the slot key', () => {
  const ctx = { weekInMeso: 1, runWeek: 1, coreCompleted: 0, historyFor: noHistory };
  assert.equal(resolveSession(program, 'lift:A', ctx).kind, 'lift');
  assert.equal(resolveSession(program, 'run:long', ctx).kind, 'run');
  assert.equal(resolveSession(program, 'core', ctx).kind, 'core');
  assert.throws(() => resolveSession(program, 'nonsense', ctx), /Unknown session key/);
});

test('every programmed exercise exists in the catalog', async () => {
  const { EXERCISES } = await import('../../src/program/exercises.js');
  const ids = new Set();
  for (const day of Object.values(program.liftDays)) for (const b of day.blocks) ids.add(b.exerciseId);
  for (const p of program.corePhases) for (const b of p.blocks) ids.add(b.exerciseId);
  for (const id of ids) {
    assert.ok(EXERCISES[id], `${id} is prescribed but not defined in exercises.js`);
  }
});
