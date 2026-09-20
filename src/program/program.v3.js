/**
 * THE PROGRAM, version 3 — static content. Never written at runtime.
 *
 * Bump `version` on ANY edit. Logged sessions record the version they ran under
 * and freeze their own resolved prescription, so editing this file can never
 * retroactively rewrite training history.
 *
 * v3 is the outcome of the research pass in research/SYNTHESIS.md (revision 2,
 * reviewed). Every non-obvious number below cites the section it comes from.
 * The short version of what changed from v2:
 *  - Heavy days invert: the top set is a PROBE (1×3–5 @ RPE 8); the stimulus is
 *    3×4–6 at 80% of a block-reference e1RM, never derived from today's top set
 *    (§1.1 — Androulakis-Korakakis 2021, Carroll 2019).
 *  - Volume days are 3×6–8 (§1.2). Progression triggers are fixed, not rising
 *    weekly (§1.3 — Robinson 2024).
 *  - Accessory volume is FLAT, ~8–10 direct sets per priority muscle per week,
 *    RPE 8–9 with the last set of each isolation exercise to RPE 10 (§2.1, §2.2).
 *  - Legs to maintenance with one unilateral pattern kept (§2.4).
 *  - Mesocycles are 4 weeks (3 + deload) aligned to the running down-weeks until
 *    the 10K, 5 weeks after (§4.4). Week roles, not week numbers, drive the
 *    modifiers — see weekModifiers.
 *  - Run ladder from 5.5 km in ≤ 9% steps with down weeks (§3.2); spike guard at
 *    1.10 (§3.1); every run logs CR10 effort and the Talk Test (§3.3).
 *  - Core is loaded, cable/bench based, and lives at the END of Lower and Push —
 *    the two shortest gym days — because the mat programme was skipped (§5.4).
 */

