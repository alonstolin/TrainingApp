/** Progress — lifts, running and core. */

import { el, onTap, append, fmtKg, fmtWeight } from '../dom.js';
import { lineChart, barChart, smallMultiples } from '../chart.js';
import * as store from '../../data/store.js';
import { MAIN_LIFTS, getExercise, MUSCLE_LABELS } from '../../program/exercises.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
import {
  e1rmSeries, topSetSeries, runSeries, weeklyRunVolume, coreSeries, estimated1rmSeries,
  runMilestones, coreAdherence, easyRunEffortByWeekday,
} from '../../core/stats.js';
import { corePhaseFor } from '../../core/prescribe.js';
import { formatPace } from '../../core/progression.js';
import { formatDate, formatRelativeDate, trainingDate } from '../../core/dates.js';
import { attendanceLedger, blockShortfall } from '../../core/attendance.js';
import { projectGoalDate } from '../../core/calendar.js';
import { longestRecentRunKm } from '../../core/schedule.js';
import { navigate } from '../../router.js';

const LIFT_COLOR = {
  'incline-bench': 'var(--incline)',
  ohp: 'var(--ohp)',
  'weighted-pullup': 'var(--pullup)',
};

function trendDelta(points) {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (!first) return null;
  const pct = ((last - first) / first) * 100;
  return { abs: last - first, pct };
}

/** How far back the 10K card looks for the longest run: 28 days, today included. */
const TEN_K_WINDOW_DAYS = 28;

/**
 * A goal lift's headline: the estimated 1RM, one point per block (its best
 * probe), the all-time best ringed. The pull-up reads as belt load at today's
 * bodyweight, with bodyweight + belt underneath, so a bodyweight change cannot
 * pass for a strength change; with no bodyweight anywhere it reads on system
 * mass and says so.
 */
function liftHeadline(state, id) {
  const ex = getExercise(id);
  const series = estimated1rmSeries(state.sessions, id, { bodyweightKg: state.meta.bodyweightKg ?? null });
  const card = el('div.chart-card', { dataset: { goal: id } }, el('div.eyebrow', { text: ex.name }));
  if (!series.blockBests.length) {
    card.appendChild(el('p.small.dim', { style: { marginTop: '0.4rem' }, text: 'No probes yet — the first heavy day\'s probe starts this line.' }));
    return card;
  }
  const latest = series.blockBests.at(-1);
  const { best } = series;
  // The belt reading exists only for a belt-loaded lift with a bodyweight to subtract.
  const onBelt = ex.loadModel === 'bodyweight_plus' && latest.value != null;
  const reading = (p) => (onBelt ? `+${fmtKg(p.value)}` : fmtKg(p.systemKg));
  append(card, [
    el(
      'div.row-between',
      { style: { alignItems: 'baseline', margin: '0.3rem 0 0.2rem' } },
      el('div.hero-title.num', { text: reading(latest) }),
      el('span.small.dim', { text: latest.systemKg >= best.systemKg ? 'best yet' : `best ${reading(best)}` }),
    ),
    el('p.xs.dim', {
      text:
        ex.loadModel !== 'bodyweight_plus'
          ? 'Estimated 1RM · this block\'s best probe'
          : onBelt
            ? `Belt load at today's bodyweight · ${fmtKg(latest.systemKg)} bodyweight + belt`
            : 'Bodyweight + belt — set your bodyweight to read it as belt load',
    }),
    lineChart({
      points: series.blockBests.map((p) => ({ ...p, value: onBelt ? p.value : p.systemKg, detail: p.block != null ? `block ${p.block}` : '' })),
      color: LIFT_COLOR[id],
      unit: 'kg',
      height: 110,
      highlight: series.blockBests.indexOf(best),
      caption: 'One point per block, its best probe; the ring is the best ever.',
    }),
  ]);
  return card;
}

/**
 * The 10K headline: the longest run in the last 28 days against the goal
 * distance, and the date the goal-date projection lands it. Done means the
 * plan's goal week is banked, not merely that some run reached 10 km.
 */
