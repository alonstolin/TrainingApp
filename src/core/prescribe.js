/**
 * Turns (program, dayKey, block role, training history) into a concrete session
 * you can actually walk into the gym and execute. DOM-free, pure.
 *
 * The output of this module gets frozen onto every logged session as
 * `prescriptionSnapshot`. That is what lets the program files be edited freely
 * forever without rewriting what past sessions said to do.
 */

import { getExercise } from '../program/exercises.js';
import {
  suggestDoubleProgression,
  suggestTopSet,
  backoffLoad,
  blockReference,
  loadFromReference,
  loadForReps,
  roundToIncrement,
} from './progression.js';

const LEG_MUSCLES = new Set(['quads', 'hamstrings', 'glutes', 'calves']);

/**
 * Week modifier, with safe defaults.
 *
 * v3 programs key modifiers by ROLE ('probe' | 'test' | 'deload'); v2 keyed
 * them by week number. Both are served so old programs still resolve. Callers
 * pass whichever they have — a role string or a week number.
 */
export function weekModifier(program, roleOrWeek) {
  const byRole = program.weekModifiers.some((w) => w.role);
  const m = byRole
    ? program.weekModifiers.find((w) => w.role === roleOrWeek)
    : program.weekModifiers.find((w) => w.week === roleOrWeek);
  return {
    role: byRole ? roleOrWeek : null,
    week: byRole ? null : roleOrWeek,
    setDelta: 0,
    topRpe: 8, // v2 top-set RPE
    probeRpe: 8,
    probeReps: null,
    backoffSets: 3,
    backoffReps: null,
    setMultiplier: 1,
    loadMultiplier: 1, // v2: every load. v3: see accessoryLoadMultiplier.
    accessoryLoadMultiplier: 1,
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

/** Effective accessory load multiplier — v2 has one knob, v3 two. */
const accessoryMultiplier = (mod) => (mod.accessoryLoadMultiplier ?? 1) * (mod.loadMultiplier ?? 1);

/**
 * Day-scoped history lookup for one block.
 *
 * Both lookups are scoped to THIS day. Every main lift appears twice a week
 * under different schemes (heavy day vs volume day), and comparing across them
 * is meaningless in both directions — "last time" has to mean the last time
 * you did this exercise in this role.
 *
 * `historyAliasDayKey` is the migration hatch for moving an exercise between
 * days. Day-scoped lookups would otherwise orphan its history and silently
 * restart it from nothing, which is the exact failure mode that once killed
 * progression on every main lift. The alias is consulted ONLY when the
 * primary lookup is empty, so it retires itself after one session on the
 * new day.
 */
function makeBlockLookup(historyFor, dayKey, block, exerciseId, scope = {}) {
  return (opts) => {
    const own = historyFor?.(exerciseId, { dayKey, ...scope, ...opts }) ?? null;
    const empty = own == null || (Array.isArray(own) && own.length === 0);
    if (!empty || !block.historyAliasDayKey) return own;
    return historyFor?.(exerciseId, { dayKey: block.historyAliasDayKey, ...scope, ...opts }) ?? null;
  };
}

/**
 * Resolve ONE block of a lift day into a prescription entry.
 *
 * Exposed on its own so a substitution or a station change mid-session can
 * re-resolve a single entry against the substitute's own history without
 * touching the rest of the session (see store.reresolveEntry).
 *
 * @param ctx  { dayKey, mod, day, historyFor, bodyweightKg, raceWeek, gymId, order }
 * @param over { exerciseId?, station? } — overrides for substitution / station
 */
export function resolveBlock(program, block, ctx, over = {}) {
  const exerciseId = over.exerciseId ?? block.exerciseId;
  const ex = getExercise(exerciseId);
  const { dayKey, mod, day } = ctx;
  const scope = {};
  if (ctx.gymId != null && ex.gymSpecific) scope.gymId = ctx.gymId;
  if (over.station != null && ex.gymSpecific) scope.station = over.station;
  const lookup = makeBlockLookup(ctx.historyFor, dayKey, block, exerciseId, scope);

  const last = lookup({});
  const basis = lookup({ forProgression: true }) ?? last;
  const scopeNote = last?.scope === 'other' ? ' From another gym — treat it as a guide, not a target.' : '';

  // Race week: legs light. Only blocks whose primary muscle is a leg muscle —
  // pull-ups and curls on the same day are upper-body work and stay intact.
  const legsLight = ctx.raceWeek === 'light' && LEG_MUSCLES.has(ex.muscle);
  const blockMod = legsLight ? { ...mod, setMultiplier: (mod.setMultiplier ?? 1) * 0.5 } : mod;
  const nSets = setCountFor(block, blockMod);
  const toFailure = !!block.lastSetToFailure && !mod.deload && !day?.noFailure && !legsLight;

  const common = {
    order: ctx.order ?? 0,
    exerciseId,
    name: ex.name,
    tier: block.tier ?? null,
    restSec: block.restSec,
    cue: ex.cue,
    perSide: ex.perSide,
    group: block.group ?? null,
    family: block.family ?? null,
    swappedFrom: over.exerciseId && over.exerciseId !== block.exerciseId ? block.exerciseId : null,
    station: over.station ?? null,
    lastTime: last,
    scope: last?.scope ?? null,
  };

  // ---- v3 heavy day: probe + reference back-offs
  if (block.scheme === 'probe_backoff') {
    // A lookup that ignores `all` hands back a single row; tolerate that.
    const got = lookup({ all: true });
    const rowsNewestFirst = Array.isArray(got) ? got : got ? [got] : [];
    const rows = [...rowsNewestFirst].reverse();
    const ref = blockReference(rows, block, ex);
    const bw = ctx.bodyweightKg ?? last?.bodyweightKg ?? null;
    const probeRpe = mod.probeRpe;
    const probeReps = mod.probeReps ?? Math.min(block.probe.repMax, Math.max(block.probe.repMin, 4));
    const nBackoff = Math.max(1, mod.backoffSets ?? block.backoff.sets);
    const pct = block.backoff.pctOfReference;
    const backoffReps =
      mod.backoffReps ??
      (ref.source === 'backoffs' || ref.lastBackoffReps == null
        ? block.backoff.repMin
        : Math.min(block.backoff.repMax, Math.max(block.backoff.repMin, ref.lastBackoffReps + 1)));

    const step = { increment: ref.increment };
    const probeWeight = ref.e1rm == null ? null : loadForReps(ref.e1rm, probeReps, probeRpe, ex, bw, step);
    let backoffWeight = ref.e1rm == null ? null : loadFromReference(ref.e1rm, pct, ex, bw, step);
    // A finer step (after two stalls) rounds the same reference LOWER than the
    // coarser one did. A stall must never hand back a lighter bar, so an
    // unchanged reference keeps the load actually lifted. Pull-ups are exempt:
    // there the belt follows bodyweight, which is the point of system mass.
    if (
      backoffWeight != null &&
      ref.lastBackoffLoad != null &&
      ref.source !== 'backoffs' &&
      ex.loadModel !== 'bodyweight_plus' &&
      ref.lastBackoffLoad > backoffWeight &&
      ref.lastBackoffLoad - backoffWeight <= ex.increment
    ) {
      backoffWeight = ref.lastBackoffLoad;
    }

    const reason =
      ref.e1rm == null
        ? 'First exposure — find an honest 3–5 @ RPE 8. It sets this block\'s reference.'
        : ref.source === 'backoffs'
          ? `All back-offs hit ${block.backoff.repMax} last time — reference up, back-offs up ${ref.increment}${ex.unit}.`
          : ref.source === 'test'
            ? 'Reference set by last block\'s test triple. Probe, then the back-offs do the work.'
            : mod.deload
              ? 'Deload: easy triple, two light back-offs. Same reference, less work.'
              : mod.role === 'test'
                ? 'Test week: one honest triple @ RPE 9. It sets next block\'s reference — it does not raise today\'s back-offs.'
                : `Probe @ RPE ${probeRpe}, then ${nBackoff}×${block.backoff.repMin}–${block.backoff.repMax} at ${Math.round(pct * 100)}% of reference.`;

    const planned = [
      {
        type: 'probe',
        targetRepMin: mod.probeReps ?? block.probe.repMin,
        targetRepMax: mod.probeReps ?? block.probe.repMax,
        targetReps: probeReps,
        rpeTarget: probeRpe,
        weightKg: probeWeight,
      },
      ...Array.from({ length: nBackoff }, () => ({
        type: 'backoff',
        targetRepMin: block.backoff.repMin,
        targetRepMax: block.backoff.repMax,
        targetReps: backoffReps,
        rpeTarget: null,
        weightKg: backoffWeight,
        // Filled from today's probe when there is no reference yet; recomputed
        // when a probe at ≤ RPE 8 beats the reference (store.logSet).
        derivedFromReference: true,
        pctOfReference: pct,
      })),
    ];

    const probeLabel =
      mod.probeReps != null
        ? `Probe 1×${mod.probeReps} @ RPE ${probeRpe}`
        : `Probe 1×${block.probe.repMin}–${block.probe.repMax} @ RPE ${probeRpe}`;
    const boLabel =
      mod.backoffReps != null
        ? `${nBackoff}×${mod.backoffReps}`
        : `${nBackoff}×${block.backoff.repMin}–${block.backoff.repMax}`;

    return {
      ...common,
      scheme: 'probe_backoff',
      label: `${probeLabel}, then ${boLabel} @ ${Math.round(pct * 100)}% of reference`,
      suggestion: reason + scopeNote,
      reference: ref.e1rm == null ? null : { e1rm: Math.round(ref.e1rm * 10) / 10, source: ref.source, date: ref.date, pct },
      plannedSets: planned,
    };
  }

  // ---- v2 heavy day (kept so old programs resolve)
  if (block.scheme === 'top_backoff') {
    const progressionRpe = mod.deload
      ? Math.max(...program.weekModifiers.filter((w) => !w.deload).map((w) => w.topRpe ?? 8))
      : mod.topRpe;
    const lastTop = basis?.sets?.find((s) => s.type === 'top' && s.done) ?? null;
    const sugg = suggestTopSet(lastTop, block, ex, progressionRpe);
    const topWeight =
      sugg.weightKg == null ? null : roundToIncrement(sugg.weightKg * mod.loadMultiplier, ex.increment);
    const nBackoff = Math.max(1, Math.round(block.backoff.sets * (mod.setMultiplier ?? 1)));
    return {
      ...common,
      scheme: 'top_backoff',
      label: `Top set ${block.top.repMin}–${block.top.repMax} @ RPE ${mod.topRpe}, then ${nBackoff}×${block.backoff.reps} @ ${Math.round(block.backoff.pctOfTop * 100)}%`,
      suggestion: sugg.reason,
      plannedSets: [
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
          weightKg: topWeight == null ? null : backoffLoad(topWeight, block.backoff.pctOfTop, ex),
          derivedFromTop: true,
          pctOfTop: block.backoff.pctOfTop,
        })),
      ],
    };
  }

  // ---- timed holds and carries (core work attached to a lift day)
  if (block.scheme === 'time' || block.scheme === 'weight_time') {
    const loaded = block.scheme === 'weight_time';
    const lastSets = (basis?.sets ?? []).filter((s) => s.done);
    const lastLoad = loaded ? Math.max(0, ...lastSets.map((s) => s.weightKg ?? 0)) || null : undefined;
    const seconds = block.seconds;
    return {
      ...common,
      scheme: block.scheme,
      label: `${nSets} × ${seconds}s${ex.perSide ? ' each side' : ''}${loaded && lastLoad ? ` @ ${lastLoad}${ex.unit}` : ''}`,
      suggestion: loaded && !lastLoad ? 'Pick a load you can carry tall for the full time.' : '',
      plannedSets: Array.from({ length: nSets }, () => ({
        type: 'work',
        targetSeconds: seconds,
        targetReps: null,
        weightKg: loaded ? lastLoad : undefined,
      })),
    };
  }

  // ---- bodyweight reps (core work with no load field)
  if (block.scheme === 'reps') {
    const lastSets = (basis?.sets ?? []).filter((s) => s.done && s.reps);
    const worst = lastSets.length ? Math.min(...lastSets.map((s) => s.reps)) : null;
    const target = worst == null ? block.repMin : Math.min(block.repMax, worst + 1);
    return {
      ...common,
      scheme: 'reps',
      label: `${nSets} × ${block.repMin}${block.repMax !== block.repMin ? `–${block.repMax}` : ''}${ex.perSide ? ' each side' : ''}`,
      suggestion: worst == null ? '' : worst >= block.repMax ? 'Top of the range — make it harder (longer lever, slower, or the next progression).' : `Chase ${target} clean reps.`,
      plannedSets: Array.from({ length: nSets }, () => ({
        type: 'work',
        targetRepMin: block.repMin,
        targetRepMax: block.repMax,
        targetReps: target,
        targetSeconds: null,
        weightKg: undefined,
      })),
    };
  }

  // ---- double_progression (accessories, volume days, loaded core)
  const sugg = suggestDoubleProgression(basis?.sets, block, ex);
  const weight =
    sugg.weightKg == null ? null : roundToIncrement(sugg.weightKg * accessoryMultiplier(mod), ex.increment);
  const rpeCap = legsLight ? Math.min(block.rpeCap ?? 9, 6) : block.rpeCap;

  const planned = Array.from({ length: nSets }, () => ({
    type: 'work',
    targetRepMin: block.repMin,
    targetRepMax: block.repMax,
    targetReps: sugg.reps,
    rpeTarget: rpeCap ?? null,
    weightKg: weight,
  }));
  // The last set of each priority accessory goes to RPE 10 (Refalo 2024; the
  // Enes JAP 2024 protocol) — never on a deload, never on the bonus day.
  if (toFailure) planned[planned.length - 1].rpeTarget = 10;

  return {
    ...common,
    scheme: block.scheme ?? 'double_progression',
    label:
      `${nSets} × ${block.repMin}–${block.repMax}` +
      (rpeCap ? ` @ RPE ≤${rpeCap}` : '') +
      (toFailure ? ' · last set to 10' : '') +
      (legsLight ? ' · race week: light' : ''),
    suggestion: sugg.reason + scopeNote,
    plannedSets: planned,
  };
}

