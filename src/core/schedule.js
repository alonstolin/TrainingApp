/**
 * The schedule engine. DOM-free, pure. This is the highest-risk logic in the app.
 *
 * WHY IT IS BUILT THIS WAY
 * ------------------------
 * The obvious implementation — `week = floor((today - startDate) / 7)` and
 * `session = weekTemplate[today.getDay()]` — breaks the first time you miss a
 * Wednesday: that session is silently lost forever, and "week 4, peak volume"
 * arrives on the calendar even though you have only trained nine times.
 *
 * Instead, the calendar and the program are decoupled:
 *
 *   CALENDAR POSITION  — derived from today's date. Purely informational
 *                        ("the plan puts Upper Push on Wednesday").
 *   PROGRAM CURSOR     — what you actually owe. Advances ONLY when a session is
 *                        completed or explicitly skipped. Never by the clock.
 *
 * Cursors are DERIVED from the session log on every read rather than stored.
 * The log is the single source of truth, so cursors can never drift out of sync
 * with it, and importing a backup needs no cursor reconciliation at all.
 *
 * Two counters per track, and the distinction matters:
 *   position  — advances on complete OR skip. Decides which day comes next.
 *   completed — advances on complete ONLY. Drives mesocycle week, so skipping
 *               sessions can never fake your way into a deload.
 */

import { dayOfWeek, addDays, daysBetween, trainingDate } from './dates.js';
import { resolveSession, weekModifier } from './prescribe.js';

const LOOKBACK_CAP_DAYS = 60; // ceiling on the missed-slot walk

/** Sessions that count toward a cursor: completed or explicitly skipped. */
const isSettled = (s) => s.status === 'completed' || s.status === 'skipped';

/**
 * Rebuild all cursors from the session log.
 * Optional bonus sessions (lift:E) are deliberately excluded from the lift cycle —
 * doing an extra arm day must not push you on to the next programmed session.
 */
export function deriveCursors(sessions, program) {
  const settled = sessions.filter(isSettled);

  const lifts = settled.filter((s) => s.kind === 'lift' && s.dayKey !== 'lift:E');
  const liftPosition = lifts.length;
  const liftCompleted = lifts.filter((s) => s.status === 'completed').length;

  const runs = settled.filter((s) => s.kind === 'run');
  const longCompleted = runs.filter(
    (s) => s.variant === 'long' && s.status === 'completed',
  ).length;
  const easyCompleted = runs.filter(
    (s) => s.variant === 'easy' && s.status === 'completed',
  ).length;

  const coreCompleted = settled.filter(
    (s) => s.kind === 'core' && s.status === 'completed',
  ).length;

  const perBlock = program.liftsPerWeek * program.mesocycleWeeks;

  return {
    lift: {
      position: liftPosition,
      completed: liftCompleted,
      nextDayKey: program.liftCycle[liftPosition % program.liftCycle.length],
    },
    run: {
      longCompleted,
      easyCompleted,
      // The run week advances only when that week's long run is banked. This is
      // what structurally enforces the "no single-session distance spike" rule
      // even when weeks get missed — you repeat the week rather than skipping ahead.
      week: longCompleted + 1,
    },
    core: { completed: coreCompleted },
    mesocycle: Math.floor(liftCompleted / perBlock) + 1,
    weekInMeso: (Math.floor(liftCompleted / program.liftsPerWeek) % program.mesocycleWeeks) + 1,
  };
}

/** Most recent settled session for a track, or null. */
function lastSessionDate(sessions, predicate) {
  let best = null;
  for (const s of sessions) {
    if (!isSettled(s) || !predicate(s)) continue;
    if (best === null || s.date > best) best = s.date;
  }
  return best;
}

const trackOf = (key) => (key.startsWith('lift:') ? 'lift' : key.startsWith('run:') ? 'run' : 'core');

/**
 * How many non-optional slots for `track` fell strictly between the last session
 * of that track and today. This is "how far behind am I", expressed in sessions
 * rather than days — which is the unit that actually matters.
 */
