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

import { dayOfWeek, addDays, daysBetween, trainingDate, startOfWeek } from './dates.js';
import { resolveSession, weekModifier } from './prescribe.js';
import { getExercise } from '../program/exercises.js';

const LOOKBACK_CAP_DAYS = 60; // ceiling on the missed-slot walk

/** Sessions that count toward a cursor: completed or explicitly skipped. */
const isSettled = (s) => s.status === 'completed' || s.status === 'skipped';

/**
 * Did this completed session include core work? v3 attaches core to the end of
 * two lift days, so "a core session" is any completed session with at least one
 * logged set in a core-group entry — standalone or attached.
 */
export const hasCoreWork = (s) =>
  s.status === 'completed' &&
  (s.kind === 'core' ||
    (s.entries ?? []).some((e) => e.group === 'core' && (e.sets ?? []).some((x) => x.done)));

const roleOf = (weekInMeso, blockLength) =>
  weekInMeso >= blockLength ? 'deload' : weekInMeso === blockLength - 1 ? 'test' : 'probe';

/**
 * Where the lifting mesocycle stands. Pure; also drives the calendar's forward
 * simulation, so the Today screen and the Calendar tab can never disagree.
 *
 * v2 programs (no `blocks`): a fixed-length block on a lift-count clock.
 *
 * v3 programs, SYNTHESIS §4.4:
 *  - ENTRY — the first `liftsPerWeek` lifts after v3 start are a deload when v2
 *    was in week ≥ 3 at that moment (`meta.v3StartedAt.deloadFirst`).
 *  - BUILD — while the run plan is in progress AND a long run was completed in
 *    the last 14 days, the lifting week IS the run week as of Monday of the
 *    current week (so Sunday's lift stays in Monday's week). Lifting deloads
 *    land on the running down-weeks, except a down-week with fewer than
 *    `minLoadingWeeks` loading weeks before it, which is skipped. The week
 *    before each deload is the test week.
 *  - FALLBACK / POST — no long run for 14 days, or the build is over: a
 *    lift-count clock continues from the last run-derived position (or from
 *    the end of the build), in blocks of `fallbackWeeks` / `post.weeks`.
 *
 * @param {{liftDates:string[], longRunDates:string[], date:string, meta?:object}} o
 *        liftDates: completed non-optional lift dates, ascending
 *        longRunDates: completed long-run dates, ascending
 */
