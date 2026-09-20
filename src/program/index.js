/**
 * Program registry.
 *
 * Old versions are NEVER deleted. A session logged two years ago records the
 * version it ran under and can still resolve the program it actually followed.
 *
 * program.v1.js carries `version: 2` — v2 was the in-place restructure of v1
 * (same file, bumped). v3 is a separate file because the scheme names, week
 * modifiers and core layout all changed shape.
 */
import v2 from './program.v1.js';
import v3 from './program.v3.js';

export const PROGRAMS = { 1: v2, 2: v2, 3: v3 };
export const CURRENT_PROGRAM = v3;
export const CURRENT_VERSION = v3.version;

/** Falls back to the current program rather than throwing — a missing version
 *  must never make history unreadable. */
export function getProgram(version) {
  return PROGRAMS[version] ?? CURRENT_PROGRAM;
}

export { getExercise, EXERCISES, MAIN_LIFTS, MUSCLE_LABELS } from './exercises.js';
