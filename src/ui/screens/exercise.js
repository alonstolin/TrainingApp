/** One exercise: full history, chart and personal bests. */

import { el, onTap, append, fmtSets, fmtWeight } from '../dom.js';
import { lineChart } from '../chart.js';
import * as store from '../../data/store.js';
import { getExercise } from '../../program/exercises.js';
import { e1rmSeries, topSetSeries, personalBests } from '../../core/stats.js';
import { formatDate, formatRelativeDate } from '../../core/dates.js';
import { navigate } from '../../router.js';

export default function mountExercise(root, params) {
  const screen = el('div.screen');
  root.appendChild(screen);

  const render = () => {
    const { sessions } = store.getState();
    const ex = getExercise(params.id);
    const e1 = e1rmSeries(sessions, ex.id);
    const top = topSetSeries(sessions, ex.id);
    const pb = personalBests(sessions, ex.id);
    const history = store.historyFor(ex.id, 25);

    screen.textContent = '';

    append(screen, [
      el(
        'header.page-head',
        null,
        onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '‹ Progress' }), () => navigate('/progress')),
        el('h1.page-title', { text: ex.name, style: { marginTop: '0.75rem' } }),
        el('div.page-sub', { text: [ex.cue, ex.retired ? 'No longer in the program' : null].filter(Boolean).join(' · ') }),
      ),
    ]);

    if (!history.length) {
      append(screen, [el('div.empty', null, el('div.empty-mark', { text: '·' }), el('p', { text: 'Never logged.' }))]);
      return;
    }

    append(screen, [
      el(
        'div.statgrid',
        { style: { marginBottom: '1.5rem' } },
        pb.heaviest ? el('div.stat', null, el('div.stat-value.num', { text: fmtWeight(pb.heaviest.weightKg) }), el('div.stat-label', { text: 'heaviest kg' })) : null,
        pb.bestE1rm ? el('div.stat', null, el('div.stat-value.num', { text: String(Math.round(pb.bestE1rm.value)) }), el('div.stat-label', { text: 'best e1RM' })) : null,
        pb.bestReps ? el('div.stat', null, el('div.stat-value.num', { text: String(pb.bestReps.reps ?? pb.bestReps.seconds ?? '—') }), el('div.stat-label', { text: pb.bestReps.seconds ? 'best hold' : 'most reps' })) : null,
        el('div.stat', null, el('div.stat-value.num', { text: String(history.length) }), el('div.stat-label', { text: 'sessions' })),
      ),
    ]);

    if (e1.length > 1) {
      append(screen, [
        el(
          'div.chart-card',
          { style: { marginBottom: '1rem' } },
          el('div.chart-title', { text: 'Estimated 1RM' }),
          lineChart({
            points: e1.map((p) => ({ ...p, detail: `${fmtWeight(p.weightKg)}×${p.reps}${p.rpe ? ` @${p.rpe}` : ''}` })),
            color: 'var(--accent)',
            unit: 'kg',
          }),
        ),
      ]);
    }

    if (top.length > 1) {
      append(screen, [
        el(
          'div.chart-card',
          null,
          el('div.chart-title', { text: 'Top set weight' }),
          lineChart({
            points: top.map((p) => ({ ...p, detail: `${p.reps} reps` })),
            color: 'var(--pullup)',
            unit: 'kg',
          }),
        ),
      ]);
    }

    const list = el('div.listgroup');
    for (const h of history) {
      list.appendChild(
        onTap(
          el(
            'button.listitem',
            { type: 'button' },
            el('span.grow', null, el('div.listitem-title.num', { text: fmtSets(h.sets, { max: 8 }) }), el('div.listitem-sub', { text: formatRelativeDate(h.date) })),
            el('span.xs.dim', { text: formatDate(h.date) }),
          ),
          () => navigate(`/session/${h.sessionId}`),
        ),
      );
    }
    append(screen, [el('div.section-label', { text: 'Every session' }), list]);
  };

  render();
  return { unmount: store.subscribe(render) };
}
