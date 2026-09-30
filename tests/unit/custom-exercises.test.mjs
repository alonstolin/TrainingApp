import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExercise, allExercises, defineCustomExercise, setCustomExercises, slugify, isCustomId, CUSTOM_PREFIX, EXERCISES,
} from '../../src/program/exercises.js';
import { makeHistoryLookup } from '../../src/core/schedule.js';
import { resolveBlock, weekModifier } from '../../src/core/prescribe.js';
import { validateBackup, buildBackup, DEFAULT_META } from '../../src/core/schema.js';
import { program, mkSession, mkEntry, mkSet } from './_fixtures.mjs';

test.afterEach?.(() => setCustomExercises({}));

test('a custom exercise is defined from a name alone and behaves like a catalogue one', () => {
  const ex = defineCustomExercise({ name: '  Converging Row Machine  ', muscle: 'back' });
  assert.equal(ex.id, 'custom:converging-row-machine');
  assert.equal(ex.name, 'Converging Row Machine');
  assert.equal(ex.custom, true);
  assert.equal(ex.muscle, 'back');
  assert.equal(ex.metric, 'weight_reps');
  assert.equal(ex.gymSpecific, true, 'a machine by default — its load is not portable');
  assert.ok(ex.short.length <= 16, 'short enough for the exercise nav');
  assert.equal(defineCustomExercise({ name: '   ' }), null, 'a nameless exercise is not an exercise');
});

test('custom ids are namespaced so they can never collide with a catalogue slug', () => {
  assert.ok(isCustomId(defineCustomExercise({ name: 'Lat Pulldown' }).id));
  assert.ok(!isCustomId('lat-pulldown'));
  assert.ok(!EXERCISES[defineCustomExercise({ name: 'Lat Pulldown' }).id], 'never shadows a catalogue entry');
  assert.equal(slugify('Über Row!! 3000'), 'uber-row-3000');
  assert.equal(slugify('///'), 'exercise', 'never produces an empty id');
});

test('once installed it resolves through getExercise and appears in the pickers', () => {
  const ex = defineCustomExercise({ name: 'Plate-loaded pullover', muscle: 'back' });
  assert.equal(getExercise(ex.id).retired, true, 'unknown before it is installed');
  setCustomExercises({ [ex.id]: ex });
  assert.equal(getExercise(ex.id).name, 'Plate-loaded pullover');
  assert.equal(allExercises()[ex.id].custom, true);
  assert.equal(Object.keys(allExercises()).length, Object.keys(EXERCISES).length + 1);
  setCustomExercises({});
});

test('a session logged against a custom exercise still resolves after it is renamed', () => {
  const ex = defineCustomExercise({ name: 'Row thing', muscle: 'back' });
  setCustomExercises({ [ex.id]: ex });
  const history = { date: '2026-09-01', dayKey: 'lift:C', bodyweightKg: 82, sets: [mkSet({ weightKg: 40, reps: 10, rpe: 8 })] };
  const e = resolveBlock(
    program,
    { exerciseId: 'chest-supported-row', scheme: 'double_progression', sets: 3, repMin: 8, repMax: 12, rpeCap: 9, restSec: 120 },
    { dayKey: 'lift:C', mod: weekModifier(program, 'probe'), day: program.liftDays.C, historyFor: (id, o) => (id === ex.id && !o?.all ? history : o?.all ? [] : null), order: 1 },
    { exerciseId: ex.id },
  );
  assert.equal(e.exerciseId, ex.id);
  assert.equal(e.name, 'Row thing');
  assert.equal(e.swappedFrom, 'chest-supported-row');
  assert.equal(e.plannedSets[0].weightKg, 40, 'progresses on its own history');

  // Renaming keeps the id, so the logged session still renders.
  setCustomExercises({ [ex.id]: { ...ex, name: 'Converging row' } });
  assert.equal(getExercise(ex.id).name, 'Converging row');
  setCustomExercises({});
});

test('custom exercises travel in the backup envelope', () => {
  const ex = defineCustomExercise({ name: 'Hip belt squat', muscle: 'quads' });
  const payload = buildBackup({ ...DEFAULT_META, customExercises: { [ex.id]: ex } }, [], [], 'test');
  const v = validateBackup(JSON.stringify(payload));
  assert.equal(v.ok, true);
  assert.equal(v.data.meta.customExercises[ex.id].name, 'Hip belt squat');
  // A backup predating the field gains an empty one rather than undefined.
  const old = validateBackup({ format: 'trainingapp-backup', schemaVersion: 1, sessions: [], meta: {} });
  assert.deepEqual(old.data.meta.customExercises, {});
});

// ---------------------------------------------------------------------------
// Machine tagging without gyms
// ---------------------------------------------------------------------------

const onMachine = (date, station, kg) =>
  mkSession({
    kind: 'lift', dayKey: 'lift:A', date, gymId: null,
    entries: [{ ...mkEntry('cable-lateral-raise', [mkSet({ weightKg: kg, reps: 15, rpe: 8 })]), station }],
  });

test('with no gyms configured, the machine tag alone scopes the history', () => {
  // The whole point: 40 on one stack is not 40 on the next, and an untagged
  // mix of the two is a progression line that means nothing.
  const sessions = [onMachine('2026-09-01', 'left stack', 20), onMachine('2026-09-03', 'window side', 12.5)];
  const lookup = makeHistoryLookup(sessions);

  const left = lookup('cable-lateral-raise', { dayKey: 'lift:A', station: 'left stack' });
  assert.equal(left.sets[0].weightKg, 20);
  assert.equal(left.scope, 'exact');

  const window = lookup('cable-lateral-raise', { dayKey: 'lift:A', station: 'window side' });
  assert.equal(window.sets[0].weightKg, 12.5);
  assert.equal(window.scope, 'exact');

  // A machine never used before falls back to everything, labelled as a guide.
  const fresh = lookup('cable-lateral-raise', { dayKey: 'lift:A', station: 'corner one' });
  assert.equal(fresh.scope, 'other');

  // No tag asked for → unscoped, as before.
  assert.equal(lookup('cable-lateral-raise', { dayKey: 'lift:A' }).scope, undefined);
});

test('the guide note names the machine when there are no gyms, and the gym when there are', () => {
  const sessions = [onMachine('2026-09-01', 'left stack', 20)];
  const lookup = makeHistoryLookup(sessions);
  const block = { exerciseId: 'cable-lateral-raise', scheme: 'double_progression', sets: 3, repMin: 12, repMax: 15, rpeCap: 9, restSec: 75 };
  const at = (ctxOver, over) =>
    resolveBlock(program, block, { dayKey: 'lift:A', mod: weekModifier(program, 'probe'), day: program.liftDays.A, historyFor: lookup, order: 2, ...ctxOver }, over);

  assert.match(at({}, { station: 'corner one' }).suggestion, /different machine — treat it as a guide/);
  assert.match(at({ gymId: 'g9' }, {}).suggestion, /another gym — treat it as a guide/);
  assert.doesNotMatch(at({}, { station: 'left stack' }).suggestion, /guide/);
});
