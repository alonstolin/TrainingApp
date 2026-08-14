/**
 * The session logger — lift, run and core.
 *
 * Design constraint driving everything here: one-handed, mid-set, in a gym,
 * possibly sweaty. So:
 *   - the keyboard never opens by default (steppers and chips, see stepper.js)
 *   - every set is prefilled from last time / the progression suggestion, so
 *     matching last week costs exactly one tap
 *   - the primary action is a full-width button in the bottom third
 *   - logging a set auto-advances and starts the rest timer
 *   - every set persists the instant it is logged; there is no "save" button and
 *     no state cliff to fall off if iOS kills the app between sets
 */

import { el, onTap, append, clear, fmtWeight, fmtSets, scrollTop } from '../dom.js';
import { stepper, rpeRow, repRow } from '../stepper.js';
import { startRest, stopRest, renderRest, holdTimer, keepAwake, unlockAudio } from '../timer.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { toast, undoToast } from '../toast.js';
import * as store from '../../data/store.js';
import { getExercise } from '../../program/exercises.js';
import { formatRelativeDate, formatDuration } from '../../core/dates.js';
import { paceSecPerKm, formatPace, effectiveLoad, e1rm } from '../../core/progression.js';
import { navigate } from '../../router.js';

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

function header(session, onFinish) {
  const snap = session.prescriptionSnapshot ?? {};
  return el(
    'header.page-head',
    null,
    el(
      'div.row-between',
      null,
      onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '‹ Today' }), () => navigate('/')),
      session.status === 'in_progress'
        ? onTap(el('button.btn.btn--sm', { type: 'button', text: 'Finish' }), onFinish)
        : el('span.pill', { text: session.status === 'skipped' ? 'SKIPPED' : 'DONE' }),
    ),
    el('h1.page-title', { text: snap.name ?? session.kind, style: { marginTop: '0.75rem' } }),
    el('div.page-sub', {
      text: [
        formatRelativeDate(session.date),
        snap.weekInMeso ? `week ${snap.weekInMeso}` : null,
        snap.isDeload ? 'deload' : null,
        snap.focus,
      ]
        .filter(Boolean)
        .join(' · '),
    }),
  );
}

function actionBar(...children) {
  return el('div.actionbar', null, el('div.actionbar-inner', null, ...children));
}

/** Sets that are actually part of the session's work, for progress counting. */
const countDone = (session) =>
  (session.entries ?? []).reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
const countTotal = (session) => (session.entries ?? []).reduce((n, e) => n + e.sets.length, 0);

function finishFlow(session, { onDone }) {
  const done = countDone(session);
  const total = countTotal(session);
  const short = total - done;

  const feelingRow = el('div.chips', { style: { marginTop: '0.75rem' } });
  let feeling = session.feeling ?? null;
  for (const [v, label] of [[1, 'Rough'], [2, 'Flat'], [3, 'OK'], [4, 'Good'], [5, 'Strong']]) {
    const b = el('button.chip', { type: 'button', text: label, 'aria-pressed': String(feeling === v) });
    onTap(b, () => {
      feeling = v;
      for (const c of feelingRow.children) c.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-pressed', 'true');
    });
    feelingRow.appendChild(b);
  }

  openSheet({
    title: 'Finish session?',
    subtitle:
      short > 0
        ? `${done} of ${total} sets logged. The ${short} you didn't do won't be recorded — an unlogged set is a set you didn't do, not a set of nothing.`
        : `All ${done} sets logged.`,
    content: el('div', null, el('div.eyebrow', { text: 'How did it feel?' }), feelingRow),
    actions: [
      {
        label: 'Finish',
        variant: 'good',
        onSelect: () => {
          store.completeSession(session.id, { feeling });
          stopRest();
          toast('Session logged', { kind: 'good' });
          onDone();
        },
      },
      { label: 'Keep going', variant: 'ghost' },
    ],
  });
}

// ---------------------------------------------------------------------------
// LIFT
// ---------------------------------------------------------------------------