export function mesoState(program, { liftDates = [], longRunDates = [], date, meta } = {}) {
  const perWeek = program.liftsPerWeek;
  const liftCompleted = liftDates.length;

  if (!program.blocks) {
    const weeks = program.mesocycleWeeks;
    const weekInMeso = (Math.floor(liftCompleted / perWeek) % weeks) + 1;
    const mod = program.weekModifiers.find((w) => w.week === weekInMeso);
    return {
      mesocycle: Math.floor(liftCompleted / (perWeek * weeks)) + 1,
      weekInMeso,
      blockLength: weeks,
      role: mod?.deload ? 'deload' : roleOf(weekInMeso, weeks),
      isDeload: !!mod?.deload,
      source: 'lifts',
    };
  }

  const build = program.blocks.build;
  const start = meta?.v3StartedAt ?? { liftCompleted: 0, runWeekAtStart: 1, deloadFirst: false, weekStart: null };
  const liftsSince = Math.max(0, liftCompleted - (start.liftCompleted ?? 0));
  if (start.deloadFirst && liftsSince < perWeek) {
    return { mesocycle: 1, weekInMeso: 1, blockLength: 1, role: 'deload', isDeload: true, source: 'entry-deload' };
  }

  // Deload run weeks: the plan's down-weeks after v3 start, each needing enough
  // loading weeks before it.
  const boundary0 = (start.runWeekAtStart ?? 1) - 1 + (start.deloadFirst ? 1 : 0);
  const deloads = [];
  let prev = boundary0;
  for (const w of build.deloadOnRunWeeks) {
    if (w <= prev) continue;
    if (w - prev - 1 >= build.minLoadingWeeks) {
      deloads.push(w);
      prev = w;
    }
  }
  const lastDeloadRunWeek = build.deloadOnRunWeeks[build.deloadOnRunWeeks.length - 1];

  /** Run-derived position for a run week inside the build. */
  const runDerived = (r) => {
    const rr = Math.max(r, boundary0 + 1);
    const prevDeload = [...deloads].reverse().find((w) => w < rr) ?? boundary0;
    // No qualifying deload ahead means the build's last down-week closes the block.
    const nextDeload = deloads.find((w) => w >= rr) ?? Math.max(lastDeloadRunWeek, rr);
    const blockLength = nextDeload - prevDeload;
    const weekInMeso = rr - prevDeload;
    return {
      mesocycle: deloads.filter((w) => w < rr).length + 1,
      weekInMeso,
      blockLength,
      role: roleOf(weekInMeso, blockLength),
      runWeek: rr,
    };
  };

  const runWeekNow = longRunDates.length + 1;
  const inBuild = runWeekNow <= lastDeloadRunWeek;
  const lastLong = longRunDates[longRunDates.length - 1] ?? null;
  const fresh =
    lastLong != null && date != null && daysBetween(lastLong, date) <= (program.blocks.staleLongRunDays ?? 14);

  if (inBuild && fresh) {
    const weekStart = startOfWeek(date);
    const r = 1 + longRunDates.filter((d) => d < weekStart).length;
    const pos = runDerived(r);
    return { ...pos, isDeload: pos.role === 'deload', source: 'run' };
  }

  // ---- lift-count clock, continuing from the last run-derived position
  const anchorLong = inBuild ? lastLong : (longRunDates[lastDeloadRunWeek - 1] ?? lastLong);
  let anchorMonday = null;
  let at; // position at the anchor
  if (anchorLong) {
    anchorMonday = addDays(startOfWeek(anchorLong), 7);
    if (inBuild) {
      at = runDerived(longRunDates.length + 1);
    } else if (date != null && date < anchorMonday) {
      // The final down-week's long run is banked but its week is not over —
      // Sunday's lift is still part of the deload.
      const pos = runDerived(lastDeloadRunWeek);
      return { ...pos, isDeload: pos.role === 'deload', source: 'run' };
    } else {
      // The build's final deload has passed; post blocks start fresh.
      at = { mesocycle: deloads.length + 1, weekInMeso: 1, blockLength: program.blocks.post.weeks };
    }
  } else {
    at = { mesocycle: 1, weekInMeso: 1, blockLength: build.fallbackWeeks };
  }
  const weeks = inBuild ? build.fallbackWeeks : program.blocks.post.weeks;
  const liftsAfter = anchorMonday
    ? liftDates.filter((d) => d >= anchorMonday).length
    : liftsSince - (start.deloadFirst ? perWeek : 0);
  const w = at.weekInMeso + Math.floor(Math.max(0, liftsAfter) / perWeek);

  let pos;
  if (w <= at.blockLength) {
    pos = { mesocycle: at.mesocycle, weekInMeso: w, blockLength: at.blockLength };
  } else {
    const rem = w - at.blockLength - 1;
    pos = {
      mesocycle: at.mesocycle + 1 + Math.floor(rem / weeks),
      weekInMeso: (rem % weeks) + 1,
      blockLength: weeks,
    };
  }
  const role = roleOf(pos.weekInMeso, pos.blockLength);
  return { ...pos, role, isDeload: role === 'deload', source: inBuild ? 'lifts' : 'post' };
}

/**
 * Rebuild all cursors from the session log.
 * Optional bonus sessions (lift:E) are deliberately excluded from the lift cycle —
 * doing an extra arm day must not push you on to the next programmed session.
 *
 * @param {{meta?:object, today?:string}} opts — meta carries the v3 entry marker;
 *        today anchors the run-derived lifting week to the current calendar week.
 */
