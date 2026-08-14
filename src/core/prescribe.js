/**
 * Turns (program, dayKey, mesocycle week, training history) into a concrete
 * session you can actually walk into the gym and execute. DOM-free, pure.
 *
 * The output of this module gets frozen onto every logged session as
 * `prescriptionSnapshot`. That is what lets program.v1.js be edited freely
 * forever without rewriting what past sessions said to do.
 */

import { getExercise } from '../program/exercises.js';
import {
  suggestDoubleProgression,
  suggestTopSet,
  backoffLoad,
  roundToIncrement,
} from './progression.js';

/** Week modifier for a mesocycle week, with safe defaults. */
export function weekModifier(program, weekInMeso) {
  const m = program.weekModifiers.find((w) => w.week === weekInMeso);
  return {
    week: weekInMeso,
    setDelta: 0,
    topRpe: 8,
    setMultiplier: 1,
    loadMultiplier: 1,
    deload: false,
    note: '',
    ...(m ?? {}),
  };
}

/** Set count for a block after ramp + deload modulation. Always at least 1. */
function setCountFor(block, mod) {
  const ramped = (block.sets ?? 1) + (block.ramp ? mod.setDelta : 0);
  const scaled = Math.round(ramped * (mod.setMultiplier ?? 1));
  return Math.max(1, scaled);
}

/**
 * Resolve one lift day.
 * @param historyFor (exerciseId) => {date, sets, bodyweightKg} | null
 */
export function resolveLiftSession(program, dayKey, weekInMeso, historyFor) {
  const letter = dayKey.split(':')[1];
  const day = program.liftDays[letter];
  if (!day) throw new Error(`Unknown lift day: ${dayKey}`);

  const mod = weekModifier(program, weekInMeso);

  /**
   * The RPE bar a previous top set had to clear to earn a load increase.
   *
   * On a deload we deliberately train at RPE ~6, but that must NOT become the
   * standard the last real session is judged against — otherwise every deload
   * freezes progression. Judge against the hardest accumulation week instead,
   * then let loadMultiplier do the actual deloading.
   */
  const progressionRpe = mod.deload
    ? Math.max(...program.weekModifiers.filter((w) => !w.deload).map((w) => w.topRpe))
    : mod.topRpe;

  const entries = day.blocks.map((block, i) => {
    const ex = getExercise(block.exerciseId);
    // Both lookups are scoped to THIS day. Every main lift appears twice a week
    // under different schemes (heavy top-set day vs volume day), and comparing
    // across them is meaningless in both directions — "last time" has to mean
    // the last time you did this exercise in this role.
    const last = historyFor?.(block.exerciseId, { dayKey }) ?? null;
    const basis = historyFor?.(block.exerciseId, { dayKey, forProgression: true }) ?? last;
    const nSets = setCountFor(block, mod);

    if (block.scheme === 'top_backoff') {
      const lastTop = basis?.sets?.find((s) => s.type === 'top' && s.done) ?? null;
      const sugg = suggestTopSet(lastTop, block, ex, progressionRpe);
      const topWeight =
        sugg.weightKg == null ? null : roundToIncrement(sugg.weightKg * mod.loadMultiplier, ex.increment);
      const nBackoff = Math.max(1, Math.round(block.backoff.sets * (mod.setMultiplier ?? 1)));

      const planned = [
        {
          type: 'top',
          targetRepMin: block.top.repMin,
          targetRepMax: block.top.repMax,
          targetReps: sugg.reps,
          rpeTarget: mod.topRpe,
          weightKg: topWeight,
        },
        ...Array.from({ length: nBackoff }, () => ({
          type: 'backoff',
          targetReps: block.backoff.reps,
          rpeTarget: null,
          // null until the top set is logged; recomputed live from what was ACTUALLY hit
          weightKg: topWeight == null ? null : backoffLoad(topWeight, block.backoff.pctOfTop, ex),
          derivedFromTop: true,
          pctOfTop: block.backoff.pctOfTop,
        })),
      ];

      return {
        order: i,
        exerciseId: block.exerciseId,
        name: ex.name,
        tier: block.tier ?? null,
        scheme: 'top_backoff',
        restSec: block.restSec,
        cue: ex.cue,
        label: `Top set ${block.top.repMin}–${block.top.repMax} @ RPE ${mod.topRpe}, then ${nBackoff}×${block.backoff.reps} @ ${Math.round(block.backoff.pctOfTop * 100)}%`,
        suggestion: sugg.reason,
        plannedSets: planned,
        lastTime: last,
      };
    }

    // double_progression
    const sugg = suggestDoubleProgression(basis?.sets, block, ex);
    const weight =
      sugg.weightKg == null ? null : roundToIncrement(sugg.weightKg * mod.loadMultiplier, ex.increment);

    return {
      order: i,
      exerciseId: block.exerciseId,
      name: ex.name,
      tier: block.tier ?? null,
      scheme: 'double_progression',
      restSec: block.restSec,
      cue: ex.cue,
      label: `${nSets} × ${block.repMin}–${block.repMax}${block.rpeCap ? ` @ RPE ≤${block.rpeCap}` : ''}`,
      suggestion: sugg.reason,
      plannedSets: Array.from({ length: nSets }, () => ({
        type: 'work',
        targetRepMin: block.repMin,
        targetRepMax: block.repMax,
        targetReps: sugg.reps,
        rpeTarget: block.rpeCap ?? null,
        weightKg: weight,
      })),
      lastTime: last,
    };
  });

  return {
    kind: 'lift',
    dayKey,
    name: day.name,
    focus: day.focus,
    optional: !!day.optional,
    weekInMeso,
    isDeload: mod.deload,
    weekNote: mod.note,
    entries,
  };
}