function mountLift(screen, session, ctx) {
  let activeEntry = 0;
  let activeSet = null;
  const draft = {};

  // Resume where you left off rather than at the top.
  const firstUnfinished = session.entries.findIndex((e) => e.sets.some((s) => !s.done));
  if (firstUnfinished >= 0) activeEntry = firstUnfinished;

  const render = () => {
    clear(screen);
    const entry = session.entries[activeEntry];
    if (!entry) return;

    const ex = getExercise(entry.exerciseId);
    const snapEntry = session.prescriptionSnapshot?.entries?.[activeEntry] ?? {};

    // Default to the first set not yet done.
    const pending = entry.sets.find((s) => !s.done);
    if (activeSet == null || !entry.sets.some((s) => s.setId === activeSet)) {
      activeSet = pending?.setId ?? entry.sets[entry.sets.length - 1]?.setId ?? null;
    }
    const current = entry.sets.find((s) => s.setId === activeSet);

    append(screen, [header(session, () => finishFlow(session, ctx))]);

    // ---- exercise switcher
    const nav = el('div.exnav');
    session.entries.forEach((e, i) => {
      const complete = e.sets.length > 0 && e.sets.every((s) => s.done);
      const b = el('button', {
        type: 'button',
        text: getExercise(e.exerciseId).short,
        'aria-current': String(i === activeEntry),
        dataset: { complete: String(complete) },
      });
      onTap(b, () => {
        activeEntry = i;
        activeSet = null;
        render();
        scrollTop();
      });
      nav.appendChild(b);
    });
    screen.appendChild(nav);

    const body = el('div.stack-lg', { style: { marginTop: '1rem' } });
    screen.appendChild(body);

    // ---- prescription
    body.appendChild(
      el(
        'div.stack',
        null,
        el(
          'div.row',
          { style: { gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' } },
          snapEntry.tier ? el('span.pill.pill--t1', { text: snapEntry.tier }) : null,
          el('h2', { text: ex.name, style: { fontSize: 'var(--fs-lg)', fontWeight: '700' } }),
        ),
        el('div.small.muted.num', { text: snapEntry.label ?? '' }),

        // The single most valuable element on the screen.
        snapEntry.lastTime
          ? el(
              'div.lasttime',
              null,
              el('div.lasttime-label', {
                text: `Last time · ${formatRelativeDate(snapEntry.lastTime.date, session.date)}`,
              }),
              el('div.lasttime-sets', { text: fmtSets(snapEntry.lastTime.sets) }),
            )
          : el(
              'div.lasttime.lasttime--none',
              null,
              el('div.lasttime-label', { text: 'Last time' }),
              el('div.small', { text: 'First time doing this — pick something you can control.' }),
            ),

        snapEntry.suggestion ? el('div.suggestion', { text: snapEntry.suggestion }) : null,
        ex.cue ? el('div.cue', { text: ex.cue }) : null,
      ),
    );

    // ---- sets
    const list = el('div.setlist');
    entry.sets.forEach((s, i) => {
      const isActive = s.setId === activeSet;
      const typeLabel = s.type === 'top' ? 'TOP' : s.type === 'backoff' ? 'BACK-OFF' : s.type === 'warmup' ? 'WARMUP' : '';
      const main = s.done
        ? `${s.weightKg != null ? fmtWeight(s.weightKg) + (ex.loadModel === 'bodyweight_plus' ? '+' : '') : ''}${
            s.weightKg != null ? ' × ' : ''
          }${s.reps ?? '—'}${s.rpe ? ` @ ${s.rpe}` : ''}`
        : `${s.weightKg != null ? fmtWeight(s.weightKg) : '—'} × ${s.targetReps ?? '—'}`;

      const row = el(
        `button.setrow${s.done ? '.setrow--done' : ''}${isActive && !s.done ? '.setrow--active' : ''}`,
        { type: 'button' },
        el('span.setrow-idx', { text: String(i + 1) }),
        el(
          'span',
          null,
          el('div.setrow-main.num', { text: main }),
          el('div.setrow-sub', {
            text: s.done
              ? typeLabel || 'logged'
              : [typeLabel, s.rpeTarget ? `target RPE ${s.rpeTarget}` : null].filter(Boolean).join(' · ') || 'to do',
          }),
        ),
        el('span.setrow-type', { text: s.done ? '✓' : '' }),
      );

      onTap(row, () => {
        if (s.done) {
          openSheet({
            title: `Set ${i + 1}`,
            subtitle: main,
            actions: [
              {
                label: 'Edit this set',
                onSelect: () => {
                  store.unlogSet(session.id, entry.entryId, s.setId);
                  activeSet = s.setId;
                  render();
                },
              },
              {
                label: 'Delete set',
                variant: 'danger',
                onSelect: () => {
                  store.removeSet(session.id, entry.entryId, s.setId);
                  render();
                },
              },
              { label: 'Cancel', variant: 'ghost' },
            ],
          });
        } else {
          activeSet = s.setId;
          render();
        }
      });
      list.appendChild(row);
    });

    list.appendChild(
      onTap(
        el('button.btn.btn--sm.btn--ghost.btn--block', { type: 'button', text: '+ Add a set' }),
        () => {
          store.addSet(session.id, entry.entryId);
          render();
        },
      ),
    );
    body.appendChild(list);

    // ---- editor for the active set
    if (current && !current.done) {
      draft.weightKg = current.weightKg;
      draft.reps = current.targetReps ?? null;
      draft.rpe = null;

      const isBw = ex.loadModel === 'bodyweight_plus';
      const weightStepper = stepper({
        value: current.weightKg,
        step: ex.increment,
        min: isBw ? -60 : 0,
        label: isBw ? 'added kg' : 'kg',
        onChange: (v) => {
          draft.weightKg = v;
        },
      });

      const repStepper = stepper({
        value: draft.reps,
        step: 1,
        min: 0,
        max: 100,
        label: 'reps',
        format: (v) => String(Math.round(v)),
        onChange: (v) => {
          draft.reps = v;
          quickReps.setValue(v);
        },
      });

      const quickReps = repRow({
        value: draft.reps,
        target: current.targetReps,
        onChange: (v) => {
          draft.reps = v;
          repStepper.setValue(v);
        },
      });

      const rpe = rpeRow({
        value: null,
        target: current.rpeTarget,
        onChange: (v) => {
          draft.rpe = v;
        },
      });

      body.appendChild(
        el(
          'div.stack',
          null,
          el('div.eyebrow', { text: `Set ${entry.sets.indexOf(current) + 1}` }),
          el('div.field-grid', null, weightStepper, repStepper),
          el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Reps'), quickReps),
          el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'RPE'), rpe),
        ),
      );

      screen.appendChild(
        actionBar(
          onTap(
            el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: 'Log set' }),
            () => {
              if (!draft.reps) {
                toast('Add a rep count first');
                return;
              }
              const idx = entry.sets.indexOf(current);
              store.logSet(session.id, entry.entryId, current.setId, {
                weightKg: draft.weightKg,
                reps: draft.reps,
                rpe: draft.rpe,
              });

              const rest = snapEntry.restSec ?? 120;
              startRest(rest, ex.short);

              // Auto-advance: next set here, else the next unfinished exercise.
              const next = entry.sets.find((s) => !s.done);
              if (next) activeSet = next.setId;
              else {
                const ni = session.entries.findIndex((e, i) => i > activeEntry && e.sets.some((s) => !s.done));
                if (ni >= 0) {
                  activeEntry = ni;
                  activeSet = null;
                  scrollTop();
                }
              }

              undoToast(`Set ${idx + 1} logged`, () => {
                store.unlogSet(session.id, entry.entryId, current.setId);
                stopRest();
                activeSet = current.setId;
                render();
              });
              render();
              renderRest();
            },
          ),
        ),
      );
    } else {
      const allDone = session.entries.every((e) => e.sets.every((s) => s.done));
      screen.appendChild(
        actionBar(
          onTap(
            el(`button.btn.${allDone ? 'btn--good' : 'btn--primary'}.btn--xl.btn--block`, {
              type: 'button',
              text: allDone ? 'Finish session' : 'Next exercise',
            }),
            () => {
              if (allDone) {
                finishFlow(session, ctx);
                return;
              }
              const ni = session.entries.findIndex((e) => e.sets.some((s) => !s.done));
              if (ni >= 0) {
                activeEntry = ni;
                activeSet = null;
                render();
                scrollTop();
              } else finishFlow(session, ctx);
            },
          ),
        ),
      );
    }
  };

  return render;
}

