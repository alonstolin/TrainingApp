/** One exercise: full history, chart and personal bests. */

import { el, onTap, append, fmtSets, fmtWeight } from '../dom.js';
import { lineChart } from '../chart.js';
import * as store from '../../data/store.js';
import { getExercise, EXERCISES } from '../../program/exercises.js';
import { stepper } from '../stepper.js';
import { toast } from '../toast.js';
import { e1rmSeries, topSetSeries, personalBests } from '../../core/stats.js';
import { formatDate, formatRelativeDate } from '../../core/dates.js';
import { navigate } from '../../router.js';

export default function mountExercise(root, params) {
  const screen = el('div.screen');
  root.appendChild(screen);
  let gymFilter = null; // gymId, for stack/machine exercises trained in more than one gym

  const render = () => {
    const state = store.getState();
    const ex = getExercise(params.id);

    // A cable stack's 40 is not another gym's 40, so a gym-specific exercise
    // is charted per gym — one series, never two gyms on one line.
    const allRows = state.index.get(ex.id) ?? [];
    const gymIds = ex.gymSpecific ? [...new Set(allRows.map((r) => r.gymId).filter((g) => g != null))] : [];
    if (gymIds.length > 1 && (gymFilter == null || !gymIds.includes(gymFilter))) {
      gymFilter = gymIds.includes(state.meta.lastGymId) ? state.meta.lastGymId : gymIds[0];
    }
    const sessions = gymIds.length > 1 ? state.sessions.filter((x) => x.gymId === gymFilter) : state.sessions;
    const e1 = e1rmSeries(sessions, ex.id);
    const top = topSetSeries(sessions, ex.id);
    const pb = personalBests(sessions, ex.id);
    const history = (gymIds.length > 1 ? allRows.filter((r) => r.gymId === gymFilter) : allRows).slice(0, 25);

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

    // ---- weight increment
    // Gym stacks are not all 2.5kg. This drives the +/- step AND the rounding of
    // every suggested load, so a machine that moves in 6.25kg steps stops being
    // handed targets that do not exist on it.
    if (ex.metric === 'weight_reps' && !ex.retired) {
      const base = EXERCISES[ex.id]?.increment ?? 2.5;
      const custom = store.getState().meta.increments?.[ex.id] ?? null;
      const control = stepper({
        value: custom ?? base,
        step: 0.25,
        min: 0.25,
        max: 50,
        label: 'step',
        unit: ex.unit,
        onChange: (v) => {
          const next = { ...(store.getState().meta.increments ?? {}) };
          if (v == null || v === base) delete next[ex.id];
          else next[ex.id] = v;
          store.setMeta({ increments: next });
          toast(v == null || v === base ? 'Using the default step' : `Steps of ${v}${ex.unit}`);
        },
      });

      append(screen, [
        el(
          'div.card',
          { style: { marginBottom: '1.5rem' } },
          el('div.row-between', null,
            el('div.grow', null,
              el('div.listitem-title', { text: 'Weight increment' }),
              el('div.listitem-sub', {
                text: custom
                  ? `Custom — the default for this lift is ${base}${ex.unit}.`
                  : 'Match this to the smallest jump your gym actually allows.',
              }),
            ),
            el('div', { style: { width: '150px', flex: '0 0 auto' } }, control),
          ),
        ),
      ]);
    }

    if (gymIds.length > 1) {
      const chips = el('div.chips', { style: { marginBottom: '1.25rem' }, dataset: { gymFilter: '' } });
      for (const id of gymIds) {
        const b = el('button.chip', { type: 'button', text: store.gymName(id), 'aria-pressed': String(id === gymFilter) });
        onTap(b, () => {
          gymFilter = id;
          render();
        });
        chips.appendChild(b);
      }
      append(screen, [chips]);
    }

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
            el('span.grow', null, el('div.listitem-title.num', { text: fmtSets(h.sets, { max: 8 }) }), el('div.listitem-sub', { text: formatRelativeDate(h.date) + (h.station ? ` · ${h.station}` : '') })),
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
