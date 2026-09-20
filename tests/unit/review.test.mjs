import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSession } from '../../src/core/prescribe.js';
import { deriveCursors, makeHistoryLookup } from '../../src/core/schedule.js';
import { buildBackup } from '../../src/core/schema.js';
import { addDays } from '../../src/core/dates.js';
import { program } from './_fixtures.mjs';

/**
 * Six simulated weeks of v3, exported and reviewed. The point is not the
 * numbers — it is that the report is produced from a real backup, every
 * section is there, and the rules fire on the data that should fire them.
 */

function simulate() {
  const sessions = [];
  const meta = {
    startDate: '2026-09-14', bodyweightKg: 82, programVersion: 3, gyms: [{ id: 'g1', name: 'Home' }, { id: 'g2', name: 'Downtown' }], lastGymId: 'g1',
    bodyweightLog: [{ date: '2026-09-14', kg: 82.5 }, { date: '2026-09-28', kg: 82 }, { date: '2026-10-12', kg: 81.2 }],
    priorLowerLimbInjury: false, substitutions: {},
    v3StartedAt: { date: '2026-09-14', weekStart: '2026-09-14', runWeekAtStart: 6, liftCompleted: 0, deloadFirst: false },
  };
  // Five long runs banked before v3 (run week 6 as of 14 Sep).
  for (let i = 0; i < 5; i++) {
    const date = addDays('2026-08-15', i * 7);
    sessions.push(run(`pre-${i}`, date, 'long', 5 - (4 - i) * 0.25, 4, 'yes', i + 1));
  }
  const BASE = { 'incline-bench': 80, ohp: 52.5, 'weighted-pullup': 15, 'back-squat': 120, rdl: 100, 'split-squat': 20, 'calf-raise': 80, 'cable-crunch': 20, 'pallof-press': 15, 'suitcase-carry': 24 };
  let n = 0;
  const liftDays = { 1: 'lift:B', 3: 'lift:A', 5: 'lift:C', 0: 'lift:D' };
  for (let d = 0; d < 42; d++) {
    const date = addDays('2026-09-14', d);
    const dow = new Date(date + 'T12:00').getDay();
    const state = { sessions, meta };
    const c = deriveCursors(sessions, program, { meta, today: date });
    if (liftDays[dow]) {
      const key = c.lift.nextDayKey;
      const r = resolveSession(program, key, { role: c.role, weekInMeso: c.weekInMeso, coreCompleted: c.core.completed, historyFor: makeHistoryLookup(sessions), bodyweightKg: 82, gymId: dow === 5 ? 'g2' : 'g1' });
      const s = liftFrom(`l-${n++}`, date, r, BASE, dow === 5 ? 'g2' : 'g1', d >= 35 ? 2 : 4);
      sessions.push(s);
    }
    if (dow === 2) sessions.push(run(`e-${n++}`, date, 'easy', 4.5, d > 14 ? 6 : 4, d > 14 ? 'no' : 'yes', c.run.week));
    if (dow === 6) {
      const plan = program.runPlan.find((w) => w.week === c.run.week);
      sessions.push(run(`L-${n++}`, date, 'long', plan?.long?.km ?? 6, 4, 'yes', c.run.week));
    }
  }
  return { meta, sessions };
}

function run(id, date, variant, km, effort, talkTest, runWeek) {
  return {
    id, date, startedAt: 1, completedAt: 2, updatedAt: 2, status: 'completed', kind: 'run', dayKey: `run:${variant}`, variant,
    programRef: { programId: program.programId, version: 3, dayKey: `run:${variant}`, runWeek },
    prescriptionSnapshot: { name: variant === 'long' ? 'Long Run' : 'Easy Run', kind: 'run' },
    entries: [], run: { distanceKm: km, durationSec: Math.round(km * 400), effort, talkTest, notes: '' }, feeling: 4,
  };
}