function countMissedSlots(program, track, fromDateExclusive, today) {
  if (!fromDateExclusive) return 0;
  const span = daysBetween(fromDateExclusive, today);
  if (span <= 1) return 0;

  let missed = 0;
  const steps = Math.min(span - 1, LOOKBACK_CAP_DAYS);
  for (let i = 1; i <= steps; i++) {
    const d = addDays(fromDateExclusive, i);
    if (d >= today) break;
    for (const slot of program.weekTemplate[dayOfWeek(d)] ?? []) {
      if (slot.optional) continue;
      if (trackOf(slot.key) === track) missed++;
    }
  }
  return missed;
}

/**
 * Build the lookup that prescribe.js uses for "what did I do last time".
 * Reads from a prebuilt index when the store supplies one (O(1)); falls back to
 * a scan so this module stays usable standalone in tests.
 *
 * TWO filters, and both exist because of bugs that silently destroy progression:
 *
 * `opts.dayKey` — compare like with like. Every main lift appears TWICE a week:
 *   heavy (top set + back-offs) on one day, volume (8–12s) on another. Without
 *   this filter the heavy day often reads the volume day's sets, finds no set of
 *   type 'top', concludes it has never been done, and restarts from scratch —
 *   so none of the three main lifts would ever add weight. The volume day fails
 *   the mirror-image way, inheriting the heavy day's much larger load.
 *
 * `opts.forProgression` — skip deloads. Otherwise the session after a deload
 *   compares against the deliberately-light deload top set, decides it was easy,
 *   and prescribes a small bump on the REDUCED load, resetting you ~15% backwards
 *   every block. A deload is a rest from the load, not a new baseline.
 */
export function makeHistoryLookup(sessions, index) {
  const pick = (list, opts) => {
    if (!list?.length) return null;
    let candidates = list;
    if (opts?.dayKey) candidates = candidates.filter((r) => r.dayKey === opts.dayKey);
    if (opts?.forProgression) candidates = candidates.filter((r) => !r.isDeload);
    return candidates[0] ?? null;
  };

  if (index) return (exerciseId, opts) => pick(index.get(exerciseId), opts);

  const sorted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : (b.startedAt ?? 0) - (a.startedAt ?? 0),
    );

  return (exerciseId, opts) => {
    const hits = [];
    for (const s of sorted) {
      const entry = s.entries?.find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets?.some((x) => x.done)) {
        hits.push({
          date: s.date,
          sessionId: s.id,
          sets: entry.sets,
          bodyweightKg: s.bodyweightKg,
          dayKey: s.dayKey,
          isDeload: !!s.programRef?.isDeload,
        });
      }
    }
    return pick(hits, opts);
  };
}

/**
 * Everything the Today screen needs.
 *
 * @param {{sessions:Array, meta:Object, index?:Map}} state
 */