function tenKHeadline(state) {
  const goalKm = CURRENT_PROGRAM.runPlan.find((w) => w.goal)?.long.km ?? CURRENT_PROGRAM.runPlan.at(-1).long.km;
  // longestRecentRunKm counts `days` back from today inclusive, so 27 is a 28-day window.
  const longest = longestRecentRunKm(state.sessions, trainingDate(), TEN_K_WINDOW_DAYS - 1);
  const projection = projectGoalDate(state, CURRENT_PROGRAM);
  const banked = store.cursors().run.longCompleted >= CURRENT_PROGRAM.runPlan.length;
  return el(
    'div.chart-card',
    { dataset: { goal: '10k' } },
    el('div.eyebrow', { text: '10K' }),
    el(
      'div.row-between',
      { style: { alignItems: 'baseline', margin: '0.3rem 0 0.5rem' } },
      el('div.hero-title.num', { text: `${fmtWeight(longest)} km` }),
      el('span.small.dim', { text: `of ${goalKm} km · longest in ${TEN_K_WINDOW_DAYS} days` }),
    ),
    el('div.weekbar-track', null, el('span.weekbar-done', { style: { width: `${Math.min(100, (longest / goalKm) * 100)}%` } })),
    el('p.small.muted', {
      style: { marginTop: '0.6rem' },
      text: banked
        ? 'The goal week is banked — the plan now holds at maintenance.'
        : projection
          ? `Projected: ${formatRelativeDate(projection.date)} · ${projection.weeksAway} week${projection.weeksAway === 1 ? '' : 's'} away if the plan holds`
          : 'No projected date yet.',
    }),
  );
}

function headlines(state) {
  return el(
    'section.stack',
    { dataset: { headlines: '' } },
    ...MAIN_LIFTS.map((id) => liftHeadline(state, id)),
    tenKHeadline(state),
    el('p.xs.dim', { text: 'A probe logged without RPE counts as taken to failure, so its estimate reads low.' }),
  );
}

const READING = {
  attendance: 'in weeks with skips or misses',
  volume: 'with full attendance',
  mixed: 'attendance first, then volume',
};

/**
 * Attendance: whether the athlete showed up, then what it cost — the same
 * ledger the review report reads, split into the current and previous block.
 * Missed days (still owed, cost no muscle) and skipped sessions (that day's
 * sets are gone) are marked apart so the cause reads before the cost.
 */
function attendanceSection(state) {
  const today = trainingDate();
  // Since v3, exactly as the review report counts it (store.init always writes the marker).
  const ledgerFrom = state.meta.v3StartedAt?.date ?? today;
  const ledger = attendanceLedger(state.sessions, { from: ledgerFrom, to: today, meta: state.meta });
  const { current, previous } = blockShortfall(ledger);
  const weeks = [...(previous?.weeks ?? []), ...current.weeks];

  // ---- 1. sessions per week, one mark per template day
  const sessionRows = weeks.map((w) => {
    const marks = [
      ...Array(w.sessions.done).fill('done'),
      ...Array(w.skipped.length).fill('skipped'),
      ...Array(w.missed).fill('missed'),
      ...Array(w.open).fill('open'),
    ];
    return el(
      'div.attend-week',
      null,
      el('span.small', { text: `Week of ${formatDate(w.weekStart)}` }),
      el('span.attend-marks', null, ...marks.map((m) => el('span.attend-mark', { dataset: { mark: m }, title: m }))),
      el('span.num.dim.small', { text: `${w.sessions.done} of ${w.sessions.template}` }),
      w.role === 'deload'
        ? el('span.pill.pill--deload', { text: 'DELOAD' })
        : // A partial week's open marks are days outside the ledger, not days owed.
          el('span.xs.dim', { text: !w.partial ? '' : w.weekStart < ledgerFrom ? `v3 began ${formatDate(ledgerFrom)}` : 'in progress' }),
    );
  });

  // ---- 2. the skip ledger, newest first
  const skips = weeks.flatMap((w) => w.skipped).reverse();

  // ---- 3. shortfall by muscle, this block beside the last
  const byMuscle = new Map();
  for (const [col, block] of [['current', current], ['previous', previous]]) {
    for (const m of block?.shortfall ?? []) {
      const row = byMuscle.get(m.muscle) ?? { label: m.label, current: null, previous: null };
      row[col] = m;
      byMuscle.set(m.muscle, row);
    }
  }
  const cell = (m) => el('span.num.small', { text: m ? String(m.shortfall) : '0', class: m ? '' : 'dim' });

  return el(
    'section.stack-lg',
    { dataset: { attendance: '' } },
    el('div.section-label', { text: 'Attendance' }),
    el(
      'div.chart-card',
      { dataset: { part: 'sessions' } },
      el('div.chart-title', { text: 'Lift sessions per week' }),
      el('p.xs.dim', {
        style: { margin: '0.25rem 0 0.75rem' },
        text: 'Against the template week. Filled: done. Struck: skipped — that day\'s sets are gone. Hollow: missed — still owed, so no muscle has lost it yet. Dashed: not yet, or before v3.',
      }),
      el('div.stack', { style: { gap: '0.4rem' } }, ...sessionRows),
    ),
    el(
      'div.chart-card',
      { dataset: { part: 'skips' } },
      el('div.chart-title', { text: 'Skipped sessions' }),
      skips.length
        ? el(
            'div.stack',
            { style: { gap: '0.3rem', marginTop: '0.5rem' } },
            ...skips.map((sk) =>
              el('div.row-between.small', null, el('span', { text: sk.name }), el('span.dim', { text: formatRelativeDate(sk.date) })),
            ),
          )
        : el('p.small.dim', { style: { marginTop: '0.4rem' }, text: 'No skipped sessions this block or last.' }),
    ),
    el(
      'div.chart-card',
      { dataset: { part: 'shortfall' } },
      el('div.chart-title', { text: 'Shortfall by muscle' }),
      el('p.xs.dim', {
        style: { margin: '0.25rem 0 0.75rem' },
        text: 'Direct sets the template week asked for and nobody did. Short with full attendance is the only case that argues for more volume.',
      }),
      byMuscle.size
        ? el(
            'div.stack',
            { style: { gap: '0.4rem' } },
            el('div.attend-short.xs.dim', null, el('span', { text: 'Muscle' }), el('span', { text: 'This block' }), el('span', { text: 'Last block' })),
            ...[...byMuscle.values()].map((r) =>
              el(
                'div.attend-short',
                null,
                el('span.truncate.small', null, r.label, r.current ? el('span.xs.dim', { text: ` · ${READING[r.current.reading]}` }) : null),
                cell(r.current),
                previous ? cell(r.previous) : el('span.dim.small', { text: '—' }),
              ),
            ),
          )
        : el('p.small.dim', { text: 'No muscle short this block or last.' }),
      previous ? null : el('p.xs.dim', { style: { marginTop: '0.5rem' }, text: 'First block — nothing to compare against yet.' }),
    ),
  );
}