// ---------------------------------------------------------------------------
// RUN
// ---------------------------------------------------------------------------

function mountRun(screen, session, ctx) {
  const snap = session.prescriptionSnapshot ?? {};
  const draft = {
    distanceKm: session.run?.distanceKm ?? snap.target?.km ?? null,
    durationSec: session.run?.durationSec ?? (snap.target?.minutes ? snap.target.minutes * 60 : null),
    effort: session.run?.effort ?? null,
    notes: session.run?.notes ?? '',
  };

  const render = () => {
    clear(screen);
    append(screen, [header(session, () => commit(true))]);

    const pace = el('div.stat-value.num');
    const paceNote = el('div.stat-label');

    const paintPace = () => {
      const p = paceSecPerKm(draft.distanceKm, draft.durationSec);
      pace.textContent = formatPace(p);
      paceNote.textContent = p ? 'Pace' : 'Enter distance and time';
    };

    const mins = Math.floor((draft.durationSec ?? 0) / 60);
    const secs = Math.round((draft.durationSec ?? 0) % 60);

    const distStep = stepper({
      value: draft.distanceKm,
      step: 0.1,
      min: 0,
      max: 100,
      label: 'km',
      format: (v) => v.toFixed(1),
      onChange: (v) => {
        draft.distanceKm = v;
        paintPace();
      },
    });

    const minStep = stepper({
      value: mins,
      step: 1,
      min: 0,
      max: 600,
      label: 'min',
      format: (v) => String(Math.round(v)),
      onChange: (v) => {
        draft.durationSec = (v ?? 0) * 60 + (draft.durationSec ?? 0) % 60;
        paintPace();
      },
    });

    const secStep = stepper({
      value: secs,
      step: 5,
      min: 0,
      max: 55,
      label: 'sec',
      format: (v) => String(Math.round(v)).padStart(2, '0'),
      onChange: (v) => {
        draft.durationSec = Math.floor((draft.durationSec ?? 0) / 60) * 60 + (v ?? 0);
        paintPace();
      },
    });

    const effort = el('div.chips');
    for (let i = 1; i <= 10; i++) {
      const b = el('button.chip', { type: 'button', text: String(i), 'aria-pressed': String(draft.effort === i) });
      onTap(b, () => {
        draft.effort = i;
        for (const c of effort.children) c.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
      });
      effort.appendChild(b);
    }

    paintPace();

    append(screen, [
      el(
        'div.stack-lg',
        null,
        el(
          'div.card',
          null,
          el('div.eyebrow', { text: `Run week ${snap.runWeek ?? '—'}` }),
          el('div.hero-title', { text: `Target: ${snap.label ?? '—'}` }),
          snap.focus ? el('p.small.muted', { text: snap.focus, style: { marginTop: '0.4rem' } }) : null,
          snap.note ? el('p.small', { text: snap.note, style: { marginTop: '0.4rem', color: 'var(--warn)' } }) : null,
        ),

        el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Distance'), distStep),
        el(
          'div',
          null,
          el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Time'),
          el('div.field-grid', null, minStep, secStep),
        ),
        el('div.stat', null, pace, paceNote),
        el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Perceived effort (1–10)'), effort),
      ),
    ]);

    screen.appendChild(
      actionBar(
        onTap(
          el('button.btn.btn--good.btn--xl.btn--block', { type: 'button', text: 'Log run' }),
          () => commit(false),
        ),
      ),
    );
  };

  function commit(viaFinish) {
    if (!draft.distanceKm || !draft.durationSec) {
      toast('Distance and time are both needed to log a run');
      return;
    }
    store.updateSession(session.id, (s) => {
      s.run = { ...draft };
    });
    void viaFinish;
    store.completeSession(session.id, {});
    const p = paceSecPerKm(draft.distanceKm, draft.durationSec);
    toast(`${draft.distanceKm.toFixed(1)}km logged · ${formatPace(p)}`, { kind: 'good' });
    ctx.onDone();
  }

  return render;
}