export function resolveToday(state, program, today = trainingDate()) {
  const { sessions, meta } = state;
  const cursors = deriveCursors(sessions, program);
  const historyFor = makeHistoryLookup(sessions, state.index);

  const ctx = {
    weekInMeso: cursors.weekInMeso,
    runWeek: cursors.run.week,
    coreCompleted: cursors.core.completed,
    historyFor,
  };

  const resume = sessions.find((s) => s.status === 'in_progress') ?? null;
  const doneToday = sessions.filter((s) => s.date === today && isSettled(s));
  const slots = program.weekTemplate[dayOfWeek(today)] ?? [];

  /**
   * A calendar slot resolves to what the CURSOR says, not what the calendar says.
   * Wednesday's "Upper Push" slot serves whichever lift day you actually owe.
   */
  const buildCard = (slot) => {
    const track = trackOf(slot.key);
    const actualKey = track === 'lift' ? cursors.lift.nextDayKey : slot.key;
    return {
      slotKey: slot.key,
      key: actualKey,
      track,
      optional: !!slot.optional,
      offSchedule: actualKey !== slot.key,
      alreadyDone: false,
      session: resolveSession(program, actualKey, ctx),
    };
  };

  const cards = slots.map(buildCard);

  /**
   * Retire today's slots against what has actually been trained today, by track
   * and in order. Finishing Monday's lift must clear the Monday lift slot — not
   * leave it showing the NEXT day's session, which is what comparing dayKeys
   * would do, since completing a session immediately advances the cursor past it.
   */
  for (const track of ['lift', 'run', 'core']) {
    let budget = doneToday.filter((s) => s.kind === track).length;
    for (const card of cards) {
      if (budget === 0) break;
      if (card.track !== track) continue;
      card.alreadyDone = true;
      budget--;
    }
  }
  const required = cards.filter((c) => !c.optional && !c.alreadyDone);
  const optional = cards.filter((c) => c.optional && !c.alreadyDone);

  // Lifts lead, then the long run, then easy runs, then core.
  const rank = (c) =>
    c.track === 'lift' ? 0 : c.key === 'run:long' ? 1 : c.track === 'run' ? 2 : 3;
  required.sort((a, b) => rank(a) - rank(b));

  const lastLift = lastSessionDate(sessions, (s) => s.kind === 'lift' && s.dayKey !== 'lift:E');
  const lastRun = lastSessionDate(sessions, (s) => s.kind === 'run');
  const lastCore = lastSessionDate(sessions, (s) => s.kind === 'core');
  const anchor = meta.startDate ? addDays(meta.startDate, -1) : null;

  const drift = {
    lift: countMissedSlots(program, 'lift', lastLift ?? anchor, today),
    run: countMissedSlots(program, 'run', lastRun ?? anchor, today),
    core: countMissedSlots(program, 'core', lastCore ?? anchor, today),
  };

  const mod = weekModifier(program, cursors.weekInMeso);

  return {
    date: today,
    dow: dayOfWeek(today),
    resume,
    primary: required[0] ?? null,
    also: required.slice(1),
    optional,
    completedToday: doneToday,
    isRestDay: required.length === 0,
    cursors,
    mesocycle: cursors.mesocycle,
    weekInMeso: cursors.weekInMeso,
    isDeload: mod.deload,
    weekNote: mod.note,
    runWeek: cursors.run.week,
    drift,
    // Surfaced as a prompt rather than acted on automatically — bulk-skipping is
    // always the user's explicit choice.
    needsCatchUp: drift.lift >= 3 || drift.run >= 3,
  };
}

/**
 * Everything you could choose to do instead, for the "Do something else" sheet.
 * Ordered with what you actually owe first.
 */
export function alternatives(state, program, today = trainingDate()) {
  const cursors = deriveCursors(state.sessions, program);
  const historyFor = makeHistoryLookup(state.sessions, state.index);
  const ctx = {
    weekInMeso: cursors.weekInMeso,
    runWeek: cursors.run.week,
    coreCompleted: cursors.core.completed,
    historyFor,
  };

  const nextIdx = cursors.lift.position % program.liftCycle.length;
  const liftOrder = [
    ...program.liftCycle.slice(nextIdx),
    ...program.liftCycle.slice(0, nextIdx),
  ];

  const keys = [...liftOrder, 'run:easy', 'run:long', 'core', 'lift:E'];

  return keys.map((key) => {
    const session = resolveSession(program, key, ctx);
    return {
      key,
      track: trackOf(key),
      isNext: key === cursors.lift.nextDayKey,
      optional: key === 'lift:E',
      session,
      subtitle:
        session.kind === 'lift'
          ? session.focus
          : session.kind === 'run'
            ? `Week ${session.runWeek} · ${session.label}`
            : session.phaseName,
    };
  });
}

/** Longest completed run in the trailing `days` window — input to the spike check. */
export function longestRecentRunKm(sessions, today = trainingDate(), days = 30) {
  let best = 0;
  for (const s of sessions) {
    if (s.kind !== 'run' || s.status !== 'completed') continue;
    if (daysBetween(s.date, today) > days) continue;
    const km = s.run?.distanceKm ?? 0;
    if (km > best) best = km;
  }
  return best;
}
