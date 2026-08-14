/**
 * Calendar — the plan laid out against real dates.
 *
 * Past days are facts read from the log. Future days are a projection of what
 * lands where IF the weekly template is followed from here, and the UI says so
 * explicitly: the program advances when you train, not when the clock ticks, so
 * missing a session shifts everything after it.
 */

import { el, onTap, append } from '../dom.js';
import { openSheet } from '../sheet.js';
import * as store from '../../data/store.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
import { buildCalendar, weekPattern, monthGrid, projectGoalDate } from '../../core/calendar.js';
import { resolveLiftSession } from '../../core/prescribe.js';
import { trainingDate, parseLocalDate, formatDate, formatRelativeDate, addDays, dayName } from '../../core/dates.js';
import { navigate } from '../../router.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Status → dot modifier. Facts are solid, forecasts are outlined. */
const dotClass = (e) =>
  `cal-dot cal-dot--${e.track}` +
  (e.status === 'completed' ? ' cal-dot--done'
    : e.status === 'skipped' ? ' cal-dot--skipped'
    : e.status === 'missed' ? ' cal-dot--missed'
    : e.optional ? ' cal-dot--optional'
    : ' cal-dot--planned');

function dayDetailSheet(dayEntry) {
  const { date, entries } = dayEntry;

  const rows = entries.map((e) => {
    const card = el(
      'div.card',
      null,
      el(
        'div.row',
        { style: { gap: '0.6rem', alignItems: 'center' } },
        el(`span.listitem-mark.listitem-mark--${e.status === 'skipped' || e.status === 'missed' ? 'skipped' : e.track}`),
        el('div.grow', null,
          el('div.listitem-title', { text: e.name }),
          el('div.listitem-sub', { text: e.detail || '' }),
        ),
        e.status === 'completed' ? el('span.pill.pill--good', { text: 'DONE' })
          : e.status === 'skipped' ? el('span.pill', { text: 'SKIPPED' })
          : e.status === 'missed' ? el('span.pill.pill--warn', { text: 'MISSED' })
          : e.optional ? el('span.pill', { text: 'OPTIONAL' })
          : e.isDeload ? el('span.pill.pill--deload', { text: 'DELOAD' })
          : e.isGoal ? el('span.pill.pill--good', { text: 'GOAL' })
          : e.isDown ? el('span.pill.pill--warn', { text: 'DOWN WEEK' })
          : null,
      ),
    );

    // For a planned lift day, show the actual movements and rep schemes — this
    // is the "what am I walking into" the calendar exists to answer.
    if (e.projected && e.track === 'lift' && e.key?.startsWith('lift:')) {
      const resolved = resolveLiftSession(CURRENT_PROGRAM, e.key, e.weekInMeso ?? 1, () => null);
      card.appendChild(
        el(
          'ul.stack',
          { style: { marginTop: '0.75rem', gap: '0.3rem' } },
          ...resolved.entries.map((x) =>
            el('li.row-between.small', null,
              el('span.truncate.grow', { text: x.name }),
              el('span.dim.num', { text: x.label.replace(/ @ RPE.*/, '') }),
            ),
          ),
        ),
      );
      if (e.weekInMeso) {
        card.appendChild(
          el('p.xs.dim', { style: { marginTop: '0.6rem' }, text: `Block ${e.mesocycle} · week ${e.weekInMeso} of ${CURRENT_PROGRAM.mesocycleWeeks}` }),
        );
      }
    }

    if (e.sessionId) {
      return onTap(
        el('button', { type: 'button', style: { display: 'block', width: '100%', textAlign: 'left' } }, card),
        () => navigate(`/session/${e.sessionId}`),
      );
    }
    return card;
  });

  openSheet({
    title: `${dayName(date)} ${formatDate(date)}`,
    subtitle: entries.length
      ? entries.some((x) => x.projected)
        ? 'Planned — this shifts if you miss sessions before it.'
        : undefined
      : 'Rest day. Nothing scheduled.',
    content: rows.length ? el('div.stack', null, ...rows) : null,
  });
}

