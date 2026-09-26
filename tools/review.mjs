#!/usr/bin/env node
/**
 * Coaching review: turn a backup JSON into a Markdown report that applies the
 * program's own rules (research/SYNTHESIS.md) to what was actually logged.
 *
 *   node tools/review.mjs coach/data/backups/training-backup-*.json
 *   node tools/review.mjs <backup.json> --since 2026-09-14 --out coach/reports
 *   node tools/review.mjs <backup.json> --stdout
 *
 * Deterministic on purpose: every number in the report is computed here, from
 * the same DOM-free core modules the app runs, so a review never depends on
 * anyone remembering a number. The judgement calls stay with the reader.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateBackup, sessionIntegrity } from '../src/core/schema.js';
import { deriveCursors, makeHistoryLookup } from '../src/core/schedule.js';
import {
  blockReference, e1rm, effectiveLoad, formatPace, runLoadWarnings, loadFromReference,
} from '../src/core/progression.js';
import { coreAdherence, easyRunEffortByWeekday, weeklyRunVolume, runSeries } from '../src/core/stats.js';
import { startOfWeek, addDays, daysBetween, formatDuration, trainingDate } from '../src/core/dates.js';
import { PROGRAMS, CURRENT_PROGRAM, getExercise, MAIN_LIFTS } from '../src/program/index.js';
import { setIncrementOverrides } from '../src/program/exercises.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const BOOLEAN_FLAGS = new Set(['--stdout', '--help']);
const USAGE = 'usage: node tools/review.mjs <backup.json> [--since YYYY-MM-DD] [--out dir] [--stdout]';

/** Parse argv into { file, flags }. Boolean flags do not swallow the next token. */
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      rest.push(a);
      continue;
    }
    if (BOOLEAN_FLAGS.has(a)) {
      flags[a] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) die(`${a} needs a value.`);
    flags[a] = value;
    i++;
  }
  return { file: rest[0], flags };
}

function die(message, code = 2) {
  console.error(message);
  console.error(USAGE);
  process.exit(code);
}

const { file, flags } = parseArgs(process.argv.slice(2));
if (flags['--help']) {
  console.log(USAGE);
  process.exit(0);
}
if (!file) die('no backup file given.');
if (flags['--since'] && !/^\d{4}-\d{2}-\d{2}$/.test(flags['--since'])) die(`--since must be YYYY-MM-DD, got "${flags['--since']}".`);

const v = validateBackup(fs.readFileSync(file, 'utf8'));
if (!v.ok) {
  console.error('backup did not validate:', v.errors.join('; '));
  process.exit(1);
}
const { meta, sessions, routes = [] } = v.data;
// Sessions validateBackup threw out are NOT silently missing from the review:
// a report computed on a subset would understate adherence and could invent a
// gap. They are reported here and again under Data quality.
const dropped = v.warnings ?? [];
if (dropped.length) console.error(`${dropped.length} record(s) were dropped by validation — see the Data quality section.`);

const program = PROGRAMS[meta.programVersion] ?? CURRENT_PROGRAM;
// Custom increments are configuration for the prescription layer; the app
// installs them at boot (data/store.js). Without this the reference maths here
// would move loads in catalogue steps and disagree with what the app prescribed.
setIncrementOverrides(meta.increments);

