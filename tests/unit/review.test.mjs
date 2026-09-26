import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { after } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveSession } from '../../src/core/prescribe.js';
import { deriveCursors, makeHistoryLookup } from '../../src/core/schedule.js';
import { buildBackup } from '../../src/core/schema.js';
import { addDays, dayOfWeek } from '../../src/core/dates.js';
import { program } from './_fixtures.mjs';

// Temp directories are cleaned up rather than left in os.tmpdir() by every run.
const tmpDirs = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'review-'));
  tmpDirs.push(d);
  return d;
};
after(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

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
    const dow = dayOfWeek(date);
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

/** Run the tool, capturing status and BOTH streams whether it succeeds or not. */
function runTool(argv) {
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** The simulated block, for tests that only need some plausible data. */
const run0 = () => simulate();

test('the review tool reports on a real backup: every section, the rules that should fire', () => {
  const { meta, sessions } = simulate();
  const payload = buildBackup(meta, sessions, [], 'test');
  payload.exportedAt = '2026-10-26T10:00:00.000Z';
  const dir = tmp();
  const file = path.join(dir, 'backup.json');
  fs.writeFileSync(file, JSON.stringify(payload));

  const md = runTool(['tools/review.mjs', file, '--stdout']).stdout;

  for (const section of ['# Coaching review — 2026-10-26', '## Adherence', '## Main lifts', '### Incline Barbell Bench Press', '### Standing Barbell Overhead Press', '### Weighted Pull-Up', '## Accessories and legs', '## Running', '## Bodyweight', '## Recovery signals', '## Data quality', '## Rules that fired']) {
    assert.ok(md.includes(section), `missing ${section}`);
  }
  assert.match(md, /Block \*\*\d, week \d of \d\*\*/);
  assert.match(md, /Core at the end of Lower\/Push: \*\*\d+ of \d+\*\*/);
  assert.match(md, /\*\*core\*\* — Core adherence \d+% < 75%/, 'Lower skipped its core every time');
  assert.match(md, /\*\*accessory\*\* — Cable Lateral @ Home \/ left stack: 15 kg × [\d/]+ for \d+ sessions with no added reps/, 'the deliberately stalled laterals');
  assert.match(md, /\*\*template\*\* — Tuesday easy runs \(the day after legs\): CR10 [\d.]+ and talk test failed on \d+%/, 'both halves of the §4.3 rule');
  assert.match(md, /\*\*energy\*\* — Bodyweight 82 → 81\.2 kg/, 'the drift flag');
  assert.match(md, /\*\*deload\*\* — \d+ sessions rated Rough\/Flat in the last 7 days/, 'condition (c)');
  assert.match(md, /Reference (?:established at )?[\d.]+ → \*\*[\d.]+\*\* kg · back-off load [\d.]+ → [\d.]+ kg · \d+ increases? in the period/);
  assert.ok(!md.includes('undefined'), 'no undefined leaked into the report');

  // Writes a dated file when not on stdout.
  const out = runTool(['tools/review.mjs', file, '--out', dir]).stdout;
  assert.match(out, /wrote .*2026-10-26\.md · \d+ rules? fired/);
  assert.ok(fs.existsSync(path.join(dir, '2026-10-26.md')));
});

test('the review tool refuses a backup that does not validate, and says why', () => {
  const dir = tmp();
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, '{"format":"nope"}');
  // Asserting only "it threw" would be satisfied by review.mjs crashing on a
  // bad import, which is the opposite of what this test is for.
  const e = runTool(['tools/review.mjs', file, '--stdout']);
  assert.equal(e.status, 1);
  assert.match(e.stderr, /backup did not validate/);
});

test('boolean flags do not swallow the filename, and --since is validated', () => {
  const dir = tmp();
  const file = path.join(dir, 'b.json');
  fs.writeFileSync(file, JSON.stringify(buildBackup({ startDate: '2026-09-14' }, [], [], 'test')));

  // `--stdout backup.json` used to discard the file as --stdout's value.
  const ok = runTool(['tools/review.mjs', '--stdout', file]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /# Coaching review/);

  const bad = runTool(['tools/review.mjs', file, '--since', '--stdout']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--since needs a value|--since must be YYYY-MM-DD/);

  const junk = runTool(['tools/review.mjs', file, '--since', 'last-tuesday']);
  assert.equal(junk.status, 2);
  assert.match(junk.stderr, /--since must be YYYY-MM-DD/);
});

test('sessions dropped by validation are reported, not silently omitted', () => {
  const dir = tmp();
  const file = path.join(dir, 'partial.json');
  const good = run0();
  const payload = buildBackup(good.meta, [...good.sessions, { id: 'broken', date: 'not-a-date', kind: 'lift', status: 'completed' }], [], 'test');
  payload.exportedAt = '2026-10-26T10:00:00.000Z';
  fs.writeFileSync(file, JSON.stringify(payload));
  const r = runTool(['tools/review.mjs', file, '--stdout']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /failed validation and are NOT in this report/);
  assert.match(r.stderr, /dropped by validation/);
});

// ---------------------------------------------------------------------------
// The rules that fire have to be the rules that are true.
// ---------------------------------------------------------------------------

/** A heavy incline session: one probe, three back-offs, on a given date. */
const heavy = (date, { probe, probeRpe = 8, backoff, reps = 6, boRpe = 8, role = 'probe', isDeload = false }) => ({
  id: `h-${date}`, date, startedAt: 1, completedAt: 2, updatedAt: 2, status: 'completed',
  kind: 'lift', dayKey: 'lift:A', gymId: null,
  programRef: { programId: program.programId, version: 3, dayKey: 'lift:A', role, isDeload },
  prescriptionSnapshot: { name: 'Upper Push', dayKey: 'lift:A', role, entries: [] },
  bodyweightKg: 82,
  entries: [{
    entryId: 'e0', exerciseId: 'incline-bench', order: 0, group: null, station: null,
    sets: [
      { setId: 's0', index: 0, type: 'probe', weightKg: probe, reps: 4, rpe: probeRpe, done: true, ts: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({ setId: `s${i + 1}`, index: i + 1, type: 'backoff', weightKg: backoff, reps, rpe: boRpe, done: true, ts: 1 })),
    ],
  }],
  run: null, notes: '', feeling: 4,
});

const reportFor = (sessions, metaOver = {}) => {
  const dir = tmp();
  const file = path.join(dir, 'b.json');
  const payload = buildBackup(
    { startDate: '2026-09-14', bodyweightKg: 82, programVersion: 3, priorLowerLimbInjury: false,
      v3StartedAt: { date: '2026-09-14', weekStart: '2026-09-14', runWeekAtStart: 1, liftCompleted: 0, deloadFirst: false },
      ...metaOver },
    sessions, [], 'test',
  );
  payload.exportedAt = '2026-11-30T10:00:00.000Z';
  fs.writeFileSync(file, JSON.stringify(payload));
  const r = runTool(['tools/review.mjs', file, '--stdout']);
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('two sessions that RAISED the reference do not read as a reactive deload', () => {
  // The bug: each probe was compared against the reference computed AFTER its
  // own back-offs had pushed it up, so clearing the range twice — the
  // definition of progress — recommended a deload.
  const md = reportFor([
    heavy('2026-09-16', { probe: 80, backoff: 80 }),
    heavy('2026-09-23', { probe: 82.5, backoff: 82.5 }),
  ]);
  assert.doesNotMatch(md, /reactive-deload condition \(a\)/, md.slice(md.indexOf('## Rules')));
  assert.match(md, /1 increase in the period/);
});

test('a probe genuinely under the reference it was lifted against does fire condition (a)', () => {
  const md = reportFor([
    heavy('2026-09-16', { probe: 100, backoff: 96 }),   // establishes ~120
    heavy('2026-09-23', { probe: 88, backoff: 96, reps: 5 }),  // ~105.6, >3% under
    heavy('2026-09-30', { probe: 88, backoff: 96, reps: 5 }),
  ]);
  assert.match(md, /\*\*deload\*\* — Incline Bench: probe e1RM ≥ 3% under the reference it was lifted against, twice running/);
});

test('two complete blocks without an increment fire the stall protocol', () => {
  // probe, probe, test, deload — twice, with the load never moving. The old
  // check keyed off a counter that a deload reset, so this was unreachable.
  const block = (weeks, from) =>
    weeks.map((role, i) => heavy(from[i], { probe: 80, probeRpe: role === 'test' ? 9 : role === 'deload' ? 6 : 8, backoff: 80, reps: 5, boRpe: 8.5, role, isDeload: role === 'deload' }));
  // Three blocks: the first establishes the reference (which cannot be a
  // stall), the next two go nowhere.
  const md = reportFor([
    ...block(['probe', 'probe', 'test', 'deload'], ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23']),
    ...block(['probe', 'probe', 'test', 'deload'], ['2026-09-30', '2026-10-07', '2026-10-14', '2026-10-21']),
    ...block(['probe', 'probe', 'test', 'deload'], ['2026-10-28', '2026-11-04', '2026-11-11', '2026-11-18']),
  ], { v3StartedAt: { date: '2026-09-01', weekStart: '2026-08-31', runWeekAtStart: 1, liftCompleted: 0, deloadFirst: false } });
  assert.match(md, /\*\*stall\*\* — Incline Bench: 2 complete blocks without an increment/);
  assert.match(md, /0 increases in the period/);
});

test('a custom increment is applied, so the report agrees with what the app prescribed', () => {
  // Every back-off clears the range, so the reference rises by one increment.
  const sessions = [heavy('2026-09-16', { probe: 80, backoff: 80 }), heavy('2026-09-23', { probe: 80, backoff: 80 })];
  const standard = reportFor(sessions);
  const custom = reportFor(sessions, { increments: { 'incline-bench': 5 } });
  const bar = (md) => Number(md.match(/back-off load [\d.]+ → ([\d.]+) kg/)[1]);
  assert.ok(bar(custom) > bar(standard), `custom ${bar(custom)} should exceed standard ${bar(standard)}`);
  assert.equal(bar(custom) % 5, 0, 'and land on the 5 kg steps the athlete actually has');
});

test('the weekly rail is reported once per week, not once per run in it', () => {
  const run2 = (date, km, variant) => ({
    id: `r-${date}`, date, startedAt: 1, completedAt: 2, updatedAt: 2, status: 'completed', kind: 'run',
    dayKey: `run:${variant}`, variant,
    programRef: { programId: program.programId, version: 3, dayKey: `run:${variant}`, runWeek: 6 },
    prescriptionSnapshot: { name: variant === 'long' ? 'Long Run' : 'Easy Run', kind: 'run' },
    entries: [], run: { distanceKm: km, durationSec: km * 400, effort: 4, talkTest: 'yes', notes: '' }, feeling: 4,
  });
  // 5 km one week; 5 + 6 the next is a 120% jump — one weekly rail, not two.
  const md = reportFor([run2('2026-09-19', 5, 'long'), run2('2026-09-22', 5, 'easy'), run2('2026-09-26', 6, 'long')]);
  const weekly = [...md.matchAll(/This week would total/g)];
  assert.equal(weekly.length, 1, md.slice(md.indexOf('## Rules')));
});