export default function mountCalendar(root) {
  const screen = el('div.screen');
  root.appendChild(screen);

  const today = trainingDate();
  const now = parseLocalDate(today);
  let year = now.getFullYear();
  let month = now.getMonth();

  const render = () => {
    const state = store.getState();
    screen.textContent = '';

    const goal = projectGoalDate(state, CURRENT_PROGRAM, today);

    append(screen, [
      el(
        'header.page-head',
        null,
        el('h1.page-title', { text: 'Calendar' }),
        el('div.page-sub', {
          text: goal
            ? `10K projected for ${dayName(goal.date)} ${formatDate(goal.date)} — about ${goal.weeksAway} weeks out.`
            : 'Your week, and what lands on every day of it.',
        }),
      ),
    ]);

    // ---- the fixed weekly rhythm
    const pattern = weekPattern(CURRENT_PROGRAM);
    const strip = el('div.weekstrip');
    for (const d of pattern) {
      strip.appendChild(
        el(
          'div.weekstrip-col',
          { dataset: { rest: String(d.isRest) } },
          el('div.weekstrip-day', { text: d.day }),
          el(
            'div.weekstrip-slots',
            null,
            ...(d.isRest
              ? [el('div.weekstrip-slot.weekstrip-slot--rest', { text: 'Rest' })]
              : d.slots
                  .filter((s) => !s.optional)
                  .map((s) => el(`div.weekstrip-slot.weekstrip-slot--${s.track}`, { text: s.short }))),
          ),
        ),
      );
    }

    append(screen, [
      el('div.section-label', { style: { marginTop: 0 }, text: 'Your week' }),
      strip,
      el('p.xs.dim', {
        style: { marginTop: '0.5rem' },
        text: 'Legs early, long run on Saturday five days clear of them, and the heavy upper days spread across the rest. Thursday is a spare slot, not an obligation.',
      }),
    ]);

    // ---- month navigation
    const grid = monthGrid(year, month);
    const days = buildCalendar(state, CURRENT_PROGRAM, {
      from: grid.first,
      to: grid.last,
      today,
      includeOptional: true,
    });
    const byDate = new Map(days.map((d) => [d.date, d]));

    const nav = el(
      'div.row-between',
      { style: { marginTop: '1.5rem', marginBottom: '0.75rem' } },
      onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '‹' }), () => {
        month--;
        if (month < 0) { month = 11; year--; }
        render();
      }),
      el('div', { style: { fontWeight: '700', fontSize: 'var(--fs-lg)' }, text: `${MONTHS[month]} ${year}` }),
      onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '›' }), () => {
        month++;
        if (month > 11) { month = 0; year++; }
        render();
      }),
    );
    screen.appendChild(nav);

    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();
    if (!isCurrentMonth) {
      screen.appendChild(
        onTap(
          el('button.btn.btn--sm.btn--ghost.btn--block', { type: 'button', text: 'Back to this month', style: { marginBottom: '0.75rem' } }),
          () => { year = now.getFullYear(); month = now.getMonth(); render(); },
        ),
      );
    }

    // ---- the grid
    const head = el('div.cal-grid.cal-grid--head');
    for (const d of DOW) head.appendChild(el('div.cal-dow', { text: d }));
    screen.appendChild(head);

    const body = el('div.cal-grid');
    for (let i = 0; i < grid.lead; i++) body.appendChild(el('div.cal-cell.cal-cell--blank'));

    for (const date of grid.dates) {
      const d = byDate.get(date);
      const num = Number(date.slice(8, 10));
      const cell = el(
        `button.cal-cell${d?.isToday ? '.cal-cell--today' : ''}${d?.isPast ? '.cal-cell--past' : ''}`,
        { type: 'button', 'aria-label': `${formatDate(date)}` },
        el('div.cal-num.num', { text: String(num) }),
        el('div.cal-dots', null, ...(d?.entries ?? []).slice(0, 3).map((e) => el(`span.${dotClass(e).replace(/ /g, '.')}`))),
      );
      onTap(cell, () => dayDetailSheet(d ?? { date, entries: [] }));
      body.appendChild(cell);
    }
    screen.appendChild(body);

    screen.appendChild(
      el(
        'div.cal-legend',
        null,
        el('span.row', { style: { gap: '0.3rem' } }, el('span.cal-dot.cal-dot--lift.cal-dot--planned'), el('span.xs.dim', { text: 'Lift' })),
        el('span.row', { style: { gap: '0.3rem' } }, el('span.cal-dot.cal-dot--run.cal-dot--planned'), el('span.xs.dim', { text: 'Run' })),
        el('span.row', { style: { gap: '0.3rem' } }, el('span.cal-dot.cal-dot--core.cal-dot--planned'), el('span.xs.dim', { text: 'Core' })),
        el('span.row', { style: { gap: '0.3rem' } }, el('span.cal-dot.cal-dot--lift.cal-dot--done'), el('span.xs.dim', { text: 'Done' })),
        el('span.row', { style: { gap: '0.3rem' } }, el('span.cal-dot.cal-dot--lift.cal-dot--missed'), el('span.xs.dim', { text: 'Missed' })),
      ),
    );

    // ---- the next week, spelled out
    const upcoming = buildCalendar(state, CURRENT_PROGRAM, {
      from: today,
      to: addDays(today, 7),
      today,
      includeOptional: true,
    });

    const list = el('div.listgroup');
    for (const d of upcoming) {
      const workEntries = d.entries.filter((e) => e.status !== 'missed');
      const required = workEntries.filter((e) => !e.optional);
      const title = required.length
        ? required.map((e) => e.name).join(' + ')
        : workEntries.length
          ? 'Rest — bonus day available'
          : 'Rest';

      list.appendChild(
        onTap(
          el(
            'button.listitem',
            { type: 'button' },
            el('span.xs.dim', { style: { width: '38px', flex: '0 0 auto' } },
              el('div', { text: dayName(d.date) }),
              el('div.num', { text: d.date.slice(8, 10) }),
            ),
            el('span.grow', null,
              el('div.listitem-title', { text: title }),
              el('div.listitem-sub.truncate', {
                text: (required.length ? required : workEntries)
                  .map((e) => e.detail).filter(Boolean).join(' · ') || '—',
              }),
            ),
            d.isToday ? el('span.pill.pill--t1', { text: 'TODAY' }) : null,
          ),
          () => dayDetailSheet(d),
        ),
      );
    }

    append(screen, [el('div.section-label', { text: 'Next 7 days' }), list]);

    append(screen, [
      el('p.xs.dim', {
        style: { marginTop: '1rem' },
        text: 'Future days are a projection, not a commitment. Your place in the program advances when you train, not when the date changes — so missing a session shifts everything after it rather than losing it.',
      }),
    ]);

    void formatRelativeDate;
  };

  render();
  return { unmount: store.subscribe(render) };
}