// The log is kept in LOCAL training dates (with a 03:00 rollover), so the end
// of the period has to be one too. Slicing the UTC date out of `exportedAt`
// put `today` a day behind the log for any export made after local midnight.
const today = v.data.exportedAt ? trainingDate(new Date(v.data.exportedAt)) : trainingDate();
const since = flags['--since'] ?? meta.v3StartedAt?.date ?? addDays(today, -56);
const outDir = flags['--out'] ?? path.join(ROOT, 'coach', 'reports');
const toStdout = !!flags['--stdout'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const completed = sessions.filter((s) => s.status === 'completed').sort((a, b) => (a.date < b.date ? -1 : 1));
const inPeriod = (s) => s.date >= since && s.date <= today;
const period = completed.filter(inPeriod);
const skipped = sessions.filter((s) => s.status === 'skipped' && inPeriod(s));
const fmt = (n, d = 1) => (n == null || Number.isNaN(n) ? '—' : Number(n).toFixed(d).replace(/\.0+$/, ''));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const gymName = (id) => (id == null ? '' : (meta.gyms ?? []).find((g) => g.id === id)?.name ?? 'deleted gym');
const weeksIn = Math.max(1, Math.round(daysBetween(since, today) / 7));
const lines = [];
const h = (level, text) => lines.push('', `${'#'.repeat(level)} ${text}`, '');
const p = (text) => lines.push(text, '');
const table = (head, rows) => {
  if (!rows.length) return p('_nothing logged_');
  lines.push(`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`);
  for (const r of rows) lines.push(`| ${r.map((c) => (c == null ? '—' : String(c))).join(' | ')} |`);
  lines.push('');
};
const fired = [];
const flagIt = (kind, text) => fired.push({ kind, text });

// ---------------------------------------------------------------------------
// 1. Header
// ---------------------------------------------------------------------------

const cursors = deriveCursors(sessions, program, { meta, today });
lines.push(`# Coaching review — ${today}`);
p(`Period **${since} → ${today}** (${weeksIn} week${weeksIn === 1 ? '' : 's'}) · program v${program.version} · ${period.length} completed sessions, ${skipped.length} skipped · export ${path.basename(file)}`);
p(
  `Block **${cursors.mesocycle}, week ${cursors.weekInMeso} of ${cursors.blockLength}** (${cursors.role}, clock: ${cursors.mesoSource}) · run week **${cursors.run.week}** · ${cursors.lift.completed} lifts, ${cursors.run.longCompleted} long / ${cursors.run.easyCompleted} easy runs, ${cursors.core.completed} core sessions all-time` +
    (meta.v3StartedAt ? ` · v3 since ${meta.v3StartedAt.date}${meta.v3StartedAt.deloadFirst ? ' (entered through a deload)' : ''}` : '') +
    (meta.priorLowerLimbInjury === true ? ' · **previous lower-limb injury: yes** (hold rules are stops)' : meta.priorLowerLimbInjury === false ? ' · previous injury: no' : ' · previous injury: not answered'),
);

// ---------------------------------------------------------------------------
// 2. Adherence
// ---------------------------------------------------------------------------

h(2, 'Adherence');
const count = (kind, list) => list.filter((s) => s.kind === kind).length;
table(
  ['Track', 'Done', 'Skipped', 'Planned', 'Rate'],
  [
    ['Lifts', count('lift', period.filter((s) => s.dayKey !== 'lift:E')), count('lift', skipped), weeksIn * program.liftsPerWeek, pct(count('lift', period.filter((s) => s.dayKey !== 'lift:E')), weeksIn * program.liftsPerWeek)],
    ['Bonus day', count('lift', period.filter((s) => s.dayKey === 'lift:E')), '—', 'optional', '—'],
    ['Runs', count('run', period), count('run', skipped), weeksIn * 2, pct(count('run', period), weeksIn * 2)],
    ['Core (standalone)', count('core', period), count('core', skipped), 'optional', '—'],
  ],
);
const coreStat = coreAdherence(sessions, program, { since });
if (coreStat && coreStat.hosts) {
  p(`Core at the end of Lower/Push: **${coreStat.done} of ${coreStat.hosts}** (${coreStat.pct}%). ${coreStat.ok ? 'Above the 75% line — the placement holds.' : '**Under 75% — SYNTHESIS §5.4 says the placement is wrong, not the athlete. Move it or shrink it.**'}`);
  if (!coreStat.ok) flagIt('core', `Core adherence ${coreStat.pct}% < 75%: revisit where core lives (§5.4).`);
}

// ---------------------------------------------------------------------------
// 3. Main lifts
// ---------------------------------------------------------------------------

h(2, 'Main lifts');
const lookup = makeHistoryLookup(sessions);
for (const liftId of MAIN_LIFTS) {
  const ex = getExercise(liftId);
  const heavyKey = Object.values(program.liftDays).find((d) => d.blocks.some((b) => b.exerciseId === liftId && (b.scheme === 'probe_backoff' || b.scheme === 'top_backoff')))?.key;
  const volumeKey = Object.values(program.liftDays).find((d) => d.blocks.some((b) => b.exerciseId === liftId && b.scheme === 'double_progression'))?.key;
  const block = heavyKey ? program.liftDays[heavyKey.split(':')[1]].blocks.find((b) => b.exerciseId === liftId) : null;
  h(3, `${ex.name}`);

  const heavyRows = [...(lookup(liftId, { dayKey: heavyKey, all: true }) ?? [])].reverse(); // oldest first
  const blockSpec = block ?? { backoff: { pctOfReference: 0.8, repMax: 6 } };
  const pctOfRef = blockSpec.backoff?.pctOfReference ?? 0.8;
  /** The reference as it stood BEFORE session `i` — what that session lifted against. */
  const referenceBefore = (i) => blockReference(heavyRows.slice(0, i), blockSpec, ex);

  const rows = [];
  const refTrail = [];
  const firstInPeriod = heavyRows.findIndex((r) => r.date >= since);
  let raises = 0;
  let peak = firstInPeriod < 0 ? null : referenceBefore(firstInPeriod).e1rm;
  const openingRef = peak;

  for (let i = Math.max(0, firstInPeriod); i < heavyRows.length && firstInPeriod >= 0; i++) {
    const r = heavyRows[i];
    const before = referenceBefore(i);
    const after = blockReference(heavyRows.slice(0, i + 1), blockSpec, ex);
    const probe = (r.sets ?? []).find((s) => s.done && (s.type === 'probe' || s.type === 'top'));
    const bos = (r.sets ?? []).filter((s) => s.done && s.type === 'backoff');
    const probeE1 = probe ? e1rm(effectiveLoad(probe, ex, r.bodyweightKg), probe.reps, probe.rpe) : null;

    // A raise is the reference reaching a NEW HIGH. Counting every upward step
    // instead double-counted recovery from the test-week seed, which can move
    // the reference DOWN on the deload row — so the next session's return to
    // the old number read as progress that was never made.
    if (after.e1rm != null) {
      // The first value seen is the baseline, not an increase.
      if (peak == null) peak = after.e1rm;
      else if (after.e1rm > peak + 1e-9) {
        raises++;
        peak = after.e1rm;
      }
    }
    refTrail.push({
      date: r.date,
      refBefore: before.e1rm,
      refAfter: after.e1rm,
      probeE1,
      role: r.role,
      isDeload: r.isDeload,
    });
    rows.push([
      r.date,
      r.role ?? (r.isDeload ? 'deload' : '—'),
      probe ? `${fmt(probe.weightKg, 2)}${ex.loadModel === 'bodyweight_plus' ? '+' : ''} × ${probe.reps}${probe.rpe ? ` @${probe.rpe}` : ''}` : '—',
      probeE1 ? fmt(probeE1) : '—',
      bos.length ? bos.map((s) => `${fmt(s.weightKg, 2)}×${s.reps}${s.rpe ? `@${s.rpe}` : ''}`).join(' · ') : '—',
      after.e1rm ? fmt(after.e1rm) : '—',
      after.source ?? '—',
    ]);
  }
  p(`Heavy day (${heavyKey ?? '?'}) — probe, back-offs and the block reference after each session:`);
  table(['Date', 'Role', 'Probe', 'Probe e1RM', 'Back-offs', 'Reference', 'Set by'], rows);

  if (refTrail.length) {
    const last = refTrail[refTrail.length - 1];
    const onBar = (e1) => (e1 == null ? null : loadFromReference(e1, pctOfRef, ex, meta.bodyweightKg));
    // With no reference before the period there was nothing to lift against —
    // the first session in it established one.
    const from = openingRef ?? refTrail[0].refAfter;
    const fromTxt = openingRef == null ? `established at ${fmt(from)}` : fmt(from);
    p(
      `Reference ${fromTxt} → **${fmt(last.refAfter)}** kg${ex.loadModel === 'bodyweight_plus' ? ' (system mass)' : ''}` +
        ` · back-off load ${fmt(onBar(from), 2)} → ${fmt(onBar(last.refAfter), 2)} kg` +
        ` · ${raises} increase${raises === 1 ? '' : 's'} in the period.`,
    );

    // Stall protocol (§1.4): one increment per BLOCK is success, two blocks
    // without one is a stall. Counting from blockReference's own `stalls` did
    // not work — it resets on the deload that follows a test probe whether or
    // not the reference moved, so a genuine two-block stall was unreachable.
    // Blocks are counted here from the deload rows, which is what a block is.
    const blocks = [];
    let current = [];
    for (const t of refTrail) {
      current.push(t);
      if (t.isDeload) {
        blocks.push(current);
        current = [];
      }
    }
    if (current.length) blocks.push(current);
    // The block that CREATES the reference cannot have stalled — there was
    // nothing to add an increment to.
    const gained = (b) => {
      const open = b[0].refBefore;
      if (open == null) return true;
      return (b[b.length - 1].refAfter ?? 0) - open > 1e-9;
    };
    let barren = 0;
    for (let i = blocks.length - 1; i >= 0 && !gained(blocks[i]); i--) barren++;
    const sessionsSince = refTrail.length - 1 - refTrail.map((t) => t.refAfter).lastIndexOf(peak);

    if (barren >= 2) {
      flagIt('stall', `${ex.short}: ${barren} complete blocks without an increment. Stall protocol §1.4, in order: check running load and sleep → swap the heavy-day rep scheme → rotate the volume-day variant → reset the reference 5% and rebuild in ${fmt(ex.afterMisses?.increment ?? ex.increment, 2)} kg steps.`);
    } else if (barren === 1 && blocks.length > 1) {
      flagIt('watch', `${ex.short}: one full block without an increment (${sessionsSince} heavy sessions). One more and the stall protocol starts.`);
    }

    // Reactive deload (a), §5.3: the probe coming in ≥ 3% under the reference
    // it was lifted AGAINST, twice running. Comparing against the reference
    // after the session was folded in made every successful back-off session
    // look like a 3% shortfall — two good sessions in a row recommended a
    // deload.
    const recent = refTrail.filter((t) => !t.isDeload && t.probeE1 && t.refBefore).slice(-2);
    if (recent.length === 2 && recent.every((t) => t.probeE1 < t.refBefore * 0.97)) {
      flagIt('deload', `${ex.short}: probe e1RM ≥ 3% under the reference it was lifted against, twice running (${recent.map((t) => `${fmt(t.probeE1)} vs ${fmt(t.refBefore)}`).join(', ')}) — reactive-deload condition (a), §5.3.`);
    }
  }

  const volRows = [...(lookup(liftId, { dayKey: volumeKey, all: true }) ?? [])].reverse().filter((r) => r.date >= since);
  if (volRows.length) {
    const summary = (r) => {
      const done = (r.sets ?? []).filter((s) => s.done);
      const top = Math.max(...done.map((s) => s.weightKg ?? 0));
      const reps = done.filter((s) => (s.weightKg ?? 0) === top).map((s) => s.reps);
      const maxRpe = Math.max(0, ...done.map((s) => s.rpe ?? 0));
      return { top, reps, maxRpe };
    };
    const a = summary(volRows[0]);
    const b = summary(volRows[volRows.length - 1]);
    p(`Volume day (${volumeKey}): ${volRows.length} sessions · ${fmt(a.top, 2)} kg × ${a.reps.join('/')} → **${fmt(b.top, 2)} kg × ${b.reps.join('/')}**${b.maxRpe ? ` (max RPE ${b.maxRpe})` : ''}.`);
  }
}

// ---------------------------------------------------------------------------
// 4. Accessories and legs
// ---------------------------------------------------------------------------

h(2, 'Accessories and legs');
p('Top load per session on each exercise (per gym / station for stack work). "Stuck" means the top load has not moved AND the reps are not climbing — adding reps at the same load is double progression working, not a stall.');
const byExercise = new Map();
for (const s of period) {
  if (s.kind !== 'lift') continue;
  const snap = s.prescriptionSnapshot?.entries ?? [];
  for (const e of s.entries ?? []) {
    if (MAIN_LIFTS.includes(e.exerciseId)) continue;
    const done = (e.sets ?? []).filter((x) => x.done && x.reps);
    if (!done.length) continue;
    const ex = getExercise(e.exerciseId);
    const scope = ex.gymSpecific ? `${e.exerciseId}@${s.gymId ?? 'nogym'}${e.station ? `/${e.station}` : ''}` : e.exerciseId;
    if (!byExercise.has(scope)) byExercise.set(scope, { ex, gymId: ex.gymSpecific ? s.gymId : null, station: e.station ?? null, sessions: [] });
    const top = Math.max(...done.map((x) => x.weightKg ?? 0));
    const atTop = done.filter((x) => (x.weightKg ?? 0) === top);
    // The rep ceiling the session was actually prescribed, so "range filled"
    // means what the program meant by it rather than a guess.
    const repMax = snap.find((x) => x.exerciseId === e.exerciseId)?.plannedSets?.[0]?.targetRepMax ?? null;
    byExercise.get(scope).sessions.push({
      date: s.date, top, repMax,
      reps: atTop.map((x) => x.reps),
      worstReps: Math.min(...atTop.map((x) => x.reps)),
      rpe: Math.max(0, ...atTop.map((x) => x.rpe ?? 0)),
      group: e.group, day: s.dayKey,
    });
  }
}
const accRows = [];
for (const [, v] of [...byExercise.entries()].sort((a, b) => a[1].ex.name.localeCompare(b[1].ex.name))) {
  const ss = v.sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = ss[ss.length - 1];
  const loaded = v.ex.metric === 'weight_reps';

  // Sessions at the current top load, most recent first.
  let atLoad = 0;
  for (let i = ss.length - 1; i >= 0 && ss[i].top === last.top; i--) atLoad++;
  const run = ss.slice(ss.length - atLoad);
  // Genuinely stalled only if the reps are not climbing across that run, which
  // is the other half of double progression. If the range is filled and it
  // still has not moved, that is a stall with a name.
  const repsClimbing = run.length > 1 && last.worstReps > run[0].worstReps;
  const rangeFilled = last.repMax != null && last.worstReps >= last.repMax;
  const stuck = loaded && atLoad >= 3 && !repsClimbing;

  const status = !loaded
    ? `${ss[0].reps.join('/')} → ${last.reps.join('/')} reps`
    : ss.length === 1
      ? 'first session'
      : stuck
        ? `**stuck ${atLoad} sessions**`
        : repsClimbing
          ? `+${last.worstReps - run[0].worstReps} reps @ ${fmt(last.top, 2)} kg`
          : ss[0].top < last.top
            ? `+${fmt(last.top - ss[0].top, 2)} kg`
            : 'holding';
  const where = v.gymId ? ` @ ${gymName(v.gymId)}${v.station ? ` / ${v.station}` : ''}` : '';
  if (stuck) {
    flagIt(
      'accessory',
      `${v.ex.short}${where}: ${fmt(last.top, 2)} kg × ${last.reps.join('/')} for ${atLoad} sessions with no added reps` +
        (rangeFilled ? ' and the rep range already filled — the load should have gone up.' : '.'),
    );
  }
  accRows.push([
    v.ex.short + (last.group === 'core' ? ' (core)' : ''),
    v.gymId ? `${gymName(v.gymId)}${v.station ? ` / ${v.station}` : ''}` : v.ex.gymSpecific ? 'no gym set' : '—',
    ss.length,
    loaded ? `${fmt(last.top, 2)} × ${last.reps.join('/')}${last.rpe ? ` @${last.rpe}` : ''}` : `${last.reps.join('/')} reps`,
    status,
  ]);
}
table(['Exercise', 'Gym / station', 'Sessions', 'Last', 'Trend'], accRows);

// ---------------------------------------------------------------------------
// 5. Running
// ---------------------------------------------------------------------------

h(2, 'Running');
const runs = runSeries(sessions).filter((r) => r.date >= since);
const runRows = [];
const weeklyFlagged = new Set();
for (const r of runs) {
  const s = sessions.find((x) => x.id === r.sessionId);
  const wk = s?.programRef?.runWeek;
  // The plan the session ACTUALLY ran under: a v2 run must not be judged
  // against v3's ladder, and a run with no recorded week has no target at all
  // rather than being shown the post-10K maintenance line.
  const ranUnder = PROGRAMS[s?.programRef?.version] ?? program;
  const target = wk == null ? null : (ranUnder.runPlan.find((w) => w.week === wk) ?? ranUnder.runMaintenance)?.[r.variant];
  const targetStr = !target ? '—' : target.kind === 'time' ? `${target.minutes} min` : `${target.km} km`;

  // Judged against what was known AT THE TIME: passing the whole log let a
  // Tuesday run be blamed for the Saturday long run that had not happened yet.
  const asOf = sessions.filter((x) => x.date <= r.date);
  const warn = runLoadWarnings(asOf, { km: r.km, date: r.date, sessionId: r.sessionId }, { today: r.date, priorInjury: meta.priorLowerLimbInjury === true });
  runRows.push([
    r.date,
    r.variant,
    wk ?? '—',
    targetStr,
    `${fmt(r.km, 2)} km`,
    formatDuration(r.sec),
    formatPace(r.pace),
    s?.run?.effort ?? '—',
    s?.run?.talkTest === 'yes' ? '✓' : s?.run?.talkTest === 'no' ? '✗' : '—',
    warn.map((w) => w.kind).join(', ') || '',
  ]);
  for (const w of warn) {
    // One weekly-total rail per week, not once per run in it — the same event
    // was being reported two or three times over.
    if (w.kind === 'weekly') {
      const wkKey = startOfWeek(r.date);
      if (weeklyFlagged.has(wkKey)) continue;
      weeklyFlagged.add(wkKey);
    }
    flagIt('run-load', `${r.date} ${r.variant} ${fmt(r.km, 2)} km: ${w.message}`);
  }
  if (r.variant === 'easy' && s?.run?.effort >= 5) flagIt('intensity', `${r.date} easy run at CR10 ${s.run.effort} — an intensity error (§3.3).`);
}
table(['Date', 'Kind', 'Run wk', 'Target', 'Distance', 'Time', 'Pace', 'CR10', 'Talk', 'Rails'], runRows);

// Gaps ≥ 10 days → re-enter one rung down.
const allRuns = runSeries(sessions);
for (let i = 1; i < allRuns.length; i++) {
  const gap = daysBetween(allRuns[i - 1].date, allRuns[i].date);
  if (gap >= 10 && allRuns[i].date >= since) flagIt('gap', `${gap}-day gap in running before ${allRuns[i].date}: re-enter one rung down (deferred rule).`);
}
if (allRuns.length && daysBetween(allRuns[allRuns.length - 1].date, today) >= 10) {
  flagIt('gap', `No run for ${daysBetween(allRuns[allRuns.length - 1].date, today)} days as of the export: re-enter one rung down.`);
}

// Weekly km.
const weekly = weeklyRunVolume(sessions, today).filter((w) => w.weekStart >= startOfWeek(since));
if (weekly.length) {
  p('Weekly distance:');
  table(['Week of', 'km', 'vs previous'], weekly.map((w, i) => [w.weekStart, fmt(w.km, 1), i > 0 && weekly[i - 1].km ? `${Math.round((w.km / weekly[i - 1].km) * 100)}%` : '—']));
}

// Tuesday question (§4.3).
const byDay = easyRunEffortByWeekday(sessions, { since });
const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
if (byDay.length) {
  table(['Easy runs by weekday', 'Runs', 'Mean CR10', 'Talk test failed'], byDay.map((r) => [names[r.dow], r.runs, r.meanRpe ?? '—', r.talkNegativePct != null ? `${r.talkNegativePct}%` : '—']));
  // §4.3: "consistently RPE ≥ 5 OR Talk-Test-negative" on Tuesday while
  // Thursday is not. Only the RPE half was implemented, so a block of runs
  // that failed the talk test at CR10 4 — exactly the case the talk test is
  // there to catch — answered "keep".
  const tue = byDay.find((r) => r.dow === 2);
  const thu = byDay.find((r) => r.dow === 4);
  const laboured = (d) => !!d && ((d.meanRpe != null && d.meanRpe >= 5) || (d.talkNegativePct != null && d.talkNegativePct >= 50));
  if (tue?.runs >= 3 && laboured(tue) && !laboured(thu)) {
    const why = [
      tue.meanRpe >= 5 ? `CR10 ${tue.meanRpe}` : null,
      tue.talkNegativePct >= 50 ? `talk test failed on ${tue.talkNegativePct}%` : null,
    ].filter(Boolean).join(' and ');
    flagIt('template', `Tuesday easy runs (the day after legs): ${why} over ${tue.runs} runs${thu?.runs ? ` while Thursday sits at CR10 ${thu.meanRpe ?? '—'}/${thu.talkNegativePct ?? 0}%` : ' and Thursday has no runs to compare'}: §4.3 says move the easy run to Thursday and make Tuesday the optional slot.`);
  } else if (tue?.runs >= 3) {
    p(`Tuesday runs (day after legs): CR10 ${tue.meanRpe ?? '—'}, talk test failed on ${tue.talkNegativePct ?? 0}% — the template question stays answered "keep".`);
  } else if (tue) {
    p(`Only ${tue.runs} Tuesday run${tue.runs === 1 ? '' : 's'} in the period — not enough to answer the template question yet (§4.3 wants a block).`);
  }
}

// ---------------------------------------------------------------------------
// 6. Bodyweight and energy
// ---------------------------------------------------------------------------

h(2, 'Bodyweight');
const bw = (meta.bodyweightLog ?? []).filter((r) => r.date >= addDays(since, -14));
if (bw.length) {
  table(['Date', 'kg'], bw.map((r) => [r.date, fmt(r.kg, 1)]));
  const last = bw[bw.length - 1];
  const twoWeeksAgo = [...bw].reverse().find((r) => daysBetween(r.date, last.date) >= 12);
  if (twoWeeksAgo && last.kg - twoWeeksAgo.kg <= -0.5) {
    flagIt('energy', `Bodyweight ${fmt(twoWeeksAgo.kg, 1)} → ${fmt(last.kg, 1)} kg over ${daysBetween(twoWeeksAgo.date, last.date)} days during the build: a nutrition signal, not a training one (§4.5, ~+100 kcal per easy km).`);
  }
} else p(`Current ${meta.bodyweightKg ?? '—'} kg; no dated readings in the period. Pull-up days ask for it — answer, it drives the reference.`);

// ---------------------------------------------------------------------------
// 7. Reactive deload conditions (b) and (c), feelings
// ---------------------------------------------------------------------------

h(2, 'Recovery signals');
const testWeeks = sessions.filter((s) => s.programRef?.role === 'test');
const missedTests = testWeeks.filter((s) => s.status === 'skipped' && s.date >= since).length;
if (missedTests >= 2) flagIt('deload', `${missedTests} test-week sessions skipped — reactive-deload condition (b), §5.3.`);
const rough = period.filter((s) => s.feeling != null && s.feeling <= 2);
const lastWeekRough = rough.filter((s) => daysBetween(s.date, today) <= 7).length;
p(`Sessions rated Rough/Flat in the period: ${rough.length} of ${period.filter((s) => s.feeling != null).length} rated${lastWeekRough >= 3 ? ` — **${lastWeekRough} in the last week** (condition (c), §5.3)` : ''}.`);
if (lastWeekRough >= 3) flagIt('deload', `${lastWeekRough} sessions rated Rough/Flat in the last 7 days — reactive-deload condition (c).`);

// ---------------------------------------------------------------------------
// 8. Data quality
// ---------------------------------------------------------------------------

h(2, 'Data quality');
const dq = [];
// Records validateBackup refused. Silently reviewing the survivors would
// understate adherence and could invent a running gap.
if (dropped.length) {
  dq.push(`**${dropped.length} record(s) in the backup failed validation and are NOT in this report**: ${dropped.slice(0, 5).join('; ')}${dropped.length > 5 ? ` (+${dropped.length - 5} more)` : ''}.`);
}
const noRpe = period.filter((s) => s.kind === 'lift').flatMap((s) => (s.entries ?? []).flatMap((e) => (e.sets ?? []).filter((x) => x.done && x.reps && x.weightKg != null && x.rpe == null && getExercise(e.exerciseId).metric === 'weight_reps'))).length;
if (noRpe) dq.push(`${noRpe} loaded sets logged without an RPE — the reference and every progression rule read RPE.`);
const noEffort = period.filter((s) => s.kind === 'run' && s.run && (s.run.effort == null || s.run.talkTest == null)).length;
if (noEffort) dq.push(`${noEffort} runs without CR10 or the talk test — they decide the Tuesday question.`);
if ((meta.gyms ?? []).length > 1) {
  const noGym = period.filter((s) => s.kind === 'lift' && s.gymId == null).length;
  if (noGym) dq.push(`${noGym} lift sessions with no gym set while two gyms exist — stack history is unscoped for those.`);
}
const mismatches = sessions.filter((s) => s.kind === 'lift' && !sessionIntegrity(s, PROGRAMS[s.programRef?.version] ?? program).ok);
if (mismatches.length) dq.push(`${mismatches.length} session${mismatches.length === 1 ? '' : 's'} whose title does not match its exercises: ${mismatches.map((s) => `${s.date} ${s.prescriptionSnapshot?.name}`).join(', ')}.`);
if (routes.length) dq.push(`${routes.length} saved route${routes.length === 1 ? '' : 's'}.`);
if (dq.length) for (const d of dq) lines.push(`- ${d}`);
else lines.push('- Nothing to flag.');
lines.push('');

// ---------------------------------------------------------------------------
// 9. Rules that fired
// ---------------------------------------------------------------------------

h(2, 'Rules that fired');
p('Generated from the program\'s own rules. They are inputs to the review, not conclusions — the reader decides what to change, and any program change goes through the reviewer.');
if (!fired.length) lines.push('- None. Carry on.');
for (const f of fired) lines.push(`- **${f.kind}** — ${f.text}`);
lines.push('');

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const md = lines.join('\n').replace(/\n{3,}/g, '\n\n');
if (toStdout) {
  process.stdout.write(md);
} else {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${today}.md`);
  fs.writeFileSync(out, md);
  console.log(`wrote ${path.relative(ROOT, out)} · ${fired.length} rule${fired.length === 1 ? '' : 's'} fired`);
}
