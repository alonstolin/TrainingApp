import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { targetBand } from '../../src/core/stats.js';
import { PROGRAMS, CURRENT_PROGRAM, getProgram } from '../../src/program/index.js';
import { program, v2 } from './_fixtures.mjs';

/**
 * The per-muscle direct-set bands are program content with one source.
 * Progress and the review tool read them through targetBand(); neither keeps
 * its own copy, so they cannot drift apart. The review tool's output is checked
 * against the program in review.test.mjs; this file adds a tripwire for a
 * private table creeping back into either consumer's source.
 */

test('a muscle\'s band is read from the program (SYNTHESIS §2.1)', () => {
  assert.deepEqual(targetBand(program, 'side-delts'), { min: 8, max: 10 });
  assert.deepEqual(targetBand(program, 'rear-delts'), { min: 6, max: 8 });
  assert.deepEqual(targetBand(program, 'back'), { min: 7, max: 13 });
  assert.deepEqual(targetBand(program, 'calves'), { min: 2, max: 4 });
  assert.deepEqual(targetBand(program, 'core'), { min: 6, max: 12 });
});

test('the band comes from the program it is given, not a private table', () => {
  const edited = { ...program, volumeTargets: { ...program.volumeTargets, 'side-delts': { min: 10, max: 12 } } };
  assert.deepEqual(targetBand(edited, 'side-delts'), { min: 10, max: 12 });
});

test('a muscle with no band, or a program without bands, has no band', () => {
  assert.equal(targetBand(program, 'forearms'), null);
  assert.equal(targetBand(v2, 'side-delts'), null);
});

test('moving the bands into the program bumped its version, and every earlier version still resolves', () => {
  assert.equal(program.version, 5);
  assert.equal(PROGRAMS[5], CURRENT_PROGRAM);
  for (const v of [1, 2, 3, 4]) assert.ok(getProgram(v), `version ${v} resolves`);
  assert.equal(getProgram(1).version, 2, 'v1/v2 sessions still resolve the legacy file');
});

test('the Progress screen and the review tool both resolve bands from the program, with no private copy', () => {
  for (const file of ['src/ui/screens/progress.js', 'tools/review.mjs']) {
    const src = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    assert.match(src, /\btargetBand\(/, `${file} reads bands through targetBand`);
    // A hand-kept table looks like `'side-delts': { min:` or `'side-delts': [8,`.
    assert.doesNotMatch(src, /['"]side-delts['"]\s*:\s*[[{]/, `${file} keeps a private band table`);
  }
});
