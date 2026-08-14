/**
 * Calendar projection. DOM-free, pure.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 * --------------------------------
 * The program is cursor-driven: your position advances when you train, not when
 * the clock ticks (see core/schedule.js). So a future date has no fixed session
 * attached to it — only a PROJECTION of what would land there if you keep to the
 * weekly template from here on.
 *
 * That distinction is the whole design constraint of this module. Past days are
 * facts, read from the log. Future days are forecasts, simulated forward from
 * today's cursors, and every entry is labelled `projected` so the UI can never
 * present a guess as a commitment. Miss one Wednesday and the forecast shifts by
 * a session — which is correct behaviour, not drift.
 */

import { addDays, dayOfWeek, daysBetween, trainingDate, startOfWeek } from './dates.js';
import { deriveCursors } from './schedule.js';

const trackOf = (key) =>
  key.startsWith('lift:') ? 'lift' : key.startsWith('run:') ? 'run' : 'core';

/** Human labels for a slot key, without resolving the whole session. */
export function slotLabel(program, key, ctx = {}) {
  if (key.startsWith('lift:')) {
    const day = program.liftDays[key.split(':')[1]];
    return { name: day?.name ?? key, short: day?.short ?? '?', focus: day?.focus ?? '' };
  }
  if (key === 'run:long') {
    const wk = program.runPlan.find((w) => w.week === ctx.runWeek);
    const spec = wk?.long ?? program.runMaintenance.long;
    const target = spec.kind === 'time' ? `${spec.minutes} min` : `${spec.km} km`;
    return { name: 'Long Run', short: 'Long', focus: target, target, isGoal: !!wk?.goal, isDown: !!wk?.down };
  }
  if (key === 'run:easy') {
    const wk = program.runPlan.find((w) => w.week === ctx.runWeek);
    const spec = wk?.easy ?? program.runMaintenance.easy;
    const target = spec.kind === 'time' ? `${spec.minutes} min` : `${spec.km} km`;
    return { name: 'Easy Run', short: 'Easy', focus: target, target, isDown: !!wk?.down };
  }
  if (key === 'core') {
    const phase =
      [...program.corePhases].reverse().find((p) => (ctx.coreCompleted ?? 0) >= p.afterSessions) ??
      program.corePhases[0];
    return { name: `Core — Phase ${phase.phase}`, short: 'Core', focus: phase.name, phase: phase.phase };
  }
  return { name: key, short: '?', focus: '' };
}

/** Mesocycle week and block from a completed-lift count. */
function mesoAt(program, liftCompleted) {
  const perBlock = program.liftsPerWeek * program.mesocycleWeeks;
  return {
    mesocycle: Math.floor(liftCompleted / perBlock) + 1,
    weekInMeso: (Math.floor(liftCompleted / program.liftsPerWeek) % program.mesocycleWeeks) + 1,
  };
}

/**
 * Build a day-by-day plan.
 *
 * @param {{sessions:Array, meta:Object}} state
 * @param {{from:string, to:string, today?:string, includeOptional?:boolean}} range
 * @returns {Array<{date, dow, isToday, isPast, entries:Array, hasWork:boolean}>}
 *
 * Each entry is either:
 *   { status:'completed'|'skipped'|'in_progress', session, ... }  — a fact
 *   { status:'missed', ... }                                       — a scheduled slot no session filled
 *   { status:'projected', ... }                                    — a forecast
 */