function liftsTab(sessions) {
  const wrap = el('div.stack-lg');
  // 'e1rm'   — RPE-adjusted max estimate. Fairest comparison, but noisier: a
  //            heavier set logged at a higher RPE can read as a lower estimate.
  // 'top'    — the actual heaviest weight moved. This is the number the goal is
  //            stated in ("bump up my lifting weights"), so it gets equal billing.
  // 'indexed'— e1RM as % of each lift's own start, for comparing RATES.
  let mode = 'top';

  const chartHost = el('div');
  const title = el('div.chart-title');

  const paint = () => {
    chartHost.textContent = '';
    title.textContent =
      mode === 'top' ? 'Top set weight' : mode === 'e1rm' ? 'Estimated 1RM' : 'Progress vs start';

    const series = MAIN_LIFTS.map((id) => {
      const ex = getExercise(id);
      // heavyOnly: chart the heavy exposure only. Including the volume day would
      // zigzag between two unrelated loads and read as violent week-to-week swings.
      const pts =
        mode === 'top'
          ? topSetSeries(sessions, id, { heavyOnly: true })
          : e1rmSeries(sessions, id, { heavyOnly: true });
      const base = pts[0]?.value ?? 0;
      const d = trendDelta(pts);
      return {
        id,
        name: ex.name,
        color: LIFT_COLOR[id],
        unit: mode === 'indexed' ? '%' : 'kg',
        points:
          mode === 'indexed' && base
            ? pts.map((p) => ({ ...p, value: Math.round((p.value / base) * 1000) / 10 }))
            : pts,
        summary: d
          ? `${d.abs > 0 ? '+' : ''}${Math.round(d.abs * 10) / 10}kg · ${d.pct > 0 ? '+' : ''}${d.pct.toFixed(1)}%`
          : '',
      };
    });

    if (!series.some((s) => s.points.length)) {
      chartHost.appendChild(
        el('div.empty', null, el('div.empty-mark', { text: '◔' }), el('p', { text: 'Log a few sessions and your lifts will chart here.' })),
      );
      return;
    }

    chartHost.appendChild(smallMultiples(series));
    chartHost.appendChild(
      el('p.xs.dim', {
        style: { marginTop: '0.75rem' },
        text:
          mode === 'indexed'
            ? 'Indexed to each lift’s own starting estimate — the right way to compare rates of progress. Heavy days only.'
            : mode === 'top'
              ? 'Heaviest top set on the heavy day. Volume days are excluded on purpose — mixing them in would zigzag between two unrelated loads. Each lift keeps its own scale, so the pull-up is not flattened against the bench.'
              : 'RPE-adjusted max estimate, heavy days only. Expect wobble — a heavier set logged at a higher RPE can read lower.',
      }),
    );
  };

  const toggle = el('div.chips');
  for (const [key, label] of [['top', 'Top set'], ['e1rm', 'Est. 1RM'], ['indexed', '% of start']]) {
    const b = el('button.chip', { type: 'button', text: label, 'aria-pressed': String(mode === key) });
    onTap(b, () => {
      mode = key;
      for (const c of toggle.children) c.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
      paint();
    });
    toggle.appendChild(b);
  }

  paint();
  append(wrap, [
    el(
      'div.chart-card',
      null,
      el('div.stack', { style: { marginBottom: '0.75rem', gap: '0.6rem' } }, title, toggle),
      chartHost,
    ),
  ]);

  // ---- per exercise
  const trained = [...new Set(sessions.flatMap((s) => (s.entries ?? []).map((e) => e.exerciseId)))]
    .filter((id) => getExercise(id).modality === 'lift')
    .sort((a, b) => getExercise(a).name.localeCompare(getExercise(b).name));

  if (trained.length) {
    const list = el('div.listgroup');
    for (const id of trained) {
      const ex = getExercise(id);
      const pts = e1rmSeries(sessions, id);
      list.appendChild(
        onTap(
          el(
            'button.listitem',
            { type: 'button' },
            el('span.grow', null, el('div.listitem-title', { text: ex.name }), el('div.listitem-sub', { text: `${pts.length} session${pts.length === 1 ? '' : 's'}` })),
            el('span.num.dim.small', { text: pts.length ? `${Math.round(pts[pts.length - 1].value)}kg` : '' }),
          ),
          () => navigate(`/exercise/${id}`),
        ),
      );
    }
    append(wrap, [el('div.section-label', { text: 'Every exercise' }), list]);
  }

  return wrap;
}

