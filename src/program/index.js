/**
 * Program registry.
 *
 * Old versions are NEVER deleted. A session logged two years ago records the
 * version it ran under and can still resolve the program it actually followed.
 */
import v1 from './program.v1.js';

export const PROGRAMS = { 1: v1 };
export const CURRENT_PROGRAM = v1;
export const CURRENT_VERSION = v1.version;

/** Falls back to the current program rather than throwing — a missing version
 *  must never make history unreadable. */
export function getProgram(version) {
  return PROGRAMS[version] ?? CURRENT_PROGRAM;
}

export { getExercise, EXERCISES, MAIN_LIFTS, MUSCLE_LABELS } from './exercises.js';
