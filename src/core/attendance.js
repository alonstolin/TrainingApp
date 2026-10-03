/**
 * Attendance — what the template week asked for against what was done.
 * DOM-free, pure. Progress and the review report read the same ledger, so the
 * app and the report can never disagree about a week.
 */

import { getExercise, MUSCLE_LABELS } from '../program/exercises.js';
import { CURRENT_PROGRAM, getProgram } from '../program/index.js';
import { resolveLiftSession } from './prescribe.js';
import { deriveCursors } from './schedule.js';
import { slotLabel } from './calendar.js';
import { weeklyVolumeByMuscle } from './stats.js';
import { startOfWeek, addDays } from './dates.js';

/** The template week's lift days — the optional bonus day is never a target. */
const templateDays = (program) =>
  Object.values(program.weekTemplate).flat().filter((s) => !s.optional && s.key.startsWith('lift:')).map((s) => s.key);

/**
 * Working sets a lift day prescribes, resolved under the week's role and
 * credited to each primary muscle — the sets that, once done, are direct sets.
 */
function prescribedSets(program, dayKey, { role, coreCompleted }) {
  const counts = new Map();
  for (const e of resolveLiftSession(program, dayKey, { role, coreCompleted }).entries) {
    const muscle = getExercise(e.exerciseId).muscle;
    if (!muscle) continue;
    const n = e.plannedSets.filter((p) => p.type !== 'warmup').length;
    counts.set(muscle, (counts.get(muscle) ?? 0) + n);
  }
  return counts;
}

/** The program version recorded by the latest of `sessions`, or null. */
function lastVersion(sessions) {
  let latest = null;
  for (const s of sessions) {
    if (s.programRef?.version == null) continue;
    if (!latest || s.date >= latest.date) latest = s;
  }
  return latest?.programRef.version ?? null;
}

/**
 * The per-week ledger from `from` to `to` (training dates, whole weeks).
 *
 * Each week is measured against the template week of the program version in
 * force that week — the version its sessions recorded; a week with none takes
 * the version in force at the end of the week before, or the current program.
 * Editing the program therefore never re-judges a past week.
 *
 * @param {{from:string, to:string, meta?:object, programFor?:(version:number)=>object}} o
 * Per muscle, `template` is the whole template week; `owed` is the part of it
 * the week settled, and the shortfall is owed minus performed.
 *
 * @returns {Array<{ weekStart, version, role, sessions:{done, template}, skipped:Array, missed,
 *   partial, attendanceComplete, muscles:Array<{muscle, label, template, owed, performed, shortfall}> }>}
 */
export function attendanceLedger(sessions, { from, to, meta, programFor = getProgram }) {
  const weeks = [];
  let version = lastVersion(sessions.filter((s) => s.date < startOfWeek(from))) ?? CURRENT_PROGRAM.version;
  for (let weekStart = startOfWeek(from); weekStart <= to; weekStart = addDays(weekStart, 7)) {
    // Only what happened inside the range is this ledger's to judge: a range
    // that opens mid-week (v3 began on a Sunday) leaves the days before it out.
    const week = sessions.filter((s) => startOfWeek(s.date) === weekStart && s.date >= from && s.date <= to);
    version = lastVersion(week) ?? version;
    const program = programFor(version);
    const days = templateDays(program);
    const logged = week
      .filter((s) => s.kind === 'lift' && days.includes(s.dayKey))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // The week's role is the one its sessions ran under; a week with none takes
    // the role the engine would have served on its Monday. Either way a deload
    // week is measured against the deload's halved sets, not the full week.
    const before = deriveCursors(sessions.filter((s) => s.date < weekStart), program, { meta, today: weekStart });
    const role = logged.find((s) => s.programRef?.role)?.programRef.role ?? before.role;
    const ctx = { role, coreCompleted: before.core.completed };

    // Each day resolved once per week; the template and what is owed both sum it.
    const resolved = new Map(days.map((key) => [key, prescribedSets(program, key, ctx)]));
    const sum = (keys) => {
      const total = new Map();
      for (const key of keys) for (const [m, n] of resolved.get(key)) total.set(m, (total.get(m) ?? 0) + n);
      return total;
    };
    const template = sum(days);
    const performed = new Map(weeklyVolumeByMuscle(week, weekStart).map((r) => [r.muscle, r.sets]));
    const done = logged.filter((s) => s.status === 'completed').length;
    const skipped = logged
      .filter((s) => s.status === 'skipped')
      .map((s) => ({ date: s.date, dayKey: s.dayKey, name: slotLabel(program, s.dayKey).name }));
    // Only the days the week settled are owed. A skipped session was closed, so
    // its sets are gone; a missed day was never closed and is still the next
    // one offered, so no muscle has lost it yet.
    const owed = sum(logged.filter((s) => s.status === 'completed' || s.status === 'skipped').map((s) => s.dayKey));
    const partial = weekStart < from || addDays(weekStart, 6) > to;
    // Days still ahead of a partial week are not missed yet.
    const missed = partial ? 0 : Math.max(0, days.length - done - skipped.length);
    const muscles = [...new Set([...template.keys(), ...performed.keys()])].map((muscle) => {
      const o = owed.get(muscle) ?? 0;
      const p = performed.get(muscle) ?? 0;
      return {
        muscle,
        label: MUSCLE_LABELS[muscle] ?? muscle,
        template: template.get(muscle) ?? 0,
        owed: o,
        performed: p,
        shortfall: Math.max(0, o - p),
      };
    });
    weeks.push({
      weekStart,
      version,
      role,
      sessions: { done, template: days.length },
      skipped,
      missed,
      // The range opens or closes inside this week (the v3 entry week, the
      // current week): days outside it are neither done nor missed.
      partial,
      // Nothing skipped and nothing missed — in a partial week, so far.
      attendanceComplete: skipped.length === 0 && missed === 0,
      muscles,
    });
  }
  return weeks;
}

/**
 * Shortfall per muscle over a ledger, split by whether the weeks that produced
 * it had complete attendance, and read from that split: 'volume' when it all
 * came with full attendance (the only case that argues for more volume),
 * 'attendance' when it all came from weeks with skips or misses (a schedule
 * problem), 'mixed' otherwise. Muscles that were never short are left out.
 */
export function shortfallByMuscle(ledger) {
  const out = new Map();
  for (const week of ledger) {
    for (const m of week.muscles) {
      if (!m.shortfall) continue;
      const r = out.get(m.muscle) ?? { muscle: m.muscle, label: m.label, shortfall: 0, fullAttendance: 0, incompleteAttendance: 0 };
      r.shortfall += m.shortfall;
      if (week.attendanceComplete) r.fullAttendance += m.shortfall;
      else r.incompleteAttendance += m.shortfall;
      out.set(m.muscle, r);
    }
  }
  return [...out.values()]
    .map((r) => ({ ...r, reading: !r.fullAttendance ? 'attendance' : !r.incompleteAttendance ? 'volume' : 'mixed' }))
    .sort((a, b) => b.shortfall - a.shortfall);
}