// ---------------------------------------------------------------------------
// CORE
// ---------------------------------------------------------------------------

function mountCore(screen, session, ctx) {
  let activeEntry = 0;
  const firstUnfinished = session.entries.findIndex((e) => e.sets.some((s) => !s.done));
  if (firstUnfinished >= 0) activeEntry = firstUnfinished;

  let liveTimer = null;

  const render = () => {
    liveTimer?.stop?.();
    liveTimer = null;
    clear(screen);

    const entry = session.entries[activeEntry];
    if (!entry) return;
    const ex = getExercise(entry.exerciseId);
    const snapEntry = session.prescriptionSnapshot?.entries?.[activeEntry] ?? {};
    const isTime = ex.metric === 'time';
    const current = entry.sets.find((s) => !s.done);

    append(screen, [header(session, () => finishFlow(session, ctx))]);

    const nav = el('div.exnav');
    session.entries.forEach((e, i) => {
      const complete = e.sets.every((s) => s.done);
      const b = el('button', {
        type: 'button',
        text: getExercise(e.exerciseId).short,
        'aria-current': String(i === activeEntry),
        dataset: { complete: String(complete) },
      });
      onTap(b, () => {
        activeEntry = i;
        render();
        scrollTop();
      });
      nav.appendChild(b);
    });
    screen.appendChild(nav);

    const body = el('div.stack-lg', { style: { marginTop: '1rem' } });
    screen.appendChild(body);

    body.appendChild(
      el(
        'div.stack',
        null,
        el('h2', { text: ex.name, style: { fontSize: 'var(--fs-lg)', fontWeight: '700' } }),
        el('div.small.muted', { text: snapEntry.label ?? '' }),
        ex.cue ? el('div.cue', { text: ex.cue }) : null,
        ex.perSide ? el('div.small.muted', { text: 'Both sides count as one set.' }) : null,
      ),
    );

    const list = el('div.setlist');
    entry.sets.forEach((s, i) => {
      const val = s.done ? (isTime ? `${s.seconds}s` : `${s.reps} reps`) : isTime ? `${s.targetSeconds}s target` : `${s.targetReps} target`;
      const row = el(
        `button.setrow${s.done ? '.setrow--done' : ''}${!s.done && s === current ? '.setrow--active' : ''}`,
        { type: 'button' },
        el('span.setrow-idx', { text: String(i + 1) }),
        el('span', null, el('div.setrow-main.num', { text: val })),
        el('span.setrow-type', { text: s.done ? '✓' : '' }),
      );
      onTap(row, () => {
        if (s.done) {
          store.unlogSet(session.id, entry.entryId, s.setId);
          render();
        }
      });
      list.appendChild(row);
    });
    body.appendChild(list);

    if (current) {
      if (isTime) {
        liveTimer = holdTimer({ targetSeconds: current.targetSeconds });
        body.appendChild(liveTimer);
        screen.appendChild(
          actionBar(
            onTap(el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: 'Log hold' }), () => {
              const seconds = liveTimer.getSeconds();
              if (!seconds) {
                toast('Start the timer first');
                return;
              }
              store.logSet(session.id, entry.entryId, current.setId, { seconds });
              startRest(snapEntry.restSec ?? 45, ex.short);
              advance();
            }),
          ),
        );
      } else {
        let reps = current.targetReps ?? 10;
        const repStep = stepper({
          value: reps,
          step: 1,
          min: 0,
          max: 100,
          label: 'reps',
          format: (v) => String(Math.round(v)),
          onChange: (v) => {
            reps = v;
          },
        });
        body.appendChild(el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Reps'), repStep));
        screen.appendChild(
          actionBar(
            onTap(el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: 'Log set' }), () => {
              if (!reps) {
                toast('Add a rep count first');
                return;
              }
              store.logSet(session.id, entry.entryId, current.setId, { reps });
              startRest(snapEntry.restSec ?? 45, ex.short);
              advance();
            }),
          ),
        );
      }
    } else {
      const allDone = session.entries.every((e) => e.sets.every((s) => s.done));
      screen.appendChild(
        actionBar(
          onTap(
            el(`button.btn.${allDone ? 'btn--good' : 'btn--primary'}.btn--xl.btn--block`, {
              type: 'button',
              text: allDone ? 'Finish session' : 'Next exercise',
            }),
            () => {
              if (allDone) finishFlow(session, ctx);
              else advance();
            },
          ),
        ),
      );
    }
  };

  function advance() {
    const entry = session.entries[activeEntry];
    if (!entry.sets.some((s) => !s.done)) {
      const ni = session.entries.findIndex((e, i) => i > activeEntry && e.sets.some((s) => !s.done));
      if (ni >= 0) {
        activeEntry = ni;
        scrollTop();
      }
    }
    render();
    renderRest();
  }

  return render;
}

