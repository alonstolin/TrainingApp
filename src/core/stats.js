/**
 * Series builders for the progress screens. DOM-free, pure.
 * Everything here takes the raw session list and returns plain arrays ready to plot.
 */

import { getExercise, MUSCLE_LABELS } from '../program/exercises.js';
import { bestE1rm, effectiveLoad, e1rm, paceSecPerKm } from './progression.js';
import { startOfWeek, daysBetween, trainingDate } from './dates.js';

const completed = (sessions) =>
  [...sessions].filter((s) => s.status === 'completed').sort((a, b) => (a.date < b.date ? -1 : 1));

/**
 * Sessions where this exercise was trained as the day's heavy top-set lift.
 *
 * Every main lift is trained twice a week — heavy (top set + back-offs) and
 * volume (8–12s at a much lighter load). Plotting both in one line produces a
 * zigzag between two unrelated loads that reads as wild week-to-week swings.
 * The heavy exposure is the strength signal, so strength charts use only it.
 */
const hasTopSet = (entry) => (entry.sets ?? []).some((x) => x.done && x.type === 'top');

/**
 * Estimated 1RM over time for one exercise, one point per session.
 * For pull-ups the point uses bodyweight + added load, so the line stays honest
 * across bodyweight changes.
 *
 * @param {{heavyOnly?:boolean}} opts
 */
export function e1rmSeries(sessions, exerciseId, opts = {}) {
  const ex = getExercise(exerciseId);
  const out = [];
  for (const s of completed(sessions)) {
    const entry = s.entries?.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    if (opts.heavyOnly && !hasTopSet(entry)) continue;
    const value = bestE1rm(entry.sets ?? [], ex, s.bodyweightKg);
    if (!value) continue;

    let bestSet = null;
    let bestVal = 0;
    for (const set of entry.sets ?? []) {
      if (!set.done || !set.reps) continue;
      const v = e1rm(effectiveLoad(set, ex, s.bodyweightKg), set.reps, set.rpe);
      if (v > bestVal) { bestVal = v; bestSet = set; }
    }

    out.push({
      date: s.date,
      value: Math.round(value * 10) / 10,
      weightKg: bestSet?.weightKg ?? null,
      reps: bestSet?.reps ?? null,
      rpe: bestSet?.rpe ?? null,
      sessionId: s.id,
    });
  }
  return out;
}

/** Heaviest working weight actually lifted per session — the number you feel. */
export function topSetSeries(sessions, exerciseId, opts = {}) {
  const out = [];
  for (const s of completed(sessions)) {
    const entry = s.entries?.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    if (opts.heavyOnly && !hasTopSet(entry)) continue;
    let best = null;
    for (const set of entry.sets ?? []) {
      if (!set.done || !set.reps) continue;
      if (!best || (set.weightKg ?? 0) > (best.weightKg ?? 0)) best = set;
    }
    if (best) {
      out.push({ date: s.date, value: best.weightKg ?? 0, reps: best.reps, rpe: best.rpe });
    }
  }
  return out;
}

/** One point per completed run. */
export function runSeries(sessions) {
  return completed(sessions)
    .filter((s) => s.kind === 'run' && s.run?.distanceKm)
    .map((s) => ({
      date: s.date,
      km: s.run.distanceKm,
      sec: s.run.durationSec,
      pace: paceSecPerKm(s.run.distanceKm, s.run.durationSec),
      variant: s.variant,
      effort: s.run.effort ?? null,
      sessionId: s.id,
    }));
}

/** Weekly running distance, Monday-anchored, with empty weeks filled in as zero. */
export function weeklyRunVolume(sessions, today = trainingDate()) {
  const runs = runSeries(sessions);
  if (runs.length === 0) return [];

  const byWeek = new Map();
  for (const r of runs) {
    const wk = startOfWeek(r.date);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + r.km);
  }

  const weeks = [...byWeek.keys()].sort();
  const first = weeks[0];
  const last = startOfWeek(today);
  const out = [];
  let cursor = first;
  let guard = 0;
  while (cursor <= last && guard++ < 260) {
    out.push({ weekStart: cursor, km: Math.round((byWeek.get(cursor) ?? 0) * 10) / 10 });
    const d = new Date(cursor.slice(0, 4), Number(cursor.slice(5, 7)) - 1, Number(cursor.slice(8, 10)));
    d.setDate(d.getDate() + 7);
    cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return out;
}