export function deriveCursors(sessions, program, opts = {}) {
  const today = opts.today ?? trainingDate();
  const settled = sessions.filter(isSettled);

  const lifts = settled.filter((s) => s.kind === 'lift' && s.dayKey !== 'lift:E');
  const liftPosition = lifts.length;
  const liftDates = lifts.filter((s) => s.status === 'completed').map((s) => s.date).sort();
  const liftCompleted = liftDates.length;

  const runs = settled.filter((s) => s.kind === 'run');
  const longRunDates = runs
    .filter((s) => s.variant === 'long' && s.status === 'completed')
    .map((s) => s.date)
    .sort();
  const longCompleted = longRunDates.length;
  const easyCompleted = runs.filter(
    (s) => s.variant === 'easy' && s.status === 'completed',
  ).length;

  const coreCompleted = settled.filter(hasCoreWork).length;

  const meso = mesoState(program, { liftDates, longRunDates, date: today, meta: opts.meta });

  return {
    lift: {
      position: liftPosition,
      completed: liftCompleted,
      nextDayKey: program.liftCycle[liftPosition % program.liftCycle.length],
    },
    run: {
      longCompleted,
      easyCompleted,
      lastLongDate: longRunDates[longRunDates.length - 1] ?? null,
      // The run week advances only when that week's long run is banked. This is
      // what structurally enforces the "no single-session distance spike" rule
      // even when weeks get missed — you repeat the week rather than skipping ahead.
      week: longCompleted + 1,
    },
    core: { completed: coreCompleted },
    mesocycle: meso.mesocycle,
    weekInMeso: meso.weekInMeso,
    blockLength: meso.blockLength,
    role: meso.role,
    isDeload: meso.isDeload,
    mesoSource: meso.source,
  };
}

/**
 * Race-week status (SYNTHESIS §4.4): in the goal run week, legs go light, and
 * inside 48 h of the long run they are best skipped. Upper body is untouched —
 * no evidence that upper-body lifting impairs running.
 */
export function raceWeekStatus(program, cursors, today = trainingDate()) {
  const goal = program.runPlan.find((w) => w.goal);
  if (!goal || cursors.run.week !== goal.week) return null;
  const longDow = Number(
    Object.entries(program.weekTemplate).find(([, slots]) => slots.some((s) => s.key === 'run:long'))?.[0] ?? 6,
  );
  const daysUntil = (longDow - dayOfWeek(today) + 7) % 7;
  const hoursToLongRun = daysUntil * 24;
  return { goalWeek: true, hoursToLongRun, recommendSkip: hoursToLongRun <= 48 };
}