/** The core phase for a completed-session count. */
export function corePhaseFor(program, coreSessionsCompleted) {
  const phases = program.core?.phases ?? program.corePhases ?? [];
  return [...phases].reverse().find((p) => (coreSessionsCompleted ?? 0) >= p.afterSessions) ?? phases[0];
}

/**
 * Resolve one lift day.
 *
 * @param ctx { role?, weekInMeso?, historyFor, coreCompleted?, bodyweightKg?, raceWeek?, gymId?, substitutions? }
 *            Legacy form (weekInMeso:number, historyFor:fn) is still accepted.
 */
export function resolveLiftSession(program, dayKey, ctxOrWeek, legacyHistoryFor) {
  const ctx =
    typeof ctxOrWeek === 'object' && ctxOrWeek !== null
      ? ctxOrWeek
      : { weekInMeso: ctxOrWeek, historyFor: legacyHistoryFor };

  const letter = dayKey.split(':')[1];
  const day = program.liftDays[letter];
  if (!day) throw new Error(`Unknown lift day: ${dayKey}`);

  const byRole = program.weekModifiers.some((w) => w.role);
  const mod = weekModifier(program, byRole ? (ctx.role ?? 'probe') : ctx.weekInMeso);

  const blockCtx = {
    dayKey,
    mod,
    day,
    historyFor: ctx.historyFor,
    bodyweightKg: ctx.bodyweightKg ?? null,
    raceWeek: ctx.raceWeek ?? null,
    gymId: ctx.gymId ?? null,
  };
  const subs = ctx.gymId != null ? (ctx.substitutions?.[ctx.gymId] ?? {}) : {};

  const entries = day.blocks.map((block, i) =>
    resolveBlock(program, block, { ...blockCtx, order: i }, subs[block.exerciseId] ? { exerciseId: subs[block.exerciseId] } : {}),
  );

  // Core rides at the end of the two shortest gym days (SYNTHESIS §5.4).
  if (program.core?.attachTo?.includes(dayKey)) {
    const phase = corePhaseFor(program, ctx.coreCompleted ?? 0);
    let order = entries.length;
    for (const block of phase.blocks) {
      entries.push(
        resolveBlock(
          program,
          { ...block, group: 'core' },
          { ...blockCtx, order: order++ },
          subs[block.exerciseId] ? { exerciseId: subs[block.exerciseId] } : {},
        ),
      );
    }
  }

  const allowed = !day.allowedRoles || !mod.role || day.allowedRoles.includes(mod.role);

  return {
    kind: 'lift',
    dayKey,
    name: day.name,
    focus: day.focus,
    optional: !!day.optional,
    allowedThisWeek: allowed,
    role: mod.role,
    weekInMeso: ctx.weekInMeso ?? null,
    isDeload: !!mod.deload,
    weekNote: mod.note,
    raceWeek: ctx.raceWeek ?? null,
    gymId: ctx.gymId ?? null,
    corePhase: program.core?.attachTo?.includes(dayKey) ? corePhaseFor(program, ctx.coreCompleted ?? 0).phase : null,
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
    spec.kind === 'time'
      ? `${spec.minutes} min easy`
      : `${spec.km} km${spec.strides ? ` + ${spec.strides}` : ''}`;

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
    strides: spec.strides ?? null,
    focus: spec.strides
      ? 'Easy, then the strides: relaxed and fast, full recovery between. Intensity keeps the endurance.'
      : variant === 'long'
        ? 'Talk Test all the way — a full sentence without a breath pause. The distance is the stimulus, not the pace.'
        : 'CR10 effort 3–4. If you cannot talk in full sentences, walk 60 s and resume slower.',
    note: plan.down
      ? 'Down week — deliberately easier. Do not top it up.'
      : plan.goal
        ? 'Goal session. This is the 10K.'
        : '',
  };
}

/** Resolve a standalone core session for the current phase. */
export function resolveCoreSession(program, coreSessionsCompleted) {
  const phase = corePhaseFor(program, coreSessionsCompleted);
  const mod = { setMultiplier: 1, loadMultiplier: 1, accessoryLoadMultiplier: 1, deload: false };

  // Core schemes are 'reps' | 'time' | 'weight_reps' | 'weight_time'. All go
  // through resolveBlock so the standalone and attached paths cannot drift.
  const entries = phase.blocks.map((block, i) =>
    resolveBlock(program, { ...block, group: 'core' }, { dayKey: 'core', mod, day: null, historyFor: null, order: i }),
  );

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
    return resolveLiftSession(program, dayKey, ctx);
  }
  if (dayKey.startsWith('run:')) {
    return resolveRunSession(program, dayKey.split(':')[1], ctx.runWeek);
  }
  if (dayKey === 'core') {
    return resolveCoreSession(program, ctx.coreCompleted);
  }
  throw new Error(`Unknown session key: ${dayKey}`);
}
