/**
 * Program registry.
 *
 * Old versions are NEVER deleted. A session logged two years ago records the
 * version it ran under and can still resolve the program it actually followed.
 *
 * program.v1.js carries `version: 2` — v2 was the in-place restructure of v1
 * (same file, bumped). program.v3.js likewise carries `version: 5`: v4 was an
 * in-place exercise swap on Upper Pull, v5 moved the volume targets in. A file
 * is only split off when the SHAPE changes (v3 changed scheme names, week
 * modifiers and the core layout); a content edit bumps the number in place and
 * maps both here.
 *
 * Mapping an old number at the current file is deliberate. The frozen
 * `prescriptionSnapshot` on each session is the real record of what it
 * prescribed; this map only has to return something coherent, and the version
 * mismatch is exactly what tells `sessionIntegrity` to judge an old session
 * against its own snapshot rather than today's block list.
 */
import v2 from './program.v1.js';
import v3 from './program.v3.js';

export const PROGRAMS = { 1: v2, 2: v2, 3: v3, 4: v3, 5: v3 };
export const CURRENT_PROGRAM = v3;
export const CURRENT_VERSION = v3.version;

/** Falls back to the current program rather than throwing — a missing version
 *  must never make history unreadable. */
export function getProgram(version) {
  return PROGRAMS[version] ?? CURRENT_PROGRAM;
}

export { getExercise, EXERCISES, MAIN_LIFTS, MUSCLE_LABELS } from './exercises.js';