export function buildCalendar(state, program, range) {
  const today = range.today ?? trainingDate();
  const from = range.from;
  const to = range.to;
  const includeOptional = range.includeOptional ?? true;

  // Index actual sessions by date.
  const byDate = new Map();
  for (const s of state.sessions ?? []) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }

  // Forward simulation starts from where the cursors actually are right now.
  const cursors = deriveCursors(state.sessions ?? [], program);
  const sim = {
    liftPos: cursors.lift.position,
    liftCompleted: cursors.lift.completed,
    longCompleted: cursors.run.longCompleted,
    coreCompleted: cursors.core.completed,
  };

  // Anything already settled TODAY has consumed today's slots, so the forecast
  // must not offer them again — same track-budget logic the Today screen uses.
  const settledToday = (byDate.get(today) ?? []).filter(
    (s) => s.status === 'completed' || s.status === 'skipped',
  );

  const days = [];
  const span = daysBetween(from, to);
  if (span < 0) return days;

  for (let i = 0; i <= Math.min(span, 800); i++) {
    const date = addDays(from, i);
    const dow = dayOfWeek(date);
    const slots = (program.weekTemplate[dow] ?? []).filter((s) => includeOptional || !s.optional);
    const actual = byDate.get(date) ?? [];
    const isPast = date < today;
    const isToday = date === today;

    const entries = [];

    // ---- facts: everything actually logged on this date
    for (const s of actual) {
      const label = slotLabel(program, s.dayKey ?? s.kind, {
        runWeek: s.programRef?.runWeek,
        coreCompleted: 0,
      });
      entries.push({
        status: s.status,
        track: s.kind,
        key: s.dayKey,
        name: s.prescriptionSnapshot?.name ?? label.name,
        short: label.short,
        detail:
          s.kind === 'run' && s.run?.distanceKm
            ? `${s.run.distanceKm} km`
            : s.status === 'skipped'
              ? 'skipped'
              : (s.prescriptionSnapshot?.focus ?? ''),
        sessionId: s.id,
        projected: false,
      });
    }

    if (isPast) {
      // A scheduled slot with nothing logged against that track is a miss. Shown
      // faintly rather than hidden — the cursor already moved on, but seeing the
      // gap is the point of looking back at a calendar.
      const doneTracks = actual.map((s) => s.kind);
      for (const slot of slots) {
        if (slot.optional) continue;
        const track = trackOf(slot.key);
        const idx = doneTracks.indexOf(track);
        if (idx >= 0) {
          doneTracks.splice(idx, 1);
          continue;
        }
        const label = slotLabel(program, slot.key, {});
        entries.push({
          status: 'missed',
          track,
          key: slot.key,
          name: label.name,
          short: label.short,
          detail: 'not logged',
          projected: false,
        });
      }
    } else {
      // ---- forecast: today's remaining slots, then every future day
      const budget = isToday ? settledToday.map((s) => s.kind) : [];

      for (const slot of slots) {
        const track = trackOf(slot.key);

        if (isToday) {
          const idx = budget.indexOf(track);
          if (idx >= 0) {
            budget.splice(idx, 1);
            continue; // already done today; the fact above covers it
          }
        }

        // Optional slots never advance the simulation — taking the bonus day must
        // not shift the rest of the plan.
        if (slot.optional) {
          const label = slotLabel(program, slot.key, { runWeek: sim.longCompleted + 1, coreCompleted: sim.coreCompleted });
          entries.push({
            status: 'projected', track, key: slot.key, optional: true,
            name: label.name, short: label.short, detail: label.focus, projected: true,
          });
          continue;
        }

        let key = slot.key;
        let ctx = {};
        let extra = {};

        if (track === 'lift') {
          key = program.liftCycle[sim.liftPos % program.liftCycle.length];
          const m = mesoAt(program, sim.liftCompleted);
          extra = { ...m, isDeload: m.weekInMeso === program.deloadWeek };
          sim.liftPos++;
          sim.liftCompleted++;
        } else if (track === 'run') {
          ctx = { runWeek: sim.longCompleted + 1 };
          extra = { runWeek: ctx.runWeek };
          if (key === 'run:long') sim.longCompleted++;
        } else {
          ctx = { coreCompleted: sim.coreCompleted };
          sim.coreCompleted++;
        }

        const label = slotLabel(program, key, ctx);
        entries.push({
          status: 'projected',
          track,
          key,
          name: label.name,
          short: label.short,
          detail: label.focus,
          projected: true,
          ...extra,
          ...(label.isGoal ? { isGoal: true } : {}),
          ...(label.isDown ? { isDown: true } : {}),
        });
      }
    }

    days.push({
      date,
      dow,
      isToday,
      isPast,
      entries,
      hasWork: entries.some((e) => !e.optional),
    });
  }

  return days;
}

/**
 * When does the 10K land, if the plan is followed from here?
 * Returns null once it has already been run.
 */
export function projectGoalDate(state, program, today = trainingDate()) {
  const goalWeek = program.runPlan[program.runPlan.length - 1];
  const cursors = deriveCursors(state.sessions ?? [], program);
  if (cursors.run.longCompleted >= program.runPlan.length) return null;

  const days = buildCalendar(state, program, {
    from: today,
    to: addDays(today, 400),
    today,
    includeOptional: false,
  });

  for (const day of days) {
    const goal = day.entries.find((e) => e.projected && e.isGoal);
    if (goal) {
      return { date: day.date, km: goalWeek.long.km, weeksAway: Math.ceil(daysBetween(today, day.date) / 7) };
    }
  }
  return null;
}

/** The fixed weekly rhythm, for the "your week" summary. */
export function weekPattern(program) {
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday-first
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return order.map((dow) => {
    const slots = program.weekTemplate[dow] ?? [];
    return {
      dow,
      day: names[dow],
      initial: names[dow][0],
      slots: slots.map((s) => {
        const label = slotLabel(program, s.key, {});
        return { key: s.key, track: trackOf(s.key), short: label.short, name: label.name, optional: !!s.optional };
      }),
      isRest: slots.every((s) => s.optional),
    };
  });
}

/** Calendar-grid scaffolding for a month: leading blanks then each day. */
export function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const pad = (n) => String(n).padStart(2, '0');
  const dates = [];
  for (let d = 1; d <= last.getDate(); d++) {
    dates.push(`${year}-${pad(month + 1)}-${pad(d)}`);
  }
  return { lead, dates, first: dates[0], last: dates[dates.length - 1] };
}

export { startOfWeek };