// ---------------------------------------------------------------------------
// Completed / read-only view
// ---------------------------------------------------------------------------

function renderCompleted(screen, session) {
  clear(screen);
  append(screen, [header(session, () => {})]);

  const body = el('div.stack-lg', { style: { marginTop: '1rem' } });
  screen.appendChild(body);

  if (session.status === 'skipped') {
    body.appendChild(
      el('div.card', null, el('p.small.muted', { text: 'Recorded as skipped. It still counts as a session that went past — that is why the program moved on.' })),
    );
  }

  if (session.kind === 'run' && session.run) {
    const p = paceSecPerKm(session.run.distanceKm, session.run.durationSec);
    body.appendChild(
      el(
        'div.statgrid',
        null,
        el('div.stat', null, el('div.stat-value.num', { text: `${session.run.distanceKm}` }), el('div.stat-label', { text: 'km' })),
        el('div.stat', null, el('div.stat-value.num', { text: formatDuration(session.run.durationSec) }), el('div.stat-label', { text: 'time' })),
        el('div.stat', null, el('div.stat-value.num', { text: formatPace(p).replace(' /km', '') }), el('div.stat-label', { text: 'per km' })),
        session.run.effort
          ? el('div.stat', null, el('div.stat-value.num', { text: String(session.run.effort) }), el('div.stat-label', { text: 'effort' }))
          : null,
      ),
    );
  }

  for (const entry of session.entries ?? []) {
    const ex = getExercise(entry.exerciseId);
    const done = entry.sets.filter((s) => s.done);
    if (!done.length) continue;

    const best = done.reduce(
      (b, s) => {
        if (!s.reps) return b;
        const v = e1rm(effectiveLoad(s, ex, session.bodyweightKg), s.reps, s.rpe);
        return v > b.v ? { v, s } : b;
      },
      { v: 0, s: null },
    );

    body.appendChild(
      el(
        'div.card',
        null,
        el('div.row-between', null, el('div.listitem-title', { text: ex.name }), best.v ? el('span.small.dim.num', { text: `e1RM ${Math.round(best.v)}kg` }) : null),
        el('div.small.muted.num', { style: { marginTop: '0.35rem' }, text: fmtSets(entry.sets, { max: 12 }) }),
      ),
    );
  }

  body.appendChild(
    onTap(
      el('button.btn.btn--ghost.btn--block', { type: 'button', text: 'Delete this session' }),
      () =>
        confirmSheet({
          title: 'Delete session?',
          subtitle: 'It disappears from history and your progress charts. This cannot be undone.',
          confirmLabel: 'Delete',
          onConfirm: () => {
            store.deleteSession(session.id);
            toast('Session deleted');
            navigate('/history');
          },
        }),
    ),
  );
}