/** Thursday reads as rest in the test week and once the long run is ≥ 8 km (§3.5). */
export function thursdayRest(program, cursors, today = trainingDate()) {
  const rule = program.thursdayRestWhen;
  if (!rule || dayOfWeek(today) !== 4) return false;
  if (rule.role && cursors.role === rule.role) return true;
  const plan = program.runPlan.find((w) => w.week === cursors.run.week) ?? program.runMaintenance;
  const km = plan?.long?.km ?? 0;
  return rule.longRunKm != null && km >= rule.longRunKm;
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
    if (!list?.length) return opts?.all ? [] : null;
    let candidates = list;
    if (opts?.dayKey) candidates = candidates.filter((r) => r.dayKey === opts.dayKey);
    if (opts?.forProgression) candidates = candidates.filter((r) => !r.isDeload);

    // Gym / station ladder. Only requested for gym-specific exercises (a cable
    // stack's 40 is not another gym's 40). Exact station first, then the same
    // gym, then anywhere — and the row says how far it had to reach so the
    // prescription can call a foreign number a guide rather than a target.
    if (opts?.gymId != null) {
      const sameGym = candidates.filter((r) => r.gymId === opts.gymId);
      const exact = opts.station != null ? sameGym.filter((r) => r.station === opts.station) : sameGym;
      const tag = (rows, scope) => rows.map((r) => ({ ...r, scope }));
      candidates = exact.length
        ? tag(exact, opts.station != null ? 'exact' : 'gym')
        : sameGym.length
          ? tag(sameGym, 'gym')
          : tag(candidates, 'other');
    }
    if (opts?.all) return candidates;
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
          role: s.programRef?.role ?? null,
          programVersion: s.programRef?.version ?? null,
          gymId: s.gymId ?? null,
          station: entry.station ?? null,
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
  const cursors = deriveCursors(sessions, program, { meta, today });
  const historyFor = makeHistoryLookup(sessions, state.index);
  const race = raceWeekStatus(program, cursors, today);

  const ctx = {
    role: cursors.role,
    weekInMeso: cursors.weekInMeso,
    runWeek: cursors.run.week,
    coreCompleted: cursors.core.completed,
    historyFor,
    bodyweightKg: meta?.bodyweightKg ?? null,
    gymId: meta?.lastGymId ?? null,
    substitutions: meta?.substitutions ?? null,
    raceWeek: race ? 'light' : null,
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
    // Optional lift slots (the bonus day) are what they say; only the required
    // lift slot is served from the cursor.
    const actualKey = track === 'lift' && !slot.optional ? cursors.lift.nextDayKey : slot.key;
    const session = resolveSession(program, actualKey, ctx);
    return {
      slotKey: slot.key,
      key: actualKey,
      track,
      optional: !!slot.optional,
      offSchedule: actualKey !== slot.key,
      alreadyDone: false,
      // The bonus day is only offered in probe weeks (SYNTHESIS §5.5).
      unavailable: session.kind === 'lift' && session.allowedThisWeek === false,
      session,
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
  const optional = cards.filter((c) => c.optional && !c.alreadyDone && !c.unavailable);

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

  const byRole = program.weekModifiers.some((w) => w.role);
  const mod = weekModifier(program, byRole ? cursors.role : cursors.weekInMeso);

  return {
    date: today,
    dow: dayOfWeek(today),
    resume,
    primary: required[0] ?? null,
    also: required.slice(1),
    optional,
    completedToday: doneToday,
    isRestDay: required.length === 0,
    restByDefault: thursdayRest(program, cursors, today),
    raceWeek: race,
    cursors,
    mesocycle: cursors.mesocycle,
    weekInMeso: cursors.weekInMeso,
    blockLength: cursors.blockLength,
    role: cursors.role,
    mesoSource: cursors.mesoSource,
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
  const { meta } = state;
  const cursors = deriveCursors(state.sessions, program, { meta, today });
  const historyFor = makeHistoryLookup(state.sessions, state.index);
  const race = raceWeekStatus(program, cursors, today);
  const ctx = {
    role: cursors.role,
    weekInMeso: cursors.weekInMeso,
    runWeek: cursors.run.week,
    coreCompleted: cursors.core.completed,
    historyFor,
    bodyweightKg: meta?.bodyweightKg ?? null,
    gymId: meta?.lastGymId ?? null,
    substitutions: meta?.substitutions ?? null,
    raceWeek: race ? 'light' : null,
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
      unavailable: session.kind === 'lift' && session.allowedThisWeek === false,
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

// ---------------------------------------------------------------------------
// Muscle overlap
// ---------------------------------------------------------------------------

/**
 * Muscles a lift day meaningfully trains, as muscle → set count.
 *
 * Counts SECONDARY involvement (see `trains` in exercises.js), because "did I
 * already hammer this yesterday" has to know a pull-up loads biceps and an
 * incline press loads triceps. Volume accounting deliberately does not — that
 * wants one owner per set — so the two must not be conflated.
 */
export function muscleLoad(program, dayKey) {
  const letter = dayKey.split(':')[1];
  const day = program.liftDays?.[letter];
  const out = {};
  if (!day) return out;

  for (const block of day.blocks) {
    const sets = block.sets ?? (block.top?.sets ?? 0) + (block.backoff?.sets ?? 0);
    for (const m of getExercise(block.exerciseId).trains ?? []) {
      out[m] = (out[m] ?? 0) + sets;
    }
  }
  return out;
}

/**
 * Muscles trained hard enough on this day to matter for scheduling.
 *
 * The threshold exists so a single incidental set does not read as "trained".
 * Three sets is the point where a muscle has had a real stimulus and will still
 * be carrying fatigue the next day.
 */
export function musclesWorked(program, dayKey, { minSets = 3 } = {}) {
  return new Set(
    Object.entries(muscleLoad(program, dayKey))
      .filter(([, sets]) => sets >= minSets)
      .map(([m]) => m),
  );
}

/**
 * Muscles this day leans on hard enough that yesterday's fatigue would cost you
 * something: anything loaded by a tiered main lift, plus anything carrying a
 * genuinely high set count.
 *
 * This is what separates a warning worth reading from a nag. Three sets of face
 * pulls the day after three sets of reverse pec deck is a rear-delt "overlap" on
 * paper, but nothing is compromised by it — whereas a heavy top set on a
 * pre-fatigued muscle is exactly the thing this program cannot afford. A guard
 * that fires on the harmless case teaches you to dismiss it.
 */
export function significantMuscles(program, dayKey, { heavySets = 5 } = {}) {
  const letter = dayKey.split(':')[1];
  const day = program.liftDays?.[letter];
  if (!day) return new Set();

  const out = new Set();
  for (const block of day.blocks) {
    if (!block.tier) continue; // T1/T2 — the lifts the program is actually built on
    for (const m of getExercise(block.exerciseId).trains ?? []) out.add(m);
  }
  for (const [m, sets] of Object.entries(muscleLoad(program, dayKey))) {
    if (sets >= heavySets) out.add(m);
  }
  return out;
}

/** Muscles two lift days share at a meaningful dose. */
export function sharedMuscles(program, dayA, dayB, opts) {
  const a = musclesWorked(program, dayA, opts);
  return [...musclesWorked(program, dayB, opts)].filter((m) => a.has(m)).sort();
}

/**
 * Would training `candidateDayKey` now repeat muscles trained in the last day?
 *
 * The program template already spaces overlapping days apart, but the schedule
 * is cursor-driven: fall behind and the app hands you the next session whenever
 * you open it, which can compress a 48h gap into 24h. That is a scheduling
 * accident, not a plan, so it is worth flagging rather than silently serving.
 *
 * Consecutive-day training is not itself harmful — a volume-matched RCT found
 * 24h vs 48–72h recovery made no difference to strength or hypertrophy. The
 * reason to care here is narrower: a heavy top set is worth less when the
 * muscle is pre-fatigued, and the top sets are what drive this program's goals.
 *
 * @returns {{muscles:string[], since:object, hoursAgo:number, suggestion:string|null}|null}
 */
export function overlapWarning(sessions, program, candidateDayKey, opts = {}) {
  const { withinHours = 20, now = Date.now(), minSets = 3 } = opts;
  if (!candidateDayKey?.startsWith('lift:')) return null;

  // Asymmetric on purpose: any real work yesterday leaves fatigue, but only work
  // this session actually leans on is worth interrupting you about.
  const candidate = significantMuscles(program, candidateDayKey);
  if (candidate.size === 0) return null;

  const recent = sessions
    .filter((s) => s.kind === 'lift' && s.status === 'completed' && s.dayKey && s.completedAt)
    .map((s) => ({ s, hoursAgo: (now - new Date(s.completedAt).getTime()) / 3_600_000 }))
    .filter((r) => r.hoursAgo >= 0 && r.hoursAgo <= withinHours)
    .sort((a, b) => a.hoursAgo - b.hoursAgo);

  for (const { s, hoursAgo } of recent) {
    if (s.dayKey === candidateDayKey) continue; // repeating a day is a choice, not an accident
    const overlap = [...musclesWorked(program, s.dayKey, { minSets })].filter((m) =>
      candidate.has(m),
    );
    if (overlap.length === 0) continue;

    // Offer the nearest day in the cycle that collides with neither.
    const yesterday = musclesWorked(program, s.dayKey, { minSets });
    const suggestion =
      program.liftCycle.find((k) => {
        if (k === candidateDayKey || k === s.dayKey) return false;
        return ![...significantMuscles(program, k)].some((m) => yesterday.has(m));
      }) ?? null;

    return { muscles: overlap.sort(), since: s, hoursAgo: Math.round(hoursAgo), suggestion };
  }
  return null;
}
