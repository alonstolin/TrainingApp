/**
 * THE PROGRAM — static content. Never written at runtime.
 *
 * Bump `version` on ANY edit. Logged sessions record the version they ran under
 * and freeze their own resolved prescription, so editing this file can never
 * retroactively rewrite training history.
 *
 * Design rationale lives in README.md; the short version:
 *  - Each main lift gets ONE heavy exposure + ONE volume exposure per week (DUP).
 *    Grgic 2018: frequency effects vanish once weekly volume is equated.
 *  - Accessory volume ramps across a 5-week block (4 accumulation + 1 deload),
 *    landing near the top of RP's MAV band in week 4.
 *  - Running long runs progress only when the previous long run was completed,
 *    which enforces the BJSM-2025 "no single-session spike" rule structurally.
 */

export default {
  programId: 'strength-hypertrophy-10k',
  version: 2,
  name: 'Strength · Shoulders & Arms · 10K',

  mesocycleWeeks: 5,
  deloadWeek: 5,
  liftsPerWeek: 4,

  /**
   * Suggested calendar slots, keyed by Date#getDay() (0 = Sunday).
   * These are SUGGESTIONS ONLY — the cursor engine in core/schedule.js is the
   * authority on what you actually owe. Missing a Wednesday never loses a session.
   */
  weekTemplate: {
    1: [{ key: 'lift:B' }],                                             // Mon — Lower
    2: [{ key: 'run:easy' }, { key: 'core' }],                          // Tue — easy Z2 + core
    3: [{ key: 'lift:A' }],                                             // Wed — Upper Push (incline heavy)
    4: [{ key: 'lift:E', optional: true },                              // Thu — the "5th session" slot,
        { key: 'run:easy', optional: true }],                           //       both optional, pick either or rest
    5: [{ key: 'lift:C' }, { key: 'core' }],                            // Fri — Upper Pull (pull-up heavy) + core
    6: [{ key: 'run:long' }, { key: 'core' }],                          // Sat — long run + core
    0: [{ key: 'lift:D' }],                                             // Sun — Shoulders & Arms (OHP heavy)
  },

  /** Order the lift cursor cycles through. Lift E is optional and NOT in the cycle. */
  liftCycle: ['lift:B', 'lift:A', 'lift:C', 'lift:D'],

  /**
   * Mesocycle modulation.
   *  setDelta      — extra sets added to blocks tagged `ramp: true` (delts/arms)
   *  topRpe        — RPE target for main-lift top sets
   *  setMultiplier — deload only: scales every block's set count
   *  loadMultiplier— deload only: scales prescribed loads
   */
  weekModifiers: [
    { week: 1, setDelta: 0, topRpe: 7.5, note: 'Baseline. Establish honest top sets.' },
    { week: 2, setDelta: 1, topRpe: 8, note: 'Volume up on delts and arms.' },
    { week: 3, setDelta: 1, topRpe: 8.5, note: 'Push the top sets.' },
    { week: 4, setDelta: 2, topRpe: 9, note: 'Peak week. Near MRV — expect it to be hard.' },
    {
      week: 5, setDelta: 0, topRpe: 6, setMultiplier: 0.5, loadMultiplier: 0.85,
      deload: true, note: 'DELOAD. Half the sets, 85% load. Do not freelance extra work.',
    },
  ],

  liftDays: {
    B: {
      key: 'lift:B',
      name: 'Lower + Pull Volume',
      short: 'Lower',
      focus: 'Legs, plus the pull-up volume exposure and curls. Neither interferes with legs.',
      blocks: [
        { exerciseId: 'back-squat', scheme: 'double_progression', sets: 3, repMin: 5, repMax: 8, rpeCap: 8, restSec: 180 },
        { exerciseId: 'rdl', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 10, rpeCap: 8, restSec: 150 },
        { exerciseId: 'leg-press', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 120 },
        { exerciseId: 'leg-curl', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 15, rpeCap: 9, restSec: 90 },
        // Trimmed 3→2 to make room for the upper work without a 21-set session.
        { exerciseId: 'calf-raise', scheme: 'double_progression', sets: 2, repMin: 10, repMax: 15, rpeCap: 9, restSec: 75 },
        // Pull volume lives HERE, not on the Shoulders & Arms day. It is the only
        // slot in the cycle that neighbours nothing else pulling: Lower follows
        // Shoulders & Arms (no back work) and precedes Upper Push (no back work),
        // so the heavy pull-up on day C is never within 24h of its volume day.
        {
          exerciseId: 'weighted-pullup', scheme: 'double_progression', tier: 'T2',
          sets: 3, repMin: 6, repMax: 8, rpeCap: 7.5, restSec: 150,
          historyAliasDayKey: 'lift:D',
        },
        {
          exerciseId: 'bayesian-curl', scheme: 'double_progression',
          sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, ramp: true,
          historyAliasDayKey: 'lift:D',
        },
      ],
    },

    A: {
      key: 'lift:A',
      name: 'Upper Push',
      short: 'Push',
      focus: 'Incline bench HEAVY · OHP volume',
      blocks: [
        {
          exerciseId: 'incline-bench', scheme: 'top_backoff', tier: 'T1',
          top: { sets: 1, repMin: 4, repMax: 6 },
          backoff: { sets: 3, reps: 6, pctOfTop: 0.85 },
          restSec: 210,
        },
        { exerciseId: 'ohp', scheme: 'double_progression', tier: 'T2', sets: 3, repMin: 8, repMax: 10, rpeCap: 8, restSec: 150 },
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, ramp: true },
        { exerciseId: 'overhead-cable-tricep', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, ramp: true },
        { exerciseId: 'rope-pushdown', scheme: 'double_progression', sets: 2, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, ramp: true },
      ],
    },

    C: {
      key: 'lift:C',
      name: 'Upper Pull',
      short: 'Pull',
      focus: 'Weighted pull-up HEAVY · back and biceps, all in one day',
      blocks: [
        {
          exerciseId: 'weighted-pullup', scheme: 'top_backoff', tier: 'T1',
          top: { sets: 1, repMin: 4, repMax: 6 },
          backoff: { sets: 3, reps: 6, pctOfTop: 0.85 },
          restSec: 210,
        },
        { exerciseId: 'chest-supported-row', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 120 },
        // Replaces the incline volume that used to sit here. A second vertical
        // pull keeps back volume where the pulling day is, and it does not put
        // chest work next to the Shoulders & Arms day.
        { exerciseId: 'lat-pulldown', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 120 },
        { exerciseId: 'reverse-pec-deck', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, ramp: true },
        { exerciseId: 'incline-db-curl', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 90, ramp: true },
        { exerciseId: 'preacher-curl', scheme: 'double_progression', sets: 2, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, ramp: true },
      ],
    },

    D: {
      key: 'lift:D',
      name: 'Shoulders & Arms',
      short: 'Delts',
      focus: 'OHP HEAVY · incline volume · priority delt + triceps block',
      blocks: [
        {
          exerciseId: 'ohp', scheme: 'top_backoff', tier: 'T1',
          top: { sets: 1, repMin: 4, repMax: 6 },
          backoff: { sets: 3, reps: 6, pctOfTop: 0.85 },
          restSec: 210,
        },
        // Second BARBELL incline exposure, moved here from the Pull day. Incline
        // bench is a named strength goal so it keeps a true heavy/volume DUP
        // split; sitting here rather than on Pull is what removes the back-to-back
        // chest work AND the back-to-back pull-up work in one move.
        {
          exerciseId: 'incline-bench', scheme: 'double_progression', tier: 'T2',
          sets: 3, repMin: 8, repMax: 12, rpeCap: 8, restSec: 150,
          historyAliasDayKey: 'lift:C',
        },
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, ramp: true },
        { exerciseId: 'machine-lateral-raise', scheme: 'double_progression', sets: 2, repMin: 15, repMax: 20, rpeCap: 10, restSec: 60, ramp: true },
        { exerciseId: 'face-pull', scheme: 'double_progression', sets: 3, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60, ramp: true },
        { exerciseId: 'ez-overhead-tricep', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, ramp: true },
      ],
    },

    E: {
      key: 'lift:E',
      name: 'Bonus — Delts & Arms',
      short: 'Bonus',
      optional: true,
      focus: 'Pure priority volume. No heavy work, nothing to failure.',
      blocks: [
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60 },
        { exerciseId: 'reverse-pec-deck', scheme: 'double_progression', sets: 3, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60 },
        { exerciseId: 'bayesian-curl', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 60 },
        { exerciseId: 'rope-pushdown', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 60 },
      ],
    },
  },

  /**
   * RUNNING — 14 weeks, base assumed ~10–15 min continuous.
   *
   * The run week advances only when that week's LONG run is completed or skipped.
   * That is what keeps every long run inside ~110% of the longest run in the
   * previous 30 days (Aarhus/BJSM 2025) even if you miss weeks.
   *
   * Weeks 1–4 are time-based on purpose: chasing distance before you have tissue
   * tolerance is the single most common way beginners get injured.
   */
  runPlan: [
    { week: 1, easy: { kind: 'time', minutes: 20 }, long: { kind: 'time', minutes: 25 } },
    { week: 2, easy: { kind: 'time', minutes: 22 }, long: { kind: 'time', minutes: 30 } },
    { week: 3, easy: { kind: 'time', minutes: 25 }, long: { kind: 'time', minutes: 35 } },
    { week: 4, easy: { kind: 'time', minutes: 20 }, long: { kind: 'time', minutes: 30 }, down: true },
    { week: 5, easy: { kind: 'distance', km: 3.0 }, long: { kind: 'distance', km: 6.0 } },
    { week: 6, easy: { kind: 'distance', km: 3.5 }, long: { kind: 'distance', km: 6.5 } },
    { week: 7, easy: { kind: 'distance', km: 4.0 }, long: { kind: 'distance', km: 7.0 } },
    { week: 8, easy: { kind: 'distance', km: 4.0 }, long: { kind: 'distance', km: 5.0 }, down: true },
    { week: 9, easy: { kind: 'distance', km: 4.0 }, long: { kind: 'distance', km: 7.5 } },
    { week: 10, easy: { kind: 'distance', km: 4.5 }, long: { kind: 'distance', km: 8.0 } },
    { week: 11, easy: { kind: 'distance', km: 4.5 }, long: { kind: 'distance', km: 8.5 } },
    { week: 12, easy: { kind: 'distance', km: 4.0 }, long: { kind: 'distance', km: 6.0 }, down: true },
    { week: 13, easy: { kind: 'distance', km: 5.0 }, long: { kind: 'distance', km: 9.3 } },
    { week: 14, easy: { kind: 'distance', km: 5.0 }, long: { kind: 'distance', km: 10.0 }, goal: true },
  ],

  /** After week 14 the plan holds here — maintain 10K, no further forced progression. */
  runMaintenance: { easy: { kind: 'distance', km: 5.0 }, long: { kind: 'distance', km: 10.0 } },

  /**
   * CORE — three phases gated on completed core sessions, not the calendar.
   * McGill Big 3 first: bracing endurance before any loaded spinal flexion.
   */
  corePhases: [
    {
      phase: 1,
      name: 'Motor control',
      afterSessions: 0,
      note: 'McGill Big 3. Short submaximal holds — quality, never failure.',
      blocks: [
        { exerciseId: 'dead-bug', scheme: 'reps', sets: 3, repMin: 8, repMax: 8, restSec: 45 },
        { exerciseId: 'bird-dog', scheme: 'reps', sets: 3, repMin: 8, repMax: 8, restSec: 45 },
        { exerciseId: 'side-plank', scheme: 'time', sets: 3, seconds: 25, restSec: 45 },
        { exerciseId: 'front-plank', scheme: 'time', sets: 3, seconds: 35, restSec: 45 },
      ],
    },
    {
      phase: 2,
      name: 'Capacity + light load',
      afterSessions: 12, // ~4 weeks at 3x/week
      note: 'Holds lengthen, anti-rotation enters, first hanging work.',
      blocks: [
        { exerciseId: 'front-plank', scheme: 'time', sets: 3, seconds: 60, restSec: 60 },
        { exerciseId: 'side-plank', scheme: 'time', sets: 3, seconds: 45, restSec: 45 },
        { exerciseId: 'pallof-press', scheme: 'reps', sets: 3, repMin: 10, repMax: 12, restSec: 45 },
        { exerciseId: 'hanging-knee-raise', scheme: 'reps', sets: 3, repMin: 8, repMax: 12, restSec: 60 },
        { exerciseId: 'dead-bug', scheme: 'reps', sets: 2, repMin: 10, repMax: 12, restSec: 45 },
      ],
    },
    {
      phase: 3,
      name: 'Loaded',
      afterSessions: 27, // ~9 weeks in
      note: 'Ab wheel is gated on a clean 60s plank. Add load slowly.',
      blocks: [
        { exerciseId: 'ab-wheel', scheme: 'reps', sets: 3, repMin: 6, repMax: 8, restSec: 75 },
        { exerciseId: 'hanging-leg-raise', scheme: 'reps', sets: 3, repMin: 8, repMax: 12, restSec: 75 },
        { exerciseId: 'cable-crunch', scheme: 'weight_reps', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 60 },
        { exerciseId: 'pallof-press', scheme: 'reps', sets: 3, repMin: 10, repMax: 12, restSec: 45 },
        { exerciseId: 'weighted-plank', scheme: 'time', sets: 2, seconds: 45, restSec: 60 },
      ],
    },
  ],
};
