/**
 * Progression maths. DOM-free, pure.
 *
 * Two progression models:
 *  - top_backoff (main lifts): top-set double progression under an RPE target.
 *    Back-off load is derived from the top set you ACTUALLY hit, not the planned one.
 *  - double_progression (everything else): fill the rep range on all sets, then
 *    add the smallest increment and reset to the bottom of the range.
 */

import { getExercise } from '../program/exercises.js';

/** Round to the nearest usable increment for this exercise (2.5kg bar, 1.25kg pull-up…). */
export function roundToIncrement(value, increment) {
  if (!increment) return value;
  return Math.round(value / increment) * increment;
}

/**
 * Effective load for a set — the number that actually went through the muscle.
 * For bodyweight_plus lifts (pull-ups) that is bodyweight + added weight, which
 * is why every session captures bodyweight. Without it, pull-up "strength"
 * silently changes whenever your weight does.
 */
export function effectiveLoad(set, exercise, bodyweightKg) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  if (ex.loadModel === 'bodyweight_plus') {
    return (bodyweightKg ?? 0) + (set.weightKg ?? 0);
  }
  return set.weightKg ?? 0;
}

/**
 * RPE-aware Epley estimated 1RM.
 *   reps in reserve = 10 - RPE, so a 5 @ RPE 8 is treated as a 7-rep max effort.
 * With no RPE recorded we fall back to plain Epley (assumes the set was maximal),
 * which is conservative in the right direction — it never inflates the estimate.
 */
export function e1rm(load, reps, rpe) {
  if (!load || !reps) return 0;
  const rir = rpe == null ? 0 : Math.max(0, 10 - rpe);
  return load * (1 + (reps + rir) / 30);
}

/** Best e1RM across a set list, using effective load. */
export function bestE1rm(sets, exercise, bodyweightKg) {
  let best = 0;
  for (const s of sets) {
    if (!s.done || !s.reps) continue;
    const v = e1rm(effectiveLoad(s, exercise, bodyweightKg), s.reps, s.rpe);
    if (v > best) best = v;
  }
  return best;
}

/** Working sets only — warmups never count toward progression decisions. */
export const workingSets = (sets) => sets.filter((s) => s.done && s.type !== 'warmup');

/**
 * Double progression: what should I do this time, given last time?
 *
 * @returns {{weightKg:number|null, reps:number, reason:string}}
 */
export function suggestDoubleProgression(lastSets, block, exercise) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  const { repMin, repMax, rpeCap = 9 } = block;

  const done = workingSets(lastSets ?? []);
  if (done.length === 0) {
    return { weightKg: null, reps: repMin, reason: 'First time — pick a load you can hold for the range.' };
  }

  const weights = done.map((s) => s.weightKg ?? 0);
  const topWeight = Math.max(...weights);
  // Only judge progression on sets at the heaviest load used.
  const atTop = done.filter((s) => (s.weightKg ?? 0) === topWeight);
  const allHitMax = atTop.every((s) => (s.reps ?? 0) >= repMax);
  const maxRpe = Math.max(...atTop.map((s) => s.rpe ?? 0));
  const withinRpe = maxRpe === 0 || maxRpe <= rpeCap;

  if (allHitMax && withinRpe) {
    return {
      weightKg: roundToIncrement(topWeight + ex.increment, ex.increment),
      reps: repMin,
      reason: `Cleared ${repMax} reps — load up ${ex.increment}${ex.unit}.`,
    };
  }

  const worst = Math.min(...atTop.map((s) => s.reps ?? 0));
  const target = Math.min(repMax, worst + 1);
  return {
    weightKg: topWeight,
    reps: target,
    reason: allHitMax
      ? `Hit the reps but at RPE ${maxRpe} — repeat the load and bring the effort down.`
      : `Same load, chase ${target} reps.`,
  };
}

/**
 * Top-set progression for main lifts. Advances load only when the top of the rep
 * range was reached at or under the week's RPE target.
 */
export function suggestTopSet(lastTopSet, block, exercise, targetRpe) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  const { repMin, repMax } = block.top;

  if (!lastTopSet || !lastTopSet.reps) {
    return { weightKg: null, reps: repMax, reason: 'First exposure — find an honest top set.' };
  }

  const w = lastTopSet.weightKg ?? 0;
  const hitMax = lastTopSet.reps >= repMax;
  const rpe = lastTopSet.rpe;
  const easy = rpe == null || rpe <= targetRpe;

  if (hitMax && easy) {
    return {
      weightKg: roundToIncrement(w + ex.increment, ex.increment),
      reps: repMin,
      reason: `${repMax} @ RPE ${rpe ?? '—'} last time — add ${ex.increment}${ex.unit}.`,
    };
  }
  if (hitMax && !easy) {
    return { weightKg: w, reps: repMax, reason: `Top of the range but RPE ${rpe}. Repeat and own it.` };
  }
  return {
    weightKg: w,
    reps: Math.min(repMax, lastTopSet.reps + 1),
    reason: `Same load, one more rep than last time (${lastTopSet.reps}).`,
  };
}

/** Back-off load, derived from the top set actually performed today. */
export function backoffLoad(topWeightKg, pctOfTop, exercise) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  if (topWeightKg == null) return null;
  return roundToIncrement(topWeightKg * pctOfTop, ex.increment);
}

/** Pace in seconds per km. */
export function paceSecPerKm(distanceKm, durationSec) {
  if (!distanceKm || !durationSec) return null;
  return durationSec / distanceKm;
}

/** Seconds/km → "5:42 /km". */
export function formatPace(secPerKm) {
  if (!secPerKm || !isFinite(secPerKm)) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  const ss = s === 60 ? '00' : String(s).padStart(2, '0');
  return `${s === 60 ? m + 1 : m}:${ss} /km`;
}

/**
 * The BJSM-2025 safety rail: no single run should exceed ~110% of the longest
 * run in the previous 30 days. Injury risk tracks single-session spikes far more
 * than weekly totals, so this is checked per-run, not per-week.
 */
export const SPIKE_LIMIT = 1.15; // warn above this; the plan itself never exceeds ~1.10

export function checkRunSpike(plannedKm, longestRecentKm) {
  if (!plannedKm || !longestRecentKm) return { ok: true };
  const ratio = plannedKm / longestRecentKm;
  if (ratio <= SPIKE_LIMIT) return { ok: true, ratio };
  return {
    ok: false,
    ratio,
    message: `${plannedKm}km is ${Math.round(ratio * 100)}% of your longest run in the last 30 days (${longestRecentKm}km). Big single-run jumps are the main driver of running injuries — consider ${(longestRecentKm * 1.1).toFixed(1)}km instead.`,
  };
}