/** Resolve a run. `variant` is 'easy' | 'long'. */
export function resolveRunSession(program, variant, runWeek) {
  const plan =
    program.runPlan.find((w) => w.week === runWeek) ?? program.runMaintenance;
  const spec = plan[variant] ?? program.runMaintenance[variant];
  const beyondPlan = !program.runPlan.find((w) => w.week === runWeek);

  const target =
    spec.kind === 'time'
      ? { kind: 'time', minutes: spec.minutes, km: null }
      : { kind: 'distance', km: spec.km, minutes: null };

  const label =
    spec.kind === 'time' ? `${spec.minutes} min easy` : `${spec.km} km`;

  return {
    kind: 'run',
    dayKey: `run:${variant}`,
    variant,
    name: variant === 'long' ? 'Long Run' : 'Easy Run',
    runWeek,
    beyondPlan,
    isDown: !!plan.down,
    isGoal: !!plan.goal,
    target,
    label,
    focus:
      variant === 'long'
        ? 'Still conversational. The distance is the stimulus, not the pace.'
        : 'Zone 2. If you cannot talk in full sentences, slow down.',
    note: plan.down
      ? 'Down week — deliberately easier. Do not top it up.'
      : plan.goal
        ? 'Goal session. This is the 10K.'
        : '',
  };
}

/** Resolve a core session for the current phase. */
export function resolveCoreSession(program, coreSessionsCompleted) {
  const phase = [...program.corePhases]
    .reverse()
    .find((p) => coreSessionsCompleted >= p.afterSessions) ?? program.corePhases[0];

  const entries = phase.blocks.map((block, i) => {
    const ex = getExercise(block.exerciseId);
    const isTime = block.scheme === 'time';
    return {
      order: i,
      exerciseId: block.exerciseId,
      name: ex.name,
      scheme: block.scheme,
      restSec: block.restSec,
      cue: ex.cue,
      perSide: ex.perSide,
      label: isTime
        ? `${block.sets} × ${block.seconds}s${ex.perSide ? ' each side' : ''}`
        : `${block.sets} × ${block.repMin}${block.repMax !== block.repMin ? `–${block.repMax}` : ''}${ex.perSide ? ' each side' : ''}`,
      plannedSets: Array.from({ length: block.sets }, () => ({
        type: 'work',
        targetSeconds: isTime ? block.seconds : null,
        targetReps: isTime ? null : block.repMin,
        targetRepMax: isTime ? null : block.repMax,
        weightKg: block.scheme === 'weight_reps' ? null : undefined,
      })),
    };
  });

  return {
    kind: 'core',
    dayKey: 'core',
    name: `Core — Phase ${phase.phase}`,
    phase: phase.phase,
    phaseName: phase.name,
    focus: phase.note,
    entries,
  };
}

/** Dispatch on a slot key. */
export function resolveSession(program, dayKey, ctx) {
  if (dayKey.startsWith('lift:')) {
    return resolveLiftSession(program, dayKey, ctx.weekInMeso, ctx.historyFor);
  }
  if (dayKey.startsWith('run:')) {
    return resolveRunSession(program, dayKey.split(':')[1], ctx.runWeek);
  }
  if (dayKey === 'core') {
    return resolveCoreSession(program, ctx.coreCompleted);
  }
  throw new Error(`Unknown session key: ${dayKey}`);
}