function runningTab(sessions) {
  const wrap = el('div.stack-lg');
  const runs = runSeries(sessions);
  const m = runMilestones(sessions);
  const cursors = store.cursors();
  const runWeek = Math.min(cursors.run.week, CURRENT_PROGRAM.runPlan.length);
  const goal = CURRENT_PROGRAM.runPlan[CURRENT_PROGRAM.runPlan.length - 1].long.km;

  append(wrap, [
    el(
      'div.statgrid',
      null,
      el('div.stat', null, el('div.stat-value.num', { text: m.longest ? String(m.longest.km) : '—' }), el('div.stat-label', { text: 'longest km' })),
      el('div.stat', null, el('div.stat-value.num', { text: String(m.totalKm) }), el('div.stat-label', { text: 'total km' })),
      el('div.stat', null, el('div.stat-value.num', { text: String(m.runCount) }), el('div.stat-label', { text: 'runs' })),
      el('div.stat', null, el('div.stat-value.num', { text: `${runWeek}/${CURRENT_PROGRAM.runPlan.length}` }), el('div.stat-label', { text: 'plan week' })),
    ),
  ]);

  if (m.hitTenK) {
    append(wrap, [el('div.banner.banner--good', null, el('span.small', { text: `10K done — longest run ${m.longest.km}km. The plan now holds at maintenance rather than pushing further.` }))]);
  } else if (m.longest) {
    const pct = Math.round((m.longest.km / goal) * 100);
    append(wrap, [el('div.banner.banner--info', null, el('span.small', { text: `${pct}% of the way to a 10K. Longest so far: ${m.longest.km}km.` }))]);
  }

  if (runs.length === 0) {
    append(wrap, [el('div.empty', null, el('div.empty-mark', { text: '◔' }), el('p', { text: 'No runs logged yet.' }))]);
    return wrap;
  }

  // Never a dual y-axis, and never two different KINDS of run on one line.
  // Easy runs are short and quick, long runs are long and slow; combined, the
  // series just alternates between them and the trend inside each is invisible.
  // Splitting them is the same fix already applied to heavy vs volume lifts.
  const weekly = weeklyRunVolume(sessions);
  append(wrap, [
    el(
      'div.chart-card',
      null,
      el('div.chart-title', { text: 'Weekly distance' }),
      barChart({
        bars: weekly.map((w) => ({ label: `Week of ${formatDate(w.weekStart)}`, value: w.km })),
        color: 'var(--pullup)',
        unit: 'km',
        formatValue: (v) => String(Math.round(v * 10) / 10),
      }),
      el('p.xs.dim', { style: { marginTop: '0.5rem' }, text: 'Everything you ran, easy and long together. Total load is the one place adding them up is the right thing to do.' }),
    ),
  ]);

  const paceCard = el('div.chart-card', null, el('div.chart-title', { text: 'Pace' }));
  for (const [variant, label, color] of [
    ['easy', 'Easy runs', 'var(--incline)'],
    ['long', 'Long runs', 'var(--ohp)'],
  ]) {
    const pts = runSeries(sessions, { variant }).filter((r) => r.pace);
    paceCard.appendChild(
      el('div.chart-series-label', null,
        el('span.chart-dot', { style: { background: color } }),
        el('span', { text: label }),
        el('span.dim.xs', { text: pts.length ? `${pts.length} run${pts.length === 1 ? '' : 's'}` : '' }),
      ),
    );
    paceCard.appendChild(
      pts.length > 1
        ? lineChart({
            points: pts.map((r) => ({ date: r.date, value: r.pace, detail: `${r.km}km` })),
            color,
            unit: '',
            formatValue: (v) => formatPace(v).replace(' /km', ''),
          })
        : el('p.xs.dim', {
            style: { margin: '0 0 0.75rem' },
            text: pts.length === 1 ? 'One logged — a trend needs at least two.' : 'None logged yet.',
          }),
    );
  }
  paceCard.appendChild(
    el('p.xs.dim', { style: { marginTop: '0.5rem' }, text: 'Lower is faster. Each kind of run is tracked on its own, so a slow long run no longer drags the easy-run trend down with it.' }),
  );
  append(wrap, [paceCard]);

  // The long run IS the ramp toward 10K; easy-run distance is deliberately flat,
  // so plotting it here would add noise and no signal. Weekly bars above already
  // account for the total.
  const longs = runSeries(sessions, { variant: 'long' });
  if (longs.length > 1) {
    append(wrap, [
      el(
        'div.chart-card',
        null,
        el('div.chart-title', { text: 'Long run distance' }),
        lineChart({
          points: longs.map((r) => ({ date: r.date, value: r.km, detail: formatPace(r.pace) })),
          color: 'var(--pullup)',
          unit: 'km',
          zeroBase: true,
        }),
        el('p.xs.dim', { style: { marginTop: '0.5rem' }, text: `The ramp that gets you to ${goal}km. Down weeks are meant to dip.` }),
      ),
    ]);
  }

  // Easy-run effort by weekday: the evidence that decides whether the Tuesday
  // run (the day after legs) stays on Tuesday (SYNTHESIS §4.3).
  const byDay = easyRunEffortByWeekday(sessions).filter((r) => r.meanRpe != null || r.talkNegativePct != null);
  if (byDay.length) {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    append(wrap, [
      el(
        'div.chart-card',
        null,
        el('div.chart-title', { text: 'Easy-run effort by weekday' }),
        el('p.xs.dim', { style: { margin: '0.25rem 0 0.75rem' }, text: 'CR10 (aim 3–4) and how often the talk test failed. If Tuesday runs sit at 5+ for a block while Thursday runs do not, the easy run moves to Thursday.' }),
        ...byDay.map((r) =>
          el(
            'div.row-between.small',
            { style: { padding: '0.3rem 0' } },
            el('span', { text: `${names[r.dow]} · ${r.runs} run${r.runs === 1 ? '' : 's'}` }),
            el('span.num.dim', {
              text: `${r.meanRpe != null ? `CR10 ${r.meanRpe}` : '—'}${r.talkNegativePct != null ? ` · talk ✗ ${r.talkNegativePct}%` : ''}`,
              style: r.meanRpe >= 5 ? { color: 'var(--warn)' } : {},
            }),
          ),
        ),
      ),
    ]);
  }

  return wrap;
}

