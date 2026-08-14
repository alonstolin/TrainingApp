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
 *
 * loadModel:
 *   external       — the weight you put on the bar/stack IS the load
 *   bodyweight_plus— total load = session bodyweight + added weight (pull-ups)
 */

/** @typedef {'weight_reps'|'reps'|'time'} Metric */

const def = (id, name, o = {}) => ({
  id,
  name,
  short: o.short ?? name,
  modality: o.modality ?? 'lift',
  role: o.role ?? 'accessory', // 'main' → gets its own e1RM progress chart
  metric: o.metric ?? 'weight_reps',
  unit: o.unit ?? 'kg',
  increment: o.increment ?? 2.5,
  loadModel: o.loadModel ?? 'external',
  muscle: o.muscle ?? null, // drives the weekly-volume readout
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
      cue: '~30° bench. Touch upper chest, elbows ~45–60°.',
    }),
    def('ohp', 'Standing Barbell Overhead Press', {
      short: 'OHP',
      role: 'main',
      muscle: 'front-delts',
      cue: 'Glutes + abs braced. Head through at lockout.',
    }),
    def('weighted-pullup', 'Weighted Pull-Up', {
      short: 'Wtd Pull-Up',
      role: 'main',
      muscle: 'back',
      increment: 1.25,
      loadModel: 'bodyweight_plus',
      cue: 'Full hang each rep. Chest to bar. Log ADDED weight only.',
    }),

    // ---- UPPER PUSH ACCESSORIES ---------------------------------------------
    def('incline-db-press', 'Incline Dumbbell Press', {
      short: 'Incline DB',
      muscle: 'chest',
      increment: 2,
      cue: 'Second incline exposure of the week — keep it submaximal.',
    }),
    def('cable-lateral-raise', 'Cable Lateral Raise', {
      short: 'Cable Lateral',
      muscle: 'side-delts',
      increment: 2.5,
      cue: 'Cable keeps tension at the bottom where dumbbells go slack.',
    }),
    def('machine-lateral-raise', 'Machine / DB Lateral Raise', {
      short: 'Machine Lateral',
      muscle: 'side-delts',
      increment: 2.5,
      cue: 'Higher reps, lower fatigue cost. Leave 1–2 in reserve.',
    }),
    def('overhead-cable-tricep', 'Overhead Cable Triceps Extension', {
      short: 'OH Cable Tri',
      muscle: 'triceps',
      increment: 2.5,
      cue: 'Long head only grows in the stretched position — get full overhead reach.',
    }),
    def('ez-overhead-tricep', 'EZ-Bar Overhead Triceps Extension', {
      short: 'EZ OH Tri',
      muscle: 'triceps',
      increment: 2.5,
      cue: 'Elbows tight, deep stretch behind the head.',
    }),
    def('rope-pushdown', 'Rope Pushdown', {
      short: 'Pushdown',
      muscle: 'triceps',
      increment: 2.5,
      cue: 'Lateral/medial head bias. Spread the rope at lockout.',
    }),

    // ---- UPPER PULL ACCESSORIES ---------------------------------------------
    def('chest-supported-row', 'Chest-Supported Row', {
      short: 'CS Row',
      muscle: 'back',
      cue: 'Chest stays down. No body English — that is the point of the pad.',
    }),
    def('lat-pulldown', 'Lat Pulldown', {
      short: 'Pulldown',
      muscle: 'back',
      cue: 'Full stretch at the top, no leaning back past ~15°.',
    }),
    def('reverse-pec-deck', 'Reverse Pec Deck', {
      short: 'Rev Pec Deck',
      muscle: 'rear-delts',
      cue: 'Sit sideways-on for a deeper stretch if the machine allows.',
    }),
    def('face-pull', 'Rope Face Pull', {
      short: 'Face Pull',
      muscle: 'rear-delts',
      cue: 'High elbows, pull to the forehead, externally rotate.',
    }),
    def('incline-db-curl', 'Incline Dumbbell Curl', {
      short: 'Incline Curl',
      muscle: 'biceps',
      increment: 2,
      cue: 'Arm behind the torso = long head under stretch. Full extension.',
    }),
    def('preacher-curl', 'Preacher Curl', {
      short: 'Preacher',
      muscle: 'biceps',
      increment: 2.5,
      cue: 'Stretch-loaded at the bottom. Do not bounce out of it.',
    }),
    def('bayesian-curl', 'Bayesian Cable Curl', {
      short: 'Bayesian Curl',
      muscle: 'biceps',
      increment: 2.5,
      cue: 'Cable from behind — constant tension in the stretched position.',
    }),

    // ---- LOWER ---------------------------------------------------------------
    def('back-squat', 'Back Squat (or Hack Squat)', {
      short: 'Squat',
      role: 'secondary',
      muscle: 'quads',
      cue: 'Leave 2–3 reps in reserve. This is not the lift we are peaking.',
    }),
    def('rdl', 'Romanian Deadlift', {
      short: 'RDL',
      role: 'secondary',
      muscle: 'hamstrings',
      cue: 'Hinge, soft knees, stop where the hamstring stretch runs out.',
    }),
    def('leg-press', 'Leg Press / Bulgarian Split Squat', {
      short: 'Leg Press',
      muscle: 'quads',
      increment: 5,
    }),
    def('leg-curl', 'Seated Leg Curl', { short: 'Leg Curl', muscle: 'hamstrings' }),
    def('calf-raise', 'Standing Calf Raise', {
      short: 'Calf Raise',
      muscle: 'calves',
      cue: 'Pause at the bottom stretch for a full second.',
    }),

    // ---- CORE ----------------------------------------------------------------
    def('dead-bug', 'Dead Bug', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', perSide: true,
      cue: 'Ribs down, low back flat to the floor. Slow.',
    }),
    def('bird-dog', 'Bird Dog', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', perSide: true,
      cue: 'No hip rotation. Reach long rather than lifting high.',
    }),
    def('front-plank', 'Front Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core',
      cue: 'Squeeze glutes, brace abs. Quality over duration.',
    }),
    def('side-plank', 'Side Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core', perSide: true,
      cue: 'Stack the hips. Drop to knees if form breaks.',
    }),
    def('weighted-plank', 'Weighted Plank', {
      modality: 'core', metric: 'time', unit: 's', increment: 5,
      muscle: 'core',
      cue: 'Plate on the upper back. Only once bodyweight 60s is easy.',
    }),
    def('pallof-press', 'Pallof Press', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core', perSide: true,
      cue: 'Anti-rotation. Resist the pull, do not twist.',
    }),
    def('hanging-knee-raise', 'Hanging Knee Raise', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core',
      cue: 'Posterior pelvic tilt at the top. No swinging.',
    }),
    def('hanging-leg-raise', 'Hanging Leg Raise', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core',
      cue: 'Progression: knee raise → frog raise → straight leg.',
    }),
    def('ab-wheel', 'Kneeling Ab Wheel Rollout', {
      modality: 'core', metric: 'reps', unit: 'reps', increment: 1,
      muscle: 'core',
      cue: 'Gated on a clean 60s plank. Short range first, extend over weeks.',
    }),
    def('cable-crunch', 'Cable Crunch', {
      modality: 'core', metric: 'weight_reps', unit: 'kg', increment: 2.5,
      muscle: 'core',
      cue: 'Flex the spine, do not hip-hinge. Hips stay put.',
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

/** Safe lookup — returns a placeholder rather than throwing, so old logs always render. */
export function getExercise(id) {
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
      muscle: null,
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
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  core: 'Core',
};
