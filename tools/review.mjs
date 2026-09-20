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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = (f) => import(path.join(ROOT, 'src', 'core', f));
const { validateBackup, sessionIntegrity } = await core('schema.js');
const { deriveCursors, mesoState, makeHistoryLookup } = await core('schedule.js');
const { blockReference, e1rm, effectiveLoad, paceSecPerKm, formatPace, runLoadWarnings, SPIKE_LIMIT } = await core('progression.js');
const { coreAdherence, easyRunEffortByWeekday, weeklyRunVolume, runSeries } = await core('stats.js');
const { startOfWeek, addDays, daysBetween, formatDuration } = await core('dates.js');
const { PROGRAMS, CURRENT_PROGRAM, getExercise, MAIN_LIFTS } = await import(path.join(ROOT, 'src', 'program', 'index.js'));

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const file = args.find((a) => !a.startsWith('--') && (args.indexOf(a) === 0 || !args[args.indexOf(a) - 1]?.startsWith('--')));
if (!file) {
  console.error('usage: node tools/review.mjs <backup.json> [--since YYYY-MM-DD] [--out dir] [--stdout]');
  process.exit(2);
}
const raw = fs.readFileSync(file, 'utf8');
const v = validateBackup(raw);
if (!v.ok) {
  console.error('backup did not validate:', v.errors.join('; '));
  process.exit(1);
}
const { meta, sessions, routes = [] } = v.data;
const program = PROGRAMS[meta.programVersion] ?? CURRENT_PROGRAM;
const today = (raw.match(/"exportedAt":\s*"(\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? new Date().toISOString().slice(0, 10);
const since = flag('--since') ?? meta.v3StartedAt?.date ?? addDays(today, -56);
const outDir = flag('--out') ?? path.join(ROOT, 'coach', 'reports');
const toStdout = args.includes('--stdout');

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
const flags = [];
const flagIt = (kind, text) => flags.push({ kind, text });

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
  const rows = [];
  let raises = 0;
  let lastRef = null;
  const refTrail = [];
  for (let i = 0; i < heavyRows.length; i++) {
    const r = heavyRows[i];
    if (r.date < since) continue;
    const ref = blockReference(heavyRows.slice(0, i + 1), block ?? { backoff: { pctOfReference: 0.8, repMax: 6 } }, ex);
    const probe = (r.sets ?? []).find((s) => s.done && (s.type === 'probe' || s.type === 'top'));
    const bos = (r.sets ?? []).filter((s) => s.done && s.type === 'backoff');
    const probeE1 = probe ? e1rm(effectiveLoad(probe, ex, r.bodyweightKg), probe.reps, probe.rpe) : null;
    if (lastRef != null && ref.e1rm > lastRef + 1e-9 && !r.isDeload) raises++;
    lastRef = ref.e1rm;
    refTrail.push({ date: r.date, ref: ref.e1rm, probeE1, role: r.role, isDeload: r.isDeload, stalls: ref.stalls });
    rows.push([
      r.date,
      r.role ?? (r.isDeload ? 'deload' : '—'),
      probe ? `${fmt(probe.weightKg, 2)}${ex.loadModel === 'bodyweight_plus' ? '+' : ''} × ${probe.reps}${probe.rpe ? ` @${probe.rpe}` : ''}` : '—',
      probeE1 ? fmt(probeE1) : '—',
      bos.length ? bos.map((s) => `${fmt(s.weightKg, 2)}×${s.reps}${s.rpe ? `@${s.rpe}` : ''}`).join(' · ') : '—',
      ref.e1rm ? fmt(ref.e1rm) : '—',
      ref.source ?? '—',
    ]);
  }
  p(`Heavy day (${heavyKey ?? '?'}) — probe, back-offs and the block reference after each session:`);
  table(['Date', 'Role', 'Probe', 'Probe e1RM', 'Back-offs', 'Reference', 'Set by'], rows);

  if (refTrail.length) {
    const first = refTrail[0].ref;
    const last = refTrail[refTrail.length - 1];
    const lastStalls = last.stalls;
    p(`Reference ${fmt(first)} → **${fmt(last.ref)}** kg${ex.loadModel === 'bodyweight_plus' ? ' (system mass)' : ''} · ${raises} raise${raises === 1 ? '' : 's'} in the period · ${lastStalls} heavy session${lastStalls === 1 ? '' : 's'} since the last raise.`);
    // Stall protocol (§1.4): one increment per block is success; two blocks without is a stall.
    const heavyPerBlock = 3;
    if (lastStalls >= 2 * heavyPerBlock) {
      flagIt('stall', `${ex.short}: ${lastStalls} heavy sessions without a raise — two blocks. Stall protocol §1.4, in order: check running load and sleep → swap the heavy-day rep scheme → rotate the volume-day variant → reset the reference 5% and rebuild in 1.25 kg steps.`);
    } else if (lastStalls >= heavyPerBlock) {
      flagIt('watch', `${ex.short}: a full block without a raise. One more block and the stall protocol starts.`);
    }
    // Reactive deload (a): heavy-day e1RM ≥ 3% below the reference two sessions running.
    const recent = refTrail.filter((t) => !t.isDeload && t.probeE1).slice(-2);
    if (recent.length === 2 && recent.every((t) => t.probeE1 < t.ref * 0.97)) {
      flagIt('deload', `${ex.short}: probe e1RM ≥ 3% under the reference in the last two heavy sessions (${recent.map((t) => `${fmt(t.probeE1)} vs ${fmt(t.ref)}`).join(', ')}) — reactive-deload condition (a), §5.3.`);
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
p('Top load per session on each exercise (per gym / station for stack work). "Stuck" means the top load has not moved in three or more sessions with the rep range filled — a double-progression stall.');
const byExercise = new Map();
for (const s of period) {
  if (s.kind !== 'lift') continue;
  for (const e of s.entries ?? []) {
    if (MAIN_LIFTS.includes(e.exerciseId)) continue;
    const done = (e.sets ?? []).filter((x) => x.done && x.reps);
    if (!done.length) continue;
    const ex = getExercise(e.exerciseId);
    const scope = ex.gymSpecific ? `${e.exerciseId}@${s.gymId ?? 'nogym'}${e.station ? `/${e.station}` : ''}` : e.exerciseId;
    if (!byExercise.has(scope)) byExercise.set(scope, { ex, gymId: ex.gymSpecific ? s.gymId : null, station: e.station ?? null, sessions: [] });
    const top = Math.max(...done.map((x) => x.weightKg ?? 0));
    const atTop = done.filter((x) => (x.weightKg ?? 0) === top);
    byExercise.get(scope).sessions.push({ date: s.date, top, reps: atTop.map((x) => x.reps), rpe: Math.max(0, ...atTop.map((x) => x.rpe ?? 0)), group: e.group, day: s.dayKey });
  }
}
const accRows = [];
for (const [, v] of [...byExercise.entries()].sort((a, b) => a[1].ex.name.localeCompare(b[1].ex.name))) {
  const ss = v.sessions.sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = ss[ss.length - 1];
  const loaded = v.ex.metric === 'weight_reps';
  let stuck = 0;
  for (let i = ss.length - 1; i >= 0 && ss[i].top === last.top; i--) stuck++;
  // Bodyweight rep work progresses by reps and lever, not load — no stall verdict.
  const status = !loaded
    ? `${ss[0].reps.join('/')} → ${last.reps.join('/')} reps`
    : ss.length === 1 ? 'first session' : stuck >= 3 ? `**stuck ${stuck} sessions**` : ss[0].top < last.top ? `+${fmt(last.top - ss[0].top, 2)} kg` : 'holding';
  const where = v.gymId ? ` @ ${gymName(v.gymId)}${v.station ? ` / ${v.station}` : ''}` : '';
  if (loaded && stuck >= 3) flagIt('accessory', `${v.ex.short}${where}: top load ${fmt(last.top, 2)} kg for ${stuck} sessions.`);
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
for (const r of runs) {
  const s = sessions.find((x) => x.id === r.sessionId);
  const wk = s?.programRef?.runWeek;
  const plan = program.runPlan.find((w) => w.week === wk) ?? program.runMaintenance;
  const target = plan?.[r.variant];
  const targetStr = !target ? '—' : target.kind === 'time' ? `${target.minutes} min` : `${target.km} km`;
  const warn = runLoadWarnings(sessions, { km: r.km, date: r.date, sessionId: r.sessionId }, { today: r.date, priorInjury: meta.priorLowerLimbInjury === true });
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
  if (warn.length) flagIt('run-load', `${r.date} ${r.variant} ${fmt(r.km, 2)} km: ${warn.map((w) => w.message).join(' ')}`);
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
  const tue = byDay.find((r) => r.dow === 2);
  const thu = byDay.find((r) => r.dow === 4);
  if (tue?.runs >= 3 && tue.meanRpe >= 5 && (!thu || thu.meanRpe == null || thu.meanRpe < 5)) {
    flagIt('template', `Tuesday easy runs average CR10 ${tue.meanRpe} over ${tue.runs} runs${thu ? ` while Thursday averages ${thu.meanRpe}` : ''}: §4.3 says move the easy run to Thursday and make Tuesday the optional slot.`);
  } else if (tue?.runs >= 3) {
    p(`Tuesday runs (day after legs) average CR10 ${tue.meanRpe ?? '—'} — the template question stays answered "keep".`);
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
if (!flags.length) lines.push('- None. Carry on.');
for (const f of flags) lines.push(`- **${f.kind}** — ${f.text}`);
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
  console.log(`wrote ${path.relative(ROOT, out)} · ${flags.length} rule${flags.length === 1 ? '' : 's'} fired`);
}