function coreTab(sessions) {
  const wrap = el('div.stack-lg');
  const cursors = store.cursors();
  const phase = corePhaseFor(CURRENT_PROGRAM, cursors.core.completed);
  const phases = CURRENT_PROGRAM.core?.phases ?? CURRENT_PROGRAM.corePhases ?? [];
  const adherence = coreAdherence(sessions, CURRENT_PROGRAM, { since: store.getState().meta.v3StartedAt?.date ?? null });

  append(wrap, [
    el(
      'div.card',
      null,
      el('div.eyebrow', { text: `Phase ${phase.phase} of ${phases.length}` }),
      el('div.hero-title', { text: phase.name }),
      el('p.small.muted', { style: { marginTop: '0.4rem' }, text: phase.note }),
      el('p.small.dim', { style: { marginTop: '0.5rem' }, text: `${cursors.core.completed} core sessions logged.` }),
    ),
  ]);

  // Adherence is the test of the placement, not of the athlete: the mat
  // programme failed because it was skipped, and the loaded one lives at the
  // end of Lower and Push for exactly that reason (SYNTHESIS §5.4).
  if (adherence && adherence.hosts > 0) {
    append(wrap, [
      el(
        'div.card',
        { dataset: { coreAdherence: adherence.ok ? 'ok' : 'low' } },
        el('div.row-between', null,
          el('div.listitem-title', { text: 'Core done at the end of Lower / Push' }),
          el(`span.pill.${adherence.ok ? 'pill--good' : 'pill--warn'}`, { text: `${adherence.pct}%` }),
        ),
        el('p.small.muted', {
          style: { marginTop: '0.4rem' },
          text: `${adherence.done} of ${adherence.hosts} sessions${adherence.standalone ? ` · ${adherence.standalone} standalone` : ''}. ${
            adherence.ok ? 'Above the 75% line — the placement is working.' : 'Under 75% — the placement is wrong again, not you. Worth changing where core lives.'
          }`,
        }),
      ),
    ]);
  }

  const tracked = [
    ...new Set(
      sessions
        .filter((s) => s.status === 'completed')
        .flatMap((s) => (s.entries ?? []).filter((e) => s.kind === 'core' || e.group === 'core').map((e) => e.exerciseId)),
    ),
  ];
  if (!tracked.length) {
    append(wrap, [el('div.empty', null, el('div.empty-mark', { text: '◔' }), el('p', { text: 'No core sessions logged yet.' }))]);
    return wrap;
  }

  for (const id of tracked) {
    const ex = getExercise(id);
    const pts = coreSeries(sessions, id);
    if (!pts.length) continue;
    const unit = pts[0].unit;
    append(wrap, [
      el(
        'div.chart-card',
        null,
        el('div.row-between', { style: { marginBottom: '0.5rem' } }, el('div.chart-title', { text: ex.name }), el('span.num.dim.small', { text: `best ${Math.max(...pts.map((p) => p.value))}${unit}` })),
        lineChart({ points: pts, color: 'var(--ohp)', unit, zeroBase: true, formatValue: (v) => String(Math.round(v)) }),
      ),
    ]);
  }

  return wrap;
}

