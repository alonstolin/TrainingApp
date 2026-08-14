/** History — everything logged, newest first, grouped by week. */

import { el, onTap, append, fmtSets } from '../dom.js';
import * as store from '../../data/store.js';
import { startOfWeek, formatDate, formatRelativeDate, dayName, formatDuration } from '../../core/dates.js';
import { adherence } from '../../core/stats.js';
import { formatPace } from '../../core/progression.js';
import { paceSecPerKm } from '../../core/progression.js';
import { navigate } from '../../router.js';

const summarise = (s) => {
  if (s.status === 'skipped') return 'Skipped';
  if (s.kind === 'run') {
    if (!s.run?.distanceKm) return 'Run';
    const p = paceSecPerKm(s.run.distanceKm, s.run.durationSec);
    return `${s.run.distanceKm}km · ${formatDuration(s.run.durationSec)} · ${formatPace(p)}`;
  }
  const sets = (s.entries ?? []).reduce((n, e) => n + e.sets.filter((x) => x.done).length, 0);
  const first = (s.entries ?? [])[0];
  return `${sets} set${sets === 1 ? '' : 's'}${first ? ` · ${fmtSets(first.sets, { max: 2 })}` : ''}`;
};

export default function mountHistory(root) {
  const screen = el('div.screen');
  root.appendChild(screen);

  const render = () => {
    const { sessions } = store.getState();
    screen.textContent = '';

    append(screen, [
      el('header.page-head', null, el('h1.page-title', { text: 'History' })),
    ]);

    if (sessions.length === 0) {
      append(screen, [
        el(
          'div.empty',
          null,
          el('div.empty-mark', { text: '≡' }),
          el('p', { text: 'Nothing logged yet.' }),
          el('p.small', { text: 'Finish a session and it will show up here.' }),
        ),
      ]);
      return;
    }

    const a = adherence(sessions);
    append(screen, [
      el(
        'div.statgrid',
        { style: { marginBottom: '1.5rem' } },
        el('div.stat', null, el('div.stat-value.num', { text: String(a.lift.completed) }), el('div.stat-label', { text: 'lifts / 28d' })),
        el('div.stat', null, el('div.stat-value.num', { text: String(a.run.completed) }), el('div.stat-label', { text: 'runs / 28d' })),
        el('div.stat', null, el('div.stat-value.num', { text: String(a.core.completed) }), el('div.stat-label', { text: 'core / 28d' })),
        el('div.stat', null, el('div.stat-value.num', { text: String(sessions.filter((s) => s.status === 'completed').length) }), el('div.stat-label', { text: 'all time' })),
      ),
    ]);

    // Newest first, grouped by ISO week.
    const sorted = [...sessions].sort((x, y) =>
      x.date < y.date ? 1 : x.date > y.date ? -1 : (y.startedAt ?? 0) - (x.startedAt ?? 0),
    );

    const groups = new Map();
    for (const s of sorted) {
      const wk = startOfWeek(s.date);
      if (!groups.has(wk)) groups.set(wk, []);
      groups.get(wk).push(s);
    }

    for (const [weekStart, items] of groups) {
      const km = items
        .filter((s) => s.kind === 'run' && s.status === 'completed')
        .reduce((n, s) => n + (s.run?.distanceKm ?? 0), 0);

      screen.appendChild(
        el(
          'div.row-between.section-label',
          null,
          el('span', { text: `Week of ${formatDate(weekStart)}` }),
          el('span.num', { text: km ? `${Math.round(km * 10) / 10}km run` : '' }),
        ),
      );

      const list = el('div.listgroup');
      for (const s of items) {
        list.appendChild(
          onTap(
            el(
              'button.listitem',
              { type: 'button' },
              el(`span.listitem-mark.listitem-mark--${s.status === 'skipped' ? 'skipped' : s.kind}`),
              el(
                'span.grow',
                null,
                el('div.listitem-title', { text: s.prescriptionSnapshot?.name ?? s.kind }),
                el('div.listitem-sub.truncate', { text: summarise(s) }),
              ),
              el(
                'span.xs.dim',
                { style: { textAlign: 'right', flex: '0 0 auto' } },
                el('div', { text: dayName(s.date) }),
                el('div', { text: formatRelativeDate(s.date) === 'Today' ? 'today' : formatDate(s.date) }),
              ),
            ),
            () => navigate(`/session/${s.id}`),
          ),
        );
      }
      screen.appendChild(list);
    }
  };

  render();
  return { unmount: store.subscribe(render) };
}
