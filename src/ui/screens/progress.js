/** Progress — lifts, running and core. */

import { el, onTap, append } from '../dom.js';
import { lineChart, barChart, smallMultiples } from '../chart.js';
import * as store from '../../data/store.js';
import { MAIN_LIFTS, getExercise, MUSCLE_LABELS } from '../../program/exercises.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
import {
  e1rmSeries, topSetSeries, runSeries, weeklyRunVolume, coreSeries,
  weeklyVolumeByMuscle, runMilestones, coreAdherence, easyRunEffortByWeekday,
} from '../../core/stats.js';
import { corePhaseFor } from '../../core/prescribe.js';
import { formatPace } from '../../core/progression.js';
import { startOfWeek, trainingDate, formatDate } from '../../core/dates.js';
import { navigate } from '../../router.js';

const LIFT_COLOR = {
  'incline-bench': 'var(--incline)',
  ohp: 'var(--ohp)',
  'weighted-pullup': 'var(--pullup)',
};

// v3 weekly DIRECT-set targets per muscle (SYNTHESIS §2.1): flat, not ramped.
// The old RP MEV/MAV landmarks were unmeasured expert opinion and are gone.
// `min` is the low edge of the band; `max` fills the bar. Legs are maintenance.
const LANDMARKS = {
  'side-delts': { min: 8, max: 10 },
  'rear-delts': { min: 6, max: 8 },
  triceps: { min: 8, max: 10 },
  biceps: { min: 8, max: 10 },
  chest: { min: 3, max: 7 },
  'front-delts': { min: 3, max: 7 },
  back: { min: 7, max: 13 },
  quads: { min: 3, max: 6 },
  hamstrings: { min: 3, max: 4 },
  calves: { min: 2, max: 4 },
  core: { min: 6, max: 12 },
};

function trendDelta(points) {
  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (!first) return null;
  const pct = ((last - first) / first) * 100;
  return { abs: last - first, pct };
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

  // ---- weekly volume vs landmarks
  const thisWeek = startOfWeek(trainingDate());
  const vol = weeklyVolumeByMuscle(sessions, thisWeek);
  if (vol.length) {
    const rows = vol.map((v) => {
      const lm = LANDMARKS[v.muscle];
      const pct = lm ? Math.min(100, (v.sets / lm.max) * 100) : Math.min(100, v.sets * 5);
      const under = lm && v.sets < lm.min;
      return el(
        'div.volbar',
        null,
        el('span.truncate', { text: v.label }),
        el('div.volbar-track', null, el('div.volbar-fill', { style: { width: `${pct}%`, background: under ? 'var(--warn)' : 'var(--accent)' } })),
        el('span.num.dim', { text: String(v.sets) }),
      );
    });
    append(wrap, [
      el(
        'div.chart-card',
        null,
        el('div.chart-title', { text: 'Hard sets this week' }),
        el('p.xs.dim', { style: { margin: '0.25rem 0 0.75rem' }, text: 'Direct sets, filled against the top of this program’s weekly target. Amber means under the band — the priority muscles sit at 8–10 direct sets, held flat all block.' }),
        el('div.stack', { style: { gap: '0.5rem' } }, ...rows),
      ),
    ]);
  }

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

    append(screen, [el('header.page-head', null, el('h1.page-title', { text: 'Progress' })), tabs]);
    screen.appendChild(tab === 'lifts' ? liftsTab(sessions) : tab === 'running' ? runningTab(sessions) : coreTab(sessions));
    void MUSCLE_LABELS;
  };

  render();
  return { unmount: store.subscribe(render) };
}
