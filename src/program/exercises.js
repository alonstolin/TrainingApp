/**
 * Exercise catalog.
 *
 * RULES — these are load-bearing, do not break them:
 *  1. `id` is a permanent slug. Renaming an exercise changes `name`, NEVER `id`.
 *     Logged sessions reference exercises by id forever.
 *  2. Never delete an entry. Set `retired: true` so historical sessions still render.
 *  3. `increment` drives the +/- stepper step size for that exercise specifically.
 *
 * metric:
 *   weight_reps  — external load x reps (most lifts)
 *   reps         — bodyweight reps, no load field
 *   time         — a hold, logged in seconds
 *   weight_time  — a loaded hold or carry: external load AND seconds
 *
 * loadModel:
 *   external       — the weight you put on the bar/stack IS the load
 *   bodyweight_plus— total load = session bodyweight + added weight (pull-ups)
 */

/** @typedef {'weight_reps'|'reps'|'time'|'weight_time'} Metric */

const def = (id, name, o = {}) => ({
  id,
  name,
  short: o.short ?? name,
  modality: o.modality ?? 'lift',
  role: o.role ?? 'accessory', // 'main' → gets its own e1RM progress chart
  metric: o.metric ?? 'weight_reps',
  unit: o.unit ?? 'kg',
  increment: o.increment ?? 2.5,
  // { count, increment }: after `count` heavy sessions without a raise, the
  // reference moves in the smaller step instead (SYNTHESIS §1.4).
  afterMisses: o.afterMisses ?? null,
  loadModel: o.loadModel ?? 'external',
  // What the load is set on. Barbells and dumbbells weigh the same in every
  // gym; a cable stack, a selectorised machine or a Smith bar does not, so
  // `gymSpecific` marks the exercises whose history is only comparable within
  // one gym (and, within a gym, one station). See makeHistoryLookup.
  equipment: o.equipment ?? 'barbell',
  gymSpecific: o.gymSpecific ?? ['cable', 'machine', 'smith'].includes(o.equipment ?? 'barbell'),
  // Substitutes worth offering when this one is taken, best first. Selection
  // among close variants is second-order for growth (SYNTHESIS §2.3), so the
  // list is about equipment availability, not a claim of superiority.
  alternatives: o.alternatives ?? [],
  muscle: o.muscle ?? null, // primary — drives the weekly-volume readout
  // Every muscle this meaningfully loads, primary AND significant secondary.
  // Separate from `muscle` on purpose: volume accounting wants one owner per set,
  // but "did I already train this yesterday" has to see that a pull-up hits
  // biceps and an incline press hits triceps. Defaults to the primary alone.
  trains: o.trains ?? (o.muscle ? [o.muscle] : []),
  perSide: o.perSide ?? false,
  cue: o.cue ?? '',
  retired: false,
});