function liftFrom(id, date, resolved, BASE, gymId, feeling) {
  const entries = resolved.entries.map((e, i) => ({
    entryId: `e${i}`, exerciseId: e.exerciseId, order: i, group: e.group ?? null, station: e.exerciseId === 'cable-lateral-raise' ? 'left stack' : null,
    sets: e.plannedSets.map((p, j) => {
      const set = { setId: `s${j}`, index: j, type: p.type ?? 'work', weightKg: null, reps: null, seconds: null, rpe: null, done: true, ts: 1 };
      if (p.targetSeconds != null) set.seconds = p.targetSeconds;
      else set.reps = p.targetRepMax ?? p.targetReps ?? 8;
      if (p.weightKg !== undefined) set.weightKg = p.weightKg ?? BASE[e.exerciseId] ?? 20;
      if (set.type === 'probe') set.rpe = p.rpeTarget;
      else if (set.type === 'backoff') set.rpe = 8;
      else if (set.reps != null && p.weightKg !== undefined) set.rpe = 7;
      // Make the cable laterals stall: same load every time.
      if (e.exerciseId === 'cable-lateral-raise') { set.weightKg = 15; set.reps = 12; set.rpe = 9; }
      return set;
    }),
  }));
  // Skip core entirely on Lower to drag adherence under 75%.
  if (resolved.dayKey === 'lift:B') for (const e of entries) if (e.group === 'core') e.sets = [];
  return {
    id, date, startedAt: 1, completedAt: 2, updatedAt: 2, status: 'completed', kind: 'lift', dayKey: resolved.dayKey, gymId,
    programRef: { programId: program.programId, version: 3, dayKey: resolved.dayKey, role: resolved.role, isDeload: resolved.isDeload },
    prescriptionSnapshot: resolved, bodyweightKg: 82, entries, run: null, notes: '', feeling,
  };
}

test('the review tool reports on a real backup: every section, the rules that should fire', () => {
  const { meta, sessions } = simulate();
  const payload = buildBackup(meta, sessions, [], 'test');
  payload.exportedAt = '2026-10-26T10:00:00.000Z';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));
  const file = path.join(dir, 'backup.json');
  fs.writeFileSync(file, JSON.stringify(payload));

  const md = execFileSync(process.execPath, ['tools/review.mjs', file, '--stdout'], { encoding: 'utf8' });

  for (const section of ['# Coaching review — 2026-10-26', '## Adherence', '## Main lifts', '### Incline Barbell Bench Press', '### Standing Barbell Overhead Press', '### Weighted Pull-Up', '## Accessories and legs', '## Running', '## Bodyweight', '## Recovery signals', '## Data quality', '## Rules that fired']) {
    assert.ok(md.includes(section), `missing ${section}`);
  }
  assert.match(md, /Block \*\*\d, week \d of \d\*\*/);
  assert.match(md, /Core at the end of Lower\/Push: \*\*\d+ of \d+\*\*/);
  assert.match(md, /\*\*core\*\* — Core adherence \d+% < 75%/, 'Lower skipped its core every time');
  assert.match(md, /\*\*accessory\*\* — Cable Lateral @ Home \/ left stack: top load 15 kg for \d+ sessions/, 'the deliberately stalled laterals');
  assert.match(md, /\*\*template\*\* — Tuesday easy runs average CR10/, 'Tuesday runs went to CR10 6 with failed talk tests');
  assert.match(md, /\*\*energy\*\* — Bodyweight 82 → 81\.2 kg/, 'the drift flag');
  assert.match(md, /\*\*deload\*\* — \d+ sessions rated Rough\/Flat in the last 7 days/, 'condition (c)');
  assert.match(md, /Reference [\d.]+ → \*\*[\d.]+\*\* kg · \d+ raises? in the period/);
  assert.ok(!md.includes('undefined'), 'no undefined leaked into the report');

  // Writes a dated file when not on stdout.
  const out = execFileSync(process.execPath, ['tools/review.mjs', file, '--out', dir], { encoding: 'utf8' });
  assert.match(out, /wrote .*2026-10-26\.md · \d+ rules? fired/);
  assert.ok(fs.existsSync(path.join(dir, '2026-10-26.md')));
});

test('the review tool refuses a backup that does not validate', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, '{"format":"nope"}');
  assert.throws(() => execFileSync(process.execPath, ['tools/review.mjs', file, '--stdout'], { encoding: 'utf8', stdio: 'pipe' }));
});
