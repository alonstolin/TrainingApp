/**
 * Progression maths. DOM-free, pure.
 *
 * Three progression models:
 *  - probe_backoff (main lifts, v3): a probe set finds today's RPE-8 triple-to-
 *    five, but the working sets are 3×4–6 at a fixed percentage of a BLOCK
 *    REFERENCE e1RM that only moves on evidence — a better probe at ≤ RPE 8, or
 *    every back-off set reaching the top of its range at ≤ RPE 8.5. Back-offs
 *    are never derived from today's top set: that set is the least reliably
 *    rated set in the session (Helms 2017) and anchoring to it is how v2 ended
 *    up prescribing RPE-4 back-offs. See blockReference().
 *  - top_backoff (main lifts, v2 — kept so old programs still resolve): top-set
 *    double progression, back-offs derived from the top set actually hit.
 *  - double_progression (everything else): fill the rep range on all sets, then
 *    add the smallest increment and reset to the bottom of the range.
 */

import { getExercise } from '../program/exercises.js';
import { startOfWeek, daysBetween, addDays, trainingDate } from './dates.js';

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
  // When the last set is programmed to failure its RPE is 10 by design, so it
  // cannot be the set that says "too hard". Judge effort on the sets before it.
  const judged = block.lastSetToFailure && atTop.length > 1 ? atTop.slice(0, -1) : atTop;
  const maxRpe = Math.max(...judged.map((s) => s.rpe ?? 0));
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

/**
 * Load that produces a target e1RM at a given rep count and RPE — the inverse of
 * e1rm(). Used to prefill the probe from the block reference.
 */
export function loadForReps(targetE1rm, reps, rpe, exercise, bodyweightKg, { increment } = {}) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  if (!targetE1rm || !reps) return null;
  const rir = rpe == null ? 0 : Math.max(0, 10 - rpe);
  const load = targetE1rm / (1 + (reps + rir) / 30);
  const onBar = ex.loadModel === 'bodyweight_plus' ? load - (bodyweightKg ?? 0) : load;
  return roundToIncrement(onBar, increment ?? ex.increment);
}

/**
 * The load to put on the bar for a percentage of the block reference.
 *
 * System mass throughout for pull-ups: 80% of a 120 kg system e1RM at 82 kg
 * bodyweight is 96 kg, i.e. 14 kg on the belt — NOT 80% of the belt load. The
 * percentages were validated on system mass (Muñoz-López 2017) and are wrong by
 * a large factor on added load alone (SYNTHESIS §1.5).
 */
export function loadFromReference(referenceE1rm, pct, exercise, bodyweightKg, { increment } = {}) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  if (referenceE1rm == null || !pct) return null;
  const system = referenceE1rm * pct;
  const onBar = ex.loadModel === 'bodyweight_plus' ? system - (bodyweightKg ?? 0) : system;
  return roundToIncrement(onBar, increment ?? ex.increment);
}

/**
 * RPE a back-off set of `reps` at `pct` of reference implies by the app's own
 * formula — the coherence check the reviewer asked for. At 80%: 4 → 6.5,
 * 5 → 7.5, 6 → 8.5. (Rounding to the plate increment moves it a few tenths.)
 */
export function impliedRpe(referenceE1rm, load, reps) {
  if (!referenceE1rm || !load || !reps) return null;
  const rir = 30 * (referenceE1rm / load - 1) - reps;
  return 10 - rir;
}

/**
 * The block reference for a main lift, folded from its heavy-day history.
 *
 * @param rows  heavy-day history rows for this lift, OLDEST FIRST:
 *              { date, sets, bodyweightKg, isDeload, role }
 * @param block the probe_backoff block (for pct and repMax)
 * @returns {{ e1rm:number|null, source:string|null, date:string|null, stalls:number,
 *             increment:number, lastBackoffReps:number|null }}
 *
 * Rules (SYNTHESIS §1.1, §1.4):
 *  - Seed: the first probe of the block (sets ≤ 6 reps). A test-week probe
 *    (RPE 9) sets the NEXT block's reference — it is applied once the deload
 *    that follows it has been passed, not to the block it was lifted in.
 *  - Raise on a later probe at ≤ RPE 8 whose e1RM beats the reference.
 *  - Raise when every back-off set reaches repMax at ≤ RPE 8.5 — to the
 *    reference whose 80% is exactly one increment above the load just lifted.
 *    (Raising by increment / pct is the same thing before rounding; after
 *    rounding it can fail to move the bar at all, which is the whole point.)
 *  - An unplanned RPE ≥ 9 probe changes nothing; the dose is protected.
 *  - Deload sessions never touch the reference.
 *  - Sessions logged under a program before v3 may SEED the reference through
 *    their top set (so the first v3 heavy day is not blank) but their back-offs
 *    were 85% of a top set, not a double progression, and never raise it.
 *  - `stalls` counts heavy sessions since the last raise. Past
 *    exercise.afterMisses.count the smaller increment is used (incline 2.5 → 1.25).
 */