export default {
  programId: 'strength-hypertrophy-10k',
  version: 3,
  name: 'Strength · Shoulders & Arms · 10K',

  liftsPerWeek: 4,
  /**
   * Block structure. During the 10K build the lifting week is derived from the
   * running calendar so lifting deloads land on the running down-weeks; after
   * the build (and whenever running stops for ≥ 14 days) a lift-count clock
   * takes over. See mesoState() in core/schedule.js.
   */
  blocks: {
    build: { deloadOnRunWeeks: [4, 8, 12, 16], minLoadingWeeks: 2, fallbackWeeks: 4 },
    post: { weeks: 5 },
    /** No long run for this many days → the run-derived clock is stale. */
    staleLongRunDays: 14,
  },
  /** Kept for readers that want a nominal block length; the real one is derived. */
  mesocycleWeeks: 4,

  /**
   * Suggested calendar slots, keyed by Date#getDay() (0 = Sunday).
   * SUGGESTIONS ONLY — the cursor engine in core/schedule.js is the authority
   * on what you actually owe. Unchanged from v2: the rotation proposed during
   * research rested on a misread study and was withdrawn (§4.3); the Tuesday
   * question is answered from logged run effort after one block.
   */
  weekTemplate: {
    1: [{ key: 'lift:B' }],                                             // Mon — Lower (+ core)
    2: [{ key: 'run:easy' }],                                           // Tue — easy run
    3: [{ key: 'lift:A' }],                                             // Wed — Upper Push (+ core)
    4: [{ key: 'lift:E', optional: true },                              // Thu — optional slot; rest by
        { key: 'run:easy', optional: true }],                           //       default in test weeks
    5: [{ key: 'lift:C' }],                                             // Fri — Upper Pull
    6: [{ key: 'run:long' }, { key: 'core', optional: true }],          // Sat — long run (+ optional core)
    0: [{ key: 'lift:D' }],                                             // Sun — Shoulders & Triceps
  },

  /** Order the lift cursor cycles through. Lift E is optional and NOT in the cycle. */
  liftCycle: ['lift:B', 'lift:A', 'lift:C', 'lift:D'],

  /** Thursday's optional slots read as "rest" unless opted into (§3.5). */
  thursdayRestWhen: { role: 'test', longRunKm: 8 },

  /**
   * Week modifiers by ROLE (§5.1, §5.2). A block is [probe, probe, …, test, deload].
   *  probeRpe                — RPE of the heavy-day probe set
   *  backoffSets             — back-off sets on the heavy day (deload drops to 2)
   *  setMultiplier           — deload only: halves every block's set count
   *  accessoryLoadMultiplier — deload only: 90% on accessories. Main lifts keep
   *                            80% of reference and cut sets/effort instead —
   *                            applying 0.9 there too would be 72% for 4 reps,
   *                            RPE ~2, a warm-up (reviewer, §5.2).
   */
  weekModifiers: [
    { role: 'probe', probeRpe: 8, backoffSets: 3, note: 'Probe 3–5 @ RPE 8, then 3×4–6 at 80% of the block reference.' },
    { role: 'test', probeRpe: 9, probeReps: 3, backoffSets: 3, note: 'Test week: one honest triple @ RPE 9 sets next block\'s reference. Thursday is rest.' },
    {
      role: 'deload', probeRpe: 6, probeReps: 3, backoffSets: 2, backoffReps: 4,
      setMultiplier: 0.5, accessoryLoadMultiplier: 0.9, deload: true,
      note: 'DELOAD. Half the sets, main lifts stay at 80% of reference for 2×4, accessories at 90%. Do not freelance extra work.',
    },
  ],

  liftDays: {
    B: {
      key: 'lift:B',
      name: 'Lower + Pull Volume',
      short: 'Lower',
      focus: 'Pull-up volume first, legs at maintenance, curls, then core.',
      blocks: [
        // Pull-ups FIRST — after squats they lose reps, and squats do not need
        // the pull-ups out of the way (§2.4).
        { exerciseId: 'weighted-pullup', scheme: 'double_progression', tier: 'T2', sets: 3, repMin: 5, repMax: 8, rpeCap: 8, restSec: 150 },
        { exerciseId: 'back-squat', scheme: 'double_progression', sets: 3, repMin: 5, repMax: 8, rpeCap: 8, restSec: 180 },
        { exerciseId: 'split-squat', scheme: 'double_progression', sets: 2, repMin: 8, repMax: 12, rpeCap: 8, restSec: 120 },
        { exerciseId: 'rdl', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 10, rpeCap: 8, restSec: 150 },
        { exerciseId: 'bayesian-curl', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, lastSetToFailure: true },
        { exerciseId: 'calf-raise', scheme: 'double_progression', sets: 2, repMin: 10, repMax: 15, rpeCap: 9, restSec: 75 },
      ],
    },

    A: {
      key: 'lift:A',
      name: 'Upper Push',
      short: 'Push',
      focus: 'Incline HEAVY · OHP volume · side delts and triceps, then core.',
      blocks: [
        {
          exerciseId: 'incline-bench', scheme: 'probe_backoff', tier: 'T1',
          probe: { repMin: 3, repMax: 5 },
          backoff: { sets: 3, repMin: 4, repMax: 6, pctOfReference: 0.8 },
          restSec: 210,
        },
        { exerciseId: 'ohp', scheme: 'double_progression', tier: 'T2', sets: 3, repMin: 6, repMax: 8, rpeCap: 8, restSec: 150 },
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, lastSetToFailure: true },
        { exerciseId: 'overhead-cable-tricep', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, lastSetToFailure: true },
        { exerciseId: 'rope-pushdown', scheme: 'double_progression', sets: 2, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, lastSetToFailure: true },
      ],
    },

    C: {
      key: 'lift:C',
      name: 'Upper Pull',
      short: 'Pull',
      focus: 'Weighted pull-up HEAVY · back, rear delts and biceps.',
      blocks: [
        {
          exerciseId: 'weighted-pullup', scheme: 'probe_backoff', tier: 'T1',
          probe: { repMin: 3, repMax: 5 },
          backoff: { sets: 3, repMin: 4, repMax: 6, pctOfReference: 0.8 },
          restSec: 210,
        },
        { exerciseId: 'chest-supported-row', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 120 },
        { exerciseId: 'lat-pulldown', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 120 },
        { exerciseId: 'reverse-pec-deck', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, lastSetToFailure: true },
        { exerciseId: 'incline-db-curl', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 90, lastSetToFailure: true },
        { exerciseId: 'preacher-curl', scheme: 'double_progression', sets: 2, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, lastSetToFailure: true },
      ],
    },

    D: {
      key: 'lift:D',
      // Renamed from "Shoulders & Arms": since v2 this day has been OHP heavy,
      // incline volume, delts and triceps — a push day — and the biceps live on
      // Lower and Pull. The title now says what the session is.
      name: 'Shoulders & Triceps',
      short: 'Delts',
      focus: 'OHP HEAVY · incline volume · priority delt and triceps block.',
      blocks: [
        {
          exerciseId: 'ohp', scheme: 'probe_backoff', tier: 'T1',
          probe: { repMin: 3, repMax: 5 },
          backoff: { sets: 3, repMin: 4, repMax: 6, pctOfReference: 0.8 },
          restSec: 210,
        },
        {
          exerciseId: 'incline-bench', scheme: 'double_progression', tier: 'T2',
          sets: 3, repMin: 6, repMax: 8, rpeCap: 8, restSec: 150,
          historyAliasDayKey: 'lift:C',
        },
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75, lastSetToFailure: true },
        { exerciseId: 'machine-lateral-raise', scheme: 'double_progression', sets: 2, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60, lastSetToFailure: true },
        { exerciseId: 'face-pull', scheme: 'double_progression', sets: 3, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60, lastSetToFailure: true },
        { exerciseId: 'ez-overhead-tricep', scheme: 'double_progression', sets: 3, repMin: 10, repMax: 12, rpeCap: 9, restSec: 90, lastSetToFailure: true },
      ],
    },

    E: {
      key: 'lift:E',
      name: 'Bonus — Delts & Arms',
      short: 'Bonus',
      optional: true,
      // Two sets each, nothing to failure, probe weeks only: a low-fatigue third
      // exposure that must not push the week past the 12–16 fractional band (§5.5).
      allowedRoles: ['probe'],
      noFailure: true,
      focus: 'Low-fatigue third exposure. Two sets each, nothing to failure, probe weeks only.',
      blocks: [
        { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 2, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60 },
        { exerciseId: 'reverse-pec-deck', scheme: 'double_progression', sets: 2, repMin: 15, repMax: 20, rpeCap: 9, restSec: 60 },
        { exerciseId: 'bayesian-curl', scheme: 'double_progression', sets: 2, repMin: 12, repMax: 15, rpeCap: 9, restSec: 60 },
        { exerciseId: 'rope-pushdown', scheme: 'double_progression', sets: 2, repMin: 12, repMax: 15, rpeCap: 9, restSec: 60 },
      ],
    },
  },

  /**
   * RUNNING — 15 weeks to the 10K (§3.2).
   *
   * The run week advances only when that week's LONG run is completed. Weeks
   * 1–4 are the time-based base already run. From week 5 every step is ≤ 9% of
   * the 30-day longest (Frandsen 2025: > 10% carried HRR 1.64), three steps then
   * a down week at ~80–85% so no weekly total rises > 20% (Nielsen 2014). Easy
   * runs stay time-based throughout — a time cap self-limits if you slow down.
   */
  runPlan: [
    { week: 1, easy: { kind: 'time', minutes: 20 }, long: { kind: 'time', minutes: 25 } },
    { week: 2, easy: { kind: 'time', minutes: 22 }, long: { kind: 'time', minutes: 30 } },
    { week: 3, easy: { kind: 'time', minutes: 25 }, long: { kind: 'time', minutes: 35 } },
    { week: 4, easy: { kind: 'time', minutes: 20 }, long: { kind: 'time', minutes: 30 }, down: true },
    { week: 5, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 5.5 } },
    { week: 6, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 6.0 } },
    { week: 7, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 6.5 } },
    { week: 8, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 5.5 }, down: true },
    { week: 9, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 7.0 } },
    { week: 10, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 7.5 } },
    { week: 11, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 8.0 } },
    { week: 12, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 6.5 }, down: true },
    { week: 13, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 8.5 } },
    { week: 14, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 9.3 } },
    { week: 15, easy: { kind: 'time', minutes: 30 }, long: { kind: 'distance', km: 10.0 }, goal: true },
  ],

  /**
   * After the 10K (§3.7): one 7–8 km easy run and one 4–5 km with strides, about
   * 12 km/week. Intensity, not distance, maintains endurance. Strides only after
   * ~3 months of consistent running.
   */
  runMaintenance: {
    easy: { kind: 'distance', km: 4.5, strides: '6–8 × 20–30 s strides' },
    long: { kind: 'distance', km: 7.5 },
  },

  /**
   * CORE (§5.4) — loaded, three movement families plus gym-based foot work,
   * appended to the END of Lower and Push. Phases gate on completed core
   * sessions (0 / 8 / 16), not the calendar. A standalone session after the long
   * run is optional and uses the same phase.
   */
  core: {
    attachTo: ['lift:B', 'lift:A'],
    phases: [
      {
        phase: 1,
        name: 'Load the trunk',
        afterSessions: 0,
        note: 'Anti-flexion, anti-rotation, anti-lateral — one each, plus foot work. Double progression.',
        blocks: [
          { family: 'anti-extension', exerciseId: 'cable-crunch', scheme: 'weight_reps', sets: 2, repMin: 10, repMax: 15, rpeCap: 9, restSec: 45 },
          { family: 'anti-rotation', exerciseId: 'pallof-press', scheme: 'weight_reps', sets: 2, repMin: 8, repMax: 12, rpeCap: 9, restSec: 45 },
          { family: 'anti-lateral', exerciseId: 'suitcase-carry', scheme: 'weight_time', sets: 2, seconds: 40, restSec: 45 },
          { family: 'foot', exerciseId: 'single-leg-calf-raise', scheme: 'reps', sets: 2, repMin: 10, repMax: 12, restSec: 30 },
          { family: 'foot', exerciseId: 'single-leg-balance', scheme: 'time', sets: 2, seconds: 30, restSec: 20 },
        ],
      },
      {
        phase: 2,
        name: 'Longer levers',
        afterSessions: 8,
        note: 'Full-ROM rollouts, woodchops, Copenhagen at knee level.',
        blocks: [
          { family: 'anti-extension', exerciseId: 'ab-wheel', scheme: 'reps', sets: 3, repMin: 6, repMax: 10, restSec: 60 },
          { family: 'anti-rotation', exerciseId: 'cable-woodchop', scheme: 'weight_reps', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 45 },
          { family: 'anti-lateral', exerciseId: 'copenhagen-plank', scheme: 'reps', sets: 2, repMin: 6, repMax: 10, restSec: 45 },
          { family: 'foot', exerciseId: 'single-leg-calf-raise', scheme: 'reps', sets: 2, repMin: 10, repMax: 12, restSec: 30 },
          { family: 'foot', exerciseId: 'single-leg-balance', scheme: 'time', sets: 2, seconds: 30, restSec: 20 },
        ],
      },
      {
        phase: 3,
        name: 'Loaded and long',
        afterSessions: 16,
        note: 'Straight-leg raises, landmine rotations, heavier carries.',
        blocks: [
          { family: 'anti-extension', exerciseId: 'hanging-leg-raise', scheme: 'reps', sets: 3, repMin: 8, repMax: 12, restSec: 60 },
          { family: 'anti-rotation', exerciseId: 'landmine-rotation', scheme: 'weight_reps', sets: 3, repMin: 6, repMax: 10, rpeCap: 9, restSec: 60 },
          { family: 'anti-lateral', exerciseId: 'suitcase-carry', scheme: 'weight_time', sets: 3, seconds: 45, restSec: 45 },
          { family: 'foot', exerciseId: 'single-leg-calf-raise', scheme: 'reps', sets: 2, repMin: 12, repMax: 15, restSec: 30 },
          { family: 'foot', exerciseId: 'single-leg-balance', scheme: 'time', sets: 2, seconds: 45, restSec: 20 },
        ],
      },
    ],
  },
};