export const EXERCISES = Object.fromEntries(
  [
    // ---- MAIN STRENGTH LIFTS -------------------------------------------------
    def('incline-bench', 'Incline Barbell Bench Press', {
      short: 'Incline Bench',
      role: 'main',
      muscle: 'chest',
      trains: ['chest', 'front-delts', 'triceps'],
      // 2.5 kg until a jump has failed twice, then 1.25 (SYNTHESIS §1.4).
      afterMisses: { count: 2, increment: 1.25 },
      alternatives: ['incline-smith', 'incline-db-press'],
      cue: '30° bench — peak upper-pec with the least front-delt overlap with OHP. Touch upper chest, elbows ~45–60°.',
    }),
    def('ohp', 'Standing Barbell Overhead Press', {
      short: 'OHP',
      role: 'main',
      muscle: 'front-delts',
      trains: ['front-delts', 'side-delts', 'triceps'],
      increment: 1.25,
      alternatives: ['machine-shoulder-press', 'db-shoulder-press'],
      cue: 'Standing — that is the lift. Glutes + abs braced, head through at lockout. 1.25 kg jumps.',
    }),
    def('weighted-pullup', 'Weighted Pull-Up', {
      short: 'Wtd Pull-Up',
      role: 'main',
      muscle: 'back',
      trains: ['back', 'biceps'],
      increment: 1.25,
      loadModel: 'bodyweight_plus',
      equipment: 'bodyweight',
      alternatives: ['chin-up', 'lat-pulldown'],
      cue: 'Full hang each rep. Chest to bar. Log ADDED weight only — strength is computed on bodyweight + load.',
    }),

    // ---- UPPER PUSH ACCESSORIES ---------------------------------------------
    def('incline-db-press', 'Incline Dumbbell Press', {
      short: 'Incline DB',
      muscle: 'chest',
      trains: ['chest', 'front-delts', 'triceps'],
      increment: 2,
      equipment: 'dumbbell',
      cue: 'Keep it submaximal — this is a substitute, not the lift being peaked.',
    }),
    def('cable-lateral-raise', 'Cable Lateral Raise', {
      short: 'Cable Lateral',
      muscle: 'side-delts',
      increment: 2.5,
      equipment: 'cable',
      alternatives: ['db-lateral-raise', 'machine-lateral-raise'],
      cue: 'Cable keeps tension at the bottom where dumbbells go slack.',
    }),
    def('machine-lateral-raise', 'Machine Lateral Raise', {
      short: 'Machine Lateral',
      muscle: 'side-delts',
      increment: 2.5,
      equipment: 'machine',
      alternatives: ['db-lateral-raise', 'cable-lateral-raise'],
      cue: 'Higher reps, lower fatigue cost. Leave 1–2 in reserve.',
    }),
    def('overhead-cable-tricep', 'Overhead Cable Triceps Extension', {
      short: 'OH Cable Tri',
      muscle: 'triceps',
      increment: 2.5,
      equipment: 'cable',
      alternatives: ['ez-overhead-tricep', 'skullcrusher'],
      cue: 'Long head only grows in the stretched position — get full overhead reach.',
    }),
    def('ez-overhead-tricep', 'EZ-Bar Overhead Triceps Extension', {
      short: 'EZ OH Tri',
      muscle: 'triceps',
      increment: 2.5,
      alternatives: ['overhead-cable-tricep', 'skullcrusher'],
      cue: 'Elbows tight, deep stretch behind the head.',
    }),
    def('rope-pushdown', 'Rope Pushdown', {
      short: 'Pushdown',
      muscle: 'triceps',
      increment: 2.5,
      equipment: 'cable',
      alternatives: ['close-grip-bench', 'dips'],
      cue: 'Lateral/medial head bias. Spread the rope at lockout.',
    }),

    // ---- UPPER PULL ACCESSORIES ---------------------------------------------
    def('chest-supported-row', 'Chest-Supported Row', {
      short: 'CS Row',
      muscle: 'back',
      trains: ['back', 'biceps', 'rear-delts'],
      equipment: 'machine',
      alternatives: ['cable-row', 'one-arm-db-row'],
      cue: 'Chest stays down. No body English — that is the point of the pad.',
    }),
    def('lat-pulldown', 'Lat Pulldown', {
      short: 'Pulldown',
      muscle: 'back',
      trains: ['back', 'biceps'],
      equipment: 'cable',
      alternatives: ['chin-up', 'cable-row'],
      cue: 'Full stretch at the top, no leaning back past ~15°.',
    }),
    def('reverse-pec-deck', 'Reverse Pec Deck', {
      short: 'Rev Pec Deck',
      muscle: 'rear-delts',
      equipment: 'machine',
      alternatives: ['face-pull', 'db-rear-delt-fly'],
      cue: 'Sit sideways-on for a deeper stretch if the machine allows.',
    }),
    def('face-pull', 'Rope Face Pull', {
      short: 'Face Pull',
      muscle: 'rear-delts',
      equipment: 'cable',
      alternatives: ['reverse-pec-deck', 'db-rear-delt-fly'],
      cue: 'High elbows, pull to the forehead, externally rotate.',
    }),
    def('incline-db-curl', 'Incline Dumbbell Curl', {
      short: 'Incline Curl',
      muscle: 'biceps',
      increment: 2,
      equipment: 'dumbbell',
      alternatives: ['cable-curl', 'hammer-curl'],
      cue: 'Arm behind the torso = long head under stretch. Full extension.',
    }),
    def('preacher-curl', 'Preacher Curl', {
      short: 'Preacher',
      muscle: 'biceps',
      increment: 2.5,
      equipment: 'machine',
      alternatives: ['cable-curl', 'hammer-curl'],
      cue: 'Stretch-loaded at the bottom. Do not bounce out of it.',
    }),
    def('bayesian-curl', 'Bayesian Cable Curl', {
      short: 'Bayesian Curl',
      muscle: 'biceps',
      increment: 2.5,
      equipment: 'cable',
      alternatives: ['incline-db-curl', 'cable-curl'],
      cue: 'Cable from behind — constant tension in the stretched position.',
    }),

    // ---- LOWER ---------------------------------------------------------------
    def('back-squat', 'Back Squat (or Hack Squat)', {
      short: 'Squat',
      role: 'secondary',
      muscle: 'quads',
      trains: ['quads', 'glutes'],
      alternatives: ['hack-squat', 'leg-press'],
      cue: 'Leave 2–3 reps in reserve. Legs are maintenance while the 10K builds.',
    }),
    def('rdl', 'Romanian Deadlift', {
      short: 'RDL',
      role: 'secondary',
      muscle: 'hamstrings',
      trains: ['hamstrings', 'glutes'],
      alternatives: ['leg-curl'],
      cue: 'Hinge, soft knees, stop where the hamstring stretch runs out.',
    }),
    def('leg-press', 'Leg Press', {
      short: 'Leg Press',
      muscle: 'quads',
      trains: ['quads', 'glutes'],
      increment: 5,
      equipment: 'machine',
      alternatives: ['hack-squat', 'back-squat'],
    }),
    def('leg-curl', 'Seated Leg Curl', {
      short: 'Leg Curl', muscle: 'hamstrings', equipment: 'machine', alternatives: ['rdl'],
    }),
    def('calf-raise', 'Standing Calf Raise', {
      short: 'Calf Raise',
      muscle: 'calves',
      equipment: 'machine',
      alternatives: ['seated-calf-raise', 'single-leg-calf-raise'],
      cue: 'Slow, full range. Pause a full second in the bottom stretch — calves are here for the shins, not for show.',
    }),
    def('split-squat', 'Split Squat / Reverse Lunge', {
      short: 'Split Squat',
      muscle: 'quads',
      trains: ['quads', 'glutes'],
      increment: 2,
      equipment: 'dumbbell',
      perSide: true,
      alternatives: ['leg-press', 'hack-squat'],
      cue: 'One unilateral pattern stays for the running (hip and knee control). Dumbbells at the sides, long stride, knee tracks the toes.',
    }),
    def('hack-squat', 'Hack Squat', {
      short: 'Hack Squat',
      muscle: 'quads',
      trains: ['quads', 'glutes'],
      increment: 5,
      equipment: 'machine',
      alternatives: ['back-squat', 'leg-press'],
    }),
    def('seated-calf-raise', 'Seated Calf Raise', {
      short: 'Seated Calf',
      muscle: 'calves',
      equipment: 'machine',
      alternatives: ['calf-raise', 'single-leg-calf-raise'],
      cue: 'Slow and full range. Pause in the stretch.',
    }),

    // ---- ALTERNATIVES (not programmed; offered when the station is taken) --
    def('incline-smith', 'Incline Smith Machine Press', {
      short: 'Incline Smith',
      muscle: 'chest',
      trains: ['chest', 'front-delts', 'triceps'],
      equipment: 'smith',
      alternatives: ['incline-bench', 'incline-db-press'],
      cue: 'Smith bars weigh differently in every gym — this is its own exercise with its own history, never compared to the barbell.',
    }),
    def('machine-shoulder-press', 'Machine Shoulder Press', {
      short: 'Machine Press',
      muscle: 'front-delts',
      trains: ['front-delts', 'side-delts', 'triceps'],
      equipment: 'machine',
      alternatives: ['ohp', 'db-shoulder-press'],
    }),
    def('db-shoulder-press', 'Seated Dumbbell Shoulder Press', {
      short: 'DB Press',
      muscle: 'front-delts',
      trains: ['front-delts', 'side-delts', 'triceps'],
      increment: 2,
      equipment: 'dumbbell',
      alternatives: ['ohp', 'machine-shoulder-press'],
    }),
    def('db-lateral-raise', 'Dumbbell Lateral Raise', {
      short: 'DB Lateral',
      muscle: 'side-delts',
      increment: 1,
      equipment: 'dumbbell',
      alternatives: ['cable-lateral-raise', 'machine-lateral-raise'],
      cue: 'Equivalent to cables in trained lifters (Wolf/Schoenfeld 2025). Lean slightly forward, lead with the elbows.',
    }),
    def('chin-up', 'Weighted Chin-Up', {
      short: 'Chin-Up',
      muscle: 'back',
      trains: ['back', 'biceps'],
      increment: 1.25,
      loadModel: 'bodyweight_plus',
      equipment: 'bodyweight',
      alternatives: ['weighted-pullup', 'lat-pulldown'],
      cue: 'Supinated grip. Log ADDED weight only.',
    }),
    def('cable-row', 'Seated Cable Row', {
      short: 'Cable Row',
      muscle: 'back',
      trains: ['back', 'biceps', 'rear-delts'],
      equipment: 'cable',
      alternatives: ['chest-supported-row', 'one-arm-db-row'],
      cue: 'Chest up, elbows to the hips, no torso swing.',
    }),
    def('one-arm-db-row', 'One-Arm Dumbbell Row', {
      short: '1-Arm Row',
      muscle: 'back',
      trains: ['back', 'biceps', 'rear-delts'],
      increment: 2,
      equipment: 'dumbbell',
      perSide: true,
      alternatives: ['chest-supported-row', 'cable-row'],
    }),
    def('db-rear-delt-fly', 'Dumbbell Rear-Delt Fly', {
      short: 'DB Rear Fly',
      muscle: 'rear-delts',
      increment: 1,
      equipment: 'dumbbell',
      alternatives: ['reverse-pec-deck', 'face-pull'],
      cue: 'Chest-supported on an incline bench if there is one. Light — it is a small muscle.',
    }),
    def('close-grip-bench', 'Close-Grip Bench Press', {
      short: 'CG Bench',
      muscle: 'triceps',
      trains: ['triceps', 'chest', 'front-delts'],
      alternatives: ['rope-pushdown', 'dips'],
      cue: 'Hands just inside shoulder width, elbows tucked.',
    }),
    def('dips', 'Weighted Dips', {
      short: 'Dips',
      muscle: 'triceps',
      trains: ['triceps', 'chest', 'front-delts'],
      increment: 1.25,
      loadModel: 'bodyweight_plus',
      equipment: 'bodyweight',
      alternatives: ['close-grip-bench', 'rope-pushdown'],
      cue: 'Upright torso for triceps. Log ADDED weight only.',
    }),
    def('skullcrusher', 'EZ-Bar Skullcrusher', {
      short: 'Skullcrusher',
      muscle: 'triceps',
      alternatives: ['ez-overhead-tricep', 'overhead-cable-tricep'],
      cue: 'Lower behind the head, not to the forehead, for the long-head stretch.',
    }),
    def('cable-curl', 'Cable Curl', {
      short: 'Cable Curl',
      muscle: 'biceps',
      increment: 2.5,
      equipment: 'cable',
      alternatives: ['incline-db-curl', 'bayesian-curl'],
    }),
    def('hammer-curl', 'Dumbbell Hammer Curl', {
      short: 'Hammer Curl',
      muscle: 'biceps',
      increment: 2,
      equipment: 'dumbbell',
      alternatives: ['incline-db-curl', 'cable-curl'],
      cue: 'Neutral grip — the elbow-friendly variant when the others are cranky.',
    }),

    // ---- CORE ----------------------------------------------------------------
    def('dead-bug', 'Dead Bug', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', equipment: 'bodyweight', perSide: true,
      cue: 'Ribs down, low back flat to the floor. Slow.',
    }),
    def('bird-dog', 'Bird Dog', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', equipment: 'bodyweight', perSide: true,
      cue: 'No hip rotation. Reach long rather than lifting high.',
    }),
    def('front-plank', 'Front Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core', equipment: 'bodyweight',
      cue: 'Squeeze glutes, brace abs. Quality over duration.',
    }),
    def('side-plank', 'Side Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core', equipment: 'bodyweight', perSide: true,
      cue: 'Stack the hips. Drop to knees if form breaks.',
    }),
    def('weighted-plank', 'Weighted Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core', equipment: 'bodyweight',
      cue: 'Plate on the upper back. Only once bodyweight 60s is easy.',
    }),
    def('pallof-press', 'Pallof Press', {
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', perSide: true, equipment: 'cable',
      alternatives: ['cable-woodchop', 'landmine-rotation'],
      cue: 'Anti-rotation. Press out, hold 3 s, resist the pull — do not twist.',
    }),
    def('hanging-knee-raise', 'Hanging Knee Raise', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', equipment: 'bodyweight',
      cue: 'Posterior pelvic tilt at the top. No swinging.',
    }),
    def('hanging-leg-raise', 'Hanging Leg Raise', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', equipment: 'bodyweight',
      cue: 'Progression: knee raise → frog raise → straight leg.',
    }),
    def('ab-wheel', 'Kneeling Ab Wheel Rollout', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', equipment: 'bodyweight',
      cue: 'Gated on a clean 60s plank. Short range first, extend over weeks.',
    }),
    def('cable-crunch', 'Cable Crunch', {
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', equipment: 'cable',
      alternatives: ['ab-wheel', 'weighted-decline-situp'],
      cue: 'Flex the spine, do not hip-hinge. Hips stay put.',
    }),
    def('weighted-decline-situp', 'Weighted Decline Sit-Up', {
      short: 'Decline Sit-Up',
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', equipment: 'dumbbell',
      alternatives: ['cable-crunch', 'hanging-leg-raise'],
      cue: 'Plate on the chest. Controlled down, no yanking on the neck.',
    }),
    def('cable-woodchop', 'Cable Woodchop (high to low)', {
      short: 'Woodchop',
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', perSide: true, equipment: 'cable',
      alternatives: ['pallof-press', 'landmine-rotation'],
      cue: 'Rotate through the hips and trunk together; arms stay long.',
    }),
    def('landmine-rotation', 'Landmine Rotation', {
      short: 'Landmine Rot.',
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', perSide: true, equipment: 'landmine',
      alternatives: ['cable-woodchop', 'pallof-press'],
      cue: 'Half-moon arc, feet planted, ribs down.',
    }),
    def('suitcase-carry', 'Suitcase Carry', {
      short: 'Suitcase Carry',
      modality: 'core', metric: 'weight_time', unit: 'kg', increment: 2.5,
      muscle: 'core', perSide: true, equipment: 'dumbbell',
      alternatives: ['cable-side-bend', 'copenhagen-plank'],
      cue: 'One heavy dumbbell. Stand tall — do not lean away from it. ~30 m per side.',
    }),
    def('cable-side-bend', 'Cable Side Bend', {
      short: 'Side Bend',
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core', perSide: true, equipment: 'cable',
      alternatives: ['suitcase-carry', 'copenhagen-plank'],
      cue: 'Pure lateral flexion; no twisting or hip shift.',
    }),
    def('copenhagen-plank', 'Copenhagen Plank (on a bench)', {
      short: 'Copenhagen',
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', perSide: true, equipment: 'bodyweight',
      alternatives: ['suitcase-carry', 'cable-side-bend'],
      cue: 'Top leg on the bench, knee level first; ankle level once 10 clean reps are easy.',
    }),
    def('single-leg-calf-raise', 'Single-Leg Calf Raise (on a step)', {
      short: 'SL Calf Raise',
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'calves', perSide: true, equipment: 'bodyweight',
      alternatives: ['calf-raise', 'seated-calf-raise'],
      cue: 'Slow, full range, pause in the bottom stretch. The foot and shin work for the running lives here.',
    }),
    def('single-leg-balance', 'Single-Leg Balance', {
      short: 'SL Balance',
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core', perSide: true, equipment: 'bodyweight',
      cue: 'Hold the cable stack or a rack upright for a fingertip. Foot quiet, knee soft.',
    }),

    // ---- RUNNING -------------------------------------------------------------
    def('run-easy', 'Easy Run', {
      modality: 'run', metric: 'distance_time', unit: 'km', increment: 0.1,
      muscle: null,
      cue: 'Zone 2. If you cannot hold a conversation, slow down.',
    }),
    def('run-long', 'Long Run', {
      modality: 'run', metric: 'distance_time', unit: 'km', increment: 0.1,
      muscle: null,
      cue: 'Still easy. The distance is the stimulus, not the pace.',
    }),
  ].map((e) => [e.id, e]),
);