export function blockReference(rows, block, exercise) {
  const ex = typeof exercise === 'string' ? getExercise(exercise) : exercise;
  const pct = block?.backoff?.pctOfReference ?? 0.8;
  const repMax = block?.backoff?.repMax ?? 6;

  let ref = null;
  let source = null;
  let date = null;
  let stalls = 0;
  let pendingSeed = null; // a test-week probe waiting for its block to start
  let lastBackoffReps = null;
  let lastBackoffLoad = null; // what was actually on the bar last time

  const stepFor = () =>
    ex.afterMisses && stalls >= ex.afterMisses.count ? ex.afterMisses.increment : ex.increment;

  for (const row of rows ?? []) {
    if (row.isDeload) {
      // Passing the deload is what starts the next block.
      if (pendingSeed != null) {
        ref = pendingSeed.e1rm;
        source = 'test';
        date = pendingSeed.date;
        stalls = 0;
        pendingSeed = null;
      }
      continue;
    }
    const bw = row.bodyweightKg;
    const legacy = row.programVersion != null && row.programVersion < 3;
    const probe = (row.sets ?? []).find((s) => s.done && (s.type === 'probe' || s.type === 'top') && s.reps && s.reps <= 6);
    const backoffs = legacy ? [] : (row.sets ?? []).filter((s) => s.done && s.type === 'backoff' && s.reps);
    let raised = false;

    if (probe) {
      const e = e1rm(effectiveLoad(probe, ex, bw), probe.reps, probe.rpe);
      if (row.role === 'test') {
        pendingSeed = { e1rm: e, date: row.date };
      } else if (ref == null) {
        ref = e;
        source = 'probe';
        date = row.date;
        raised = true;
      } else if ((probe.rpe == null || probe.rpe <= 8) && e > ref) {
        ref = e;
        source = 'probe';
        date = row.date;
        raised = true;
      }
    }

    if (backoffs.length && ref != null) {
      lastBackoffReps = Math.min(...backoffs.map((s) => s.reps));
      lastBackoffLoad = Math.max(...backoffs.map((s) => s.weightKg ?? 0));
      const allTop = backoffs.every((s) => s.reps >= repMax && (s.rpe == null || s.rpe <= 8.5));
      if (allTop) {
        // Anchor on what was actually lifted, not on the rounded reference —
        // the bar must move by one step from the load that earned the raise.
        const step = stepFor();
        const system = lastBackoffLoad + step + (ex.loadModel === 'bodyweight_plus' ? (bw ?? 0) : 0);
        ref = system / pct;
        source = 'backoffs';
        date = row.date;
        raised = true;
      }
    }

    if (raised) stalls = 0;
    else if (probe || backoffs.length) stalls++;
  }

  // A test probe with no deload logged yet still defines "next block" once the
  // caller says the block has turned — handled by passing rows that end at the
  // deload. Until then the current reference stands.
  return { e1rm: ref, source, date, stalls, increment: stepFor(), lastBackoffReps, lastBackoffLoad };
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
 * The single-run spike rail (Frandsen 2025, BJSM, n = 5,205): a run more than
 * 10% longer than the longest in the prior 30 days carried HRR 1.64. The
 * authors describe a dose–response, not a threshold — ≤ 10% is where the extra
 * risk stops being detectable, not where it is zero — so the guard sits at the
 * edge of the band, and the copy says "associated with", not "the main driver":
 * 85% of overuse injuries in that cohort happened with no spike at all.
 */
export const SPIKE_LIMIT = 1.10;

/**
 * Weekly-total rail (Nielsen 2014, 874 novices): a > 30% jump in weekly
 * distance was associated with distance-type injuries (HR 1.59).
 */
export const WEEKLY_JUMP_LIMIT = 1.30;

export function checkRunSpike(plannedKm, longestRecentKm, { priorInjury = false } = {}) {
  if (!plannedKm || !longestRecentKm) return { ok: true };
  const ratio = plannedKm / longestRecentKm;
  if (ratio <= SPIKE_LIMIT + 1e-9) return { ok: true, ratio };
  const suggested = (Math.floor(longestRecentKm * SPIKE_LIMIT * 10) / 10).toFixed(1);
  return {
    ok: false,
    ratio,
    message:
      `${plannedKm} km is ${Math.round(ratio * 100)}% of your longest run in the last 30 days (${longestRecentKm} km). ` +
      `Jumps over 10% are associated with more injuries — ${suggested} km keeps you inside the band.` +
      (priorInjury ? ' With a previous lower-limb injury, treat this as a stop rather than a warning.' : ''),
  };
}

/**
 * Both running-load rails for one run, planned or just completed.
 *
 * @param sessions   the log
 * @param run        { km, date, sessionId? } — sessionId excludes the run itself
 *                   from the totals when it has already been written to the log
 * @returns {Array<{kind:'spike'|'weekly', message:string, ratio:number}>}
 */
export function runLoadWarnings(sessions, run, { today = trainingDate(), priorInjury = false } = {}) {
  const out = [];
  if (!run?.km) return out;
  const date = run.date ?? today;
  const done = sessions.filter(
    (s) => s.kind === 'run' && s.status === 'completed' && s.run?.distanceKm && s.id !== run.sessionId,
  );

  // Single-run spike vs the 30-day longest, excluding the run being judged.
  let longest = 0;
  for (const s of done) {
    const age = daysBetween(s.date, date);
    if (age > 30 || age < 0) continue;
    if (s.run.distanceKm > longest) longest = s.run.distanceKm;
  }
  const spike = checkRunSpike(run.km, longest, { priorInjury });
  if (!spike.ok) out.push({ kind: 'spike', message: spike.message, ratio: spike.ratio });

  // Weekly total (this run included) vs last week's total.
  const thisWeek = startOfWeek(date);
  const lastWeek = addDays(thisWeek, -7);
  let cur = run.km;
  let prev = 0;
  for (const s of done) {
    const wk = startOfWeek(s.date);
    if (wk === thisWeek) cur += s.run.distanceKm;
    else if (wk === lastWeek) prev += s.run.distanceKm;
  }
  if (prev > 0 && cur / prev > WEEKLY_JUMP_LIMIT + 1e-9) {
    out.push({
      kind: 'weekly',
      ratio: cur / prev,
      message: `This week would total ${Math.round(cur * 10) / 10} km — ${Math.round((cur / prev) * 100)}% of last week's ${Math.round(prev * 10) / 10} km. Weekly jumps over 30% are associated with more injuries.`,
    });
  }
  return out;
}