// ---------------------------------------------------------------------------

export default function mountSession(root, params) {
  const session = store.getSession(params.id);
  const screen = el('div.screen.screen--session');
  root.appendChild(screen);

  if (!session) {
    append(screen, [
      el('div.empty', null, el('div.empty-mark', { text: '·' }), el('p', { text: 'That session no longer exists.' })),
      onTap(el('button.btn.btn--block', { type: 'button', text: 'Back to today' }), () => navigate('/')),
    ]);
    return {};
  }

  if (session.status !== 'in_progress') {
    renderCompleted(screen, session);
    renderRest();
    return {};
  }

  unlockAudio();
  const releaseWake = keepAwake();
  // Hides the tab bar for the duration; see base.css. Both it and the action bar
  // live at bottom:0, and the tab bar would otherwise swallow taps on "Log set".
  document.body.dataset.session = 'active';
  const ctx = { onDone: () => navigate('/') };

  const render =
    session.kind === 'lift'
      ? mountLift(screen, session, ctx)
      : session.kind === 'run'
        ? mountRun(screen, session, ctx)
        : mountCore(screen, session, ctx);

  render();
  renderRest();

  return {
    unmount() {
      releaseWake();
      delete document.body.dataset.session;
      store.flush().catch(() => {});
      renderRest();
    },
  };
}