/**
 * Per-exercise weight increment overrides, e.g. a cable stack that moves in
 * 6.25kg steps rather than 2.5kg.
 *
 * A module-level registry rather than a parameter threaded through every
 * signature: it is configuration, set once from stored meta at boot, and
 * plumbing it through prescribe/progression would touch a dozen call sites to
 * express one setting. Tests must reset it — see `setIncrementOverrides({})`.
 *
 * It matters beyond the +/- button size: `roundToIncrement` uses it to snap
 * SUGGESTED loads, so without it the app keeps proposing weights that do not
 * exist on the machine in front of you.
 */
let INCREMENT_OVERRIDES = {};

export function setIncrementOverrides(map) {
  INCREMENT_OVERRIDES = map && typeof map === 'object' ? { ...map } : {};
}

export function getIncrementOverrides() {
  return { ...INCREMENT_OVERRIDES };
}

/** Safe lookup — returns a placeholder rather than throwing, so old logs always render. */
export function getExercise(id) {
  const override = INCREMENT_OVERRIDES[id];
  const base = EXERCISES[id];
  if (base) return override ? { ...base, increment: override } : base;
  return (
    EXERCISES[id] ?? {
      id,
      name: id,
      short: id,
      modality: 'lift',
      role: 'accessory',
      metric: 'weight_reps',
      unit: 'kg',
      increment: 2.5,
      loadModel: 'external',
      equipment: 'barbell',
      gymSpecific: false,
      alternatives: [],
      muscle: null,
      trains: [],
      perSide: false,
      cue: '',
      retired: true,
    }
  );
}

export const MAIN_LIFTS = ['incline-bench', 'ohp', 'weighted-pullup'];

/** Display labels for the weekly-volume readout. */
export const MUSCLE_LABELS = {
  'side-delts': 'Side delts',
  'rear-delts': 'Rear delts',
  'front-delts': 'Front delts',
  triceps: 'Triceps',
  biceps: 'Biceps',
  chest: 'Chest',
  back: 'Back',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  core: 'Core',
};
