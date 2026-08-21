import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getExercise, setIncrementOverrides, getIncrementOverrides, EXERCISES,
} from '../../src/program/exercises.js';
import { roundToIncrement } from '../../src/core/progression.js';
import { resolveLiftSession } from '../../src/core/prescribe.js';
import { program, mkSet } from './_fixtures.mjs';

afterEach(() => setIncrementOverrides({}));

test('with no override an exercise keeps its catalog increment', () => {
  assert.equal(getExercise('cable-lateral-raise').increment, 2.5);
  assert.equal(getExercise('weighted-pullup').increment, 1.25);
});

test('an override replaces the increment for that exercise only', () => {
  setIncrementOverrides({ 'cable-lateral-raise': 6.25 });
  assert.equal(getExercise('cable-lateral-raise').increment, 6.25);
  assert.equal(getExercise('machine-lateral-raise').increment, 2.5, 'siblings are untouched');
});

test('overrides do not mutate the catalog', () => {
  setIncrementOverrides({ 'cable-lateral-raise': 6.25 });
  getExercise('cable-lateral-raise');
  setIncrementOverrides({});
  assert.equal(EXERCISES['cable-lateral-raise'].increment, 2.5);
  assert.equal(getExercise('cable-lateral-raise').increment, 2.5);
});

test('setIncrementOverrides copies its input so later edits cannot leak in', () => {
  const map = { 'cable-lateral-raise': 6.25 };
  setIncrementOverrides(map);
  map['cable-lateral-raise'] = 99;
  assert.equal(getExercise('cable-lateral-raise').increment, 6.25);
});

test('bad input resets rather than throwing', () => {
  setIncrementOverrides({ ohp: 5 });
  setIncrementOverrides(null);
  assert.deepEqual(getIncrementOverrides(), {});
  assert.equal(getExercise('ohp').increment, 2.5);
});

test('a custom increment changes what loads get SUGGESTED, not just the buttons', () => {
  // The actual complaint behind this feature: a stack that moves in 6.25kg steps
  // was being handed 7.5kg targets, which do not exist on the machine.
  const history = {
    date: '2026-08-01',
    dayKey: 'lift:D',
    sets: [
      mkSet({ weightKg: 12.5, reps: 15, rpe: 7, type: 'work' }),
      mkSet({ weightKg: 12.5, reps: 15, rpe: 7, type: 'work' }),
      mkSet({ weightKg: 12.5, reps: 15, rpe: 7, type: 'work' }),
    ],
    bodyweightKg: 80,
  };
  const lookup = (id) => (id === 'cable-lateral-raise' ? history : null);

  setIncrementOverrides({ 'cable-lateral-raise': 6.25 });
  const withOverride = resolveLiftSession(program, 'lift:D', 1, lookup)
    .entries.find((e) => e.exerciseId === 'cable-lateral-raise').plannedSets[0].weightKg;

  setIncrementOverrides({});
  const withDefault = resolveLiftSession(program, 'lift:D', 1, lookup)
    .entries.find((e) => e.exerciseId === 'cable-lateral-raise').plannedSets[0].weightKg;

  assert.equal(withOverride, 18.75, 'lands on a weight the stack can make');
  assert.equal(withDefault, 15);
  assert.notEqual(withOverride, withDefault);
});

test('roundToIncrement handles fractional stacks exactly', () => {
  assert.equal(roundToIncrement(6.25, 6.25), 6.25);
  assert.equal(roundToIncrement(15, 6.25), 12.5);
  assert.equal(roundToIncrement(16, 6.25), 18.75);
  assert.equal(roundToIncrement(7.5, 1.25), 7.5);
  assert.equal(roundToIncrement(42, 0), 42, 'a zero increment means do not round');
});

test('a deload load still lands on a reachable weight', () => {
  setIncrementOverrides({ 'cable-lateral-raise': 6.25 });
  const history = {
    date: '2026-08-01', dayKey: 'lift:D', bodyweightKg: 80,
    sets: [mkSet({ weightKg: 25, reps: 15, rpe: 7, type: 'work' })],
  };
  const w = resolveLiftSession(program, 'lift:D', 5, (id) =>
    id === 'cable-lateral-raise' ? history : null,
  ).entries.find((e) => e.exerciseId === 'cable-lateral-raise').plannedSets[0].weightKg;
  assert.equal(w % 6.25, 0, `${w} is not a multiple of 6.25`);
});