export default function mountProgress(root) {
  const screen = el('div.screen');
  root.appendChild(screen);
  let tab = 'lifts';

  const render = () => {
    const { sessions } = store.getState();
    screen.textContent = '';

    const tabs = el('div.chips', { style: { marginBottom: '1.25rem' } });
    for (const [key, label] of [['lifts', 'Lifts'], ['running', 'Running'], ['core', 'Core']]) {
      const b = el('button.chip', { type: 'button', text: label, 'aria-pressed': String(tab === key) });
      onTap(b, () => {
        tab = key;
        render();
      });
      tabs.appendChild(b);
    }

    const state = store.getState();
    append(screen, [
      el('header.page-head', null, el('h1.page-title', { text: 'Progress' })),
      el('div', { style: { marginBottom: '1.5rem' } }, headlines(state)),
      el('div', { style: { marginBottom: '1.5rem' } }, attendanceSection(state)),
      el(
        'section',
        { dataset: { details: '' } },
        el('div.section-label', { text: 'Details', style: { marginBottom: '0.75rem' } }),
        tabs,
        tab === 'lifts' ? liftsTab(sessions) : tab === 'running' ? runningTab(sessions) : coreTab(sessions),
      ),
    ]);
    void MUSCLE_LABELS;
  };

  render();
  return { unmount: store.subscribe(render) };
}