/** Best effort per session for a core exercise — seconds for holds, reps otherwise. */
export function coreSeries(sessions, exerciseId) {
  const ex = getExercise(exerciseId);
  const isTime = ex.metric === 'time';
  const out = [];
  for (const s of completed(sessions)) {
    if (s.kind !== 'core') continue;
    const entry = s.entries?.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    let best = 0;
    for (const set of entry.sets ?? []) {
      if (!set.done) continue;
      const v = isTime ? (set.seconds ?? 0) : (set.reps ?? 0);
      if (v > best) best = v;
    }
    if (best) out.push({ date: s.date, value: best, unit: isTime ? 's' : 'reps' });
  }
  return out;
}

/** Hard set count per muscle for a given week — the MEV/MAV sanity check. */
export function weeklyVolumeByMuscle(sessions, weekStartDate) {
  const counts = new Map();
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    if (startOfWeek(s.date) !== weekStartDate) continue;
    for (const entry of s.entries ?? []) {
      const ex = getExercise(entry.exerciseId);
      if (!ex.muscle) continue;
      const hard = (entry.sets ?? []).filter((x) => x.done && x.type !== 'warmup').length;
      if (hard) counts.set(ex.muscle, (counts.get(ex.muscle) ?? 0) + hard);
    }
  }
  return [...counts.entries()]
    .map(([muscle, sets]) => ({ muscle, label: MUSCLE_LABELS[muscle] ?? muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/** All-time bests for an exercise. */
export function personalBests(sessions, exerciseId) {
  const ex = getExercise(exerciseId);
  let heaviest = null;
  let bestE1 = null;
  let bestReps = null;

  for (const s of completed(sessions)) {
    const entry = s.entries?.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    for (const set of entry.sets ?? []) {
      if (!set.done) continue;
      const rec = { ...set, date: s.date, bodyweightKg: s.bodyweightKg };
      if (set.reps && (!heaviest || (set.weightKg ?? 0) > (heaviest.weightKg ?? 0))) heaviest = rec;
      if (set.reps && (!bestReps || set.reps > bestReps.reps)) bestReps = rec;
      if (set.reps) {
        const v = e1rm(effectiveLoad(set, ex, s.bodyweightKg), set.reps, set.rpe);
        if (!bestE1 || v > bestE1.value) bestE1 = { ...rec, value: v };
      }
      if (ex.metric === 'time' && set.seconds) {
        if (!bestReps || set.seconds > (bestReps.seconds ?? 0)) bestReps = rec;
      }
    }
  }
  return { heaviest, bestE1rm: bestE1, bestReps };
}

/** Adherence over a trailing window, split by modality. */
export function adherence(sessions, today = trainingDate(), days = 28) {
  const recent = sessions.filter(
    (s) => daysBetween(s.date, today) <= days && daysBetween(s.date, today) >= 0,
  );
  const tally = (kind) => ({
    completed: recent.filter((s) => s.kind === kind && s.status === 'completed').length,
    skipped: recent.filter((s) => s.kind === kind && s.status === 'skipped').length,
  });
  return { days, lift: tally('lift'), run: tally('run'), core: tally('core') };
}

/**
 * Total distance and time for the block of runs that ended at the goal, plus
 * whether the 10K has actually been banked.
 */
export function runMilestones(sessions) {
  const runs = runSeries(sessions);
  const longest = runs.reduce((a, r) => (r.km > (a?.km ?? 0) ? r : a), null);
  const total = runs.reduce((sum, r) => sum + r.km, 0);
  return {
    totalKm: Math.round(total * 10) / 10,
    runCount: runs.length,
    longest,
    hitTenK: runs.some((r) => r.km >= 10),
  };
}
