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
import { stepper, rpeRow, repRow, textSheet } from '../stepper.js';
import { startRest, stopRest, renderRest, holdTimer, keepAwake, unlockAudio } from '../timer.js';
import { syncBottomChrome, revealBelowChrome } from '../chrome.js';
import { runTracker, trackMapCard, geoSupported } from '../runtracker.js';
import { downsample } from '../../core/geo.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { toast, undoToast } from '../toast.js';
import * as store from '../../data/store.js';
import { getExercise, EXERCISES, MUSCLE_LABELS } from '../../program/exercises.js';
import { formatRelativeDate, formatDuration } from '../../core/dates.js';
import { paceSecPerKm, formatPace, effectiveLoad, e1rm, runLoadWarnings } from '../../core/progression.js';
import { sessionIntegrity } from '../../core/schema.js';
import { getProgram } from '../../program/index.js';
import { navigate } from '../../router.js';

// ---------------------------------------------------------------------------
// Shared chrome
// ---------------------------------------------------------------------------

/** Pick the gym for an in-progress session. Only offered when there is a choice. */
function gymPill(session, onChange) {
  const gyms = store.getState().meta.gyms ?? [];
  if (session.kind !== 'lift' || (gyms.length === 0 && session.gymId == null)) return null;
  const name = store.gymName(session.gymId) ?? 'No gym set';
  const pill = el('button.pill.pill--tap', { type: 'button', text: name, dataset: { gymPill: '' } });
  if (session.status !== 'in_progress' || gyms.length < 2) {
    pill.setAttribute('disabled', 'true');
    return pill;
  }
  onTap(pill, () =>
    openSheet({
      title: 'Training where?',
      subtitle: 'Cable and machine loads are remembered per gym. Exercises you have not logged yet are re-read for the gym you pick.',
      actions: [
        ...gyms.map((g) => ({
          label: g.name + (g.id === session.gymId ? ' · current' : ''),
          onSelect: () => {
            store.setSessionGym(session.id, g.id);
            onChange?.();
          },
        })),
        { label: 'Cancel', variant: 'ghost' },
      ],
    }),
  );
  return pill;
}

function header(session, onFinish, onChange) {
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
    el(
      'div.row',
      { style: { gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' } },
      el('div.page-sub', {
        text: [
          formatRelativeDate(session.date),
          snap.role ? snap.role + (snap.role === 'deload' ? '' : ' week') : snap.weekInMeso ? `week ${snap.weekInMeso}` : null,
          !snap.role && snap.isDeload ? 'deload' : null,
          snap.focus,
        ]
          .filter(Boolean)
          .join(' · '),
      }),
      gymPill(session, onChange),
    ),
  );
}

/**
 * Swap an entry for another exercise — the station is taken, the bar is
 * bent, the dumbbells stop at 30. Recommended substitutes first (same job,
 * different equipment), then anything grouped by muscle. With a gym set the
 * swap can be made standing: "always at this gym".
 */
function swapSheet(session, entry, snapEntry, onDone) {
  const ex = getExercise(entry.exerciseId);
  const original = entry.swappedFrom ?? entry.exerciseId;
  const originalEx = getExercise(original);
  const recommended = [...new Set([...(originalEx.alternatives ?? []), ...(ex.alternatives ?? [])])]
    .filter((id) => id !== entry.exerciseId && EXERCISES[id] && !EXERCISES[id].retired);
  const modality = originalEx.modality;
  const byMuscle = new Map();
  for (const e of Object.values(EXERCISES)) {
    if (e.retired || e.modality !== modality || e.id === entry.exerciseId || recommended.includes(e.id)) continue;
    if (e.modality === 'run') continue;
    const key = e.muscle ?? 'other';
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key).push(e);
  }
  // The original's muscle first, then the rest alphabetically.
  const groups = [...byMuscle.entries()].sort(([a], [b]) =>
    a === originalEx.muscle ? -1 : b === originalEx.muscle ? 1 : (MUSCLE_LABELS[a] ?? a).localeCompare(MUSCLE_LABELS[b] ?? b),
  );

  let close = () => {};
  const row = (e, sub) =>
    onTap(
      el(
        'button.listitem',
        { type: 'button', dataset: { swapTo: e.id } },
        el('span.grow', null, el('div.listitem-title', { text: e.name }), sub ? el('div.listitem-sub.truncate', { text: sub }) : null),
        e.gymSpecific ? el('span.pill', { text: 'STACK' }) : null,
      ),
      () => {
        close();
        choose(e);
      },
    );

  const choose = (e) => {
    const gymId = session.gymId;
    const apply = (standing) => {
      store.reresolveEntry(session.id, entry.entryId, { exerciseId: e.id, station: null });
      if (standing && gymId != null) store.setSubstitution(gymId, original, e.id === original ? null : e.id);
      toast(e.id === original ? `Back to ${e.short}` : `Swapped to ${e.short}${standing ? ' — always here' : ''}`);
      onDone();
    };
    if (gymId == null || e.id === original) {
      apply(false);
      return;
    }
    openSheet({
      title: `${e.short} instead of ${originalEx.short}`,
      subtitle: `Just this once, or every time you train at ${store.gymName(gymId)}?`,
      actions: [
        { label: 'Just today', onSelect: () => apply(false) },
        { label: `Always at ${store.gymName(gymId)}`, onSelect: () => apply(true) },
        { label: 'Cancel', variant: 'ghost' },
      ],
    });
  };

  const content = el('div.stack');
  if (entry.swappedFrom) {
    content.appendChild(el('div.section-label', { style: { marginTop: 0 }, text: 'Programmed' }));
    content.appendChild(el('div.listgroup', null, row(originalEx, 'Back to the programmed exercise')));
  }
  if (recommended.length) {
    content.appendChild(el('div.section-label', { style: { marginTop: entry.swappedFrom ? undefined : 0 }, text: 'Recommended' }));
    content.appendChild(el('div.listgroup', null, ...recommended.map((id) => row(getExercise(id), getExercise(id).cue))));
  }
  for (const [muscle, list] of groups) {
    content.appendChild(el('div.section-label', { text: MUSCLE_LABELS[muscle] ?? muscle }));
    content.appendChild(el('div.listgroup', null, ...list.map((e) => row(e))));
  }

  close = openSheet({
    title: `Swap ${ex.short}`,
    subtitle: `${snapEntry.label ?? ''} stays the same — the load and "last time" come from the exercise you pick.`,
    content,
  });
}

/** Append an exercise to the session — for when a set is already logged. */
function addExerciseSheet(session, onDone) {
  let close = () => {};
  const byMuscle = new Map();
  for (const e of Object.values(EXERCISES)) {
    if (e.retired || e.modality === 'run') continue;
    const key = e.muscle ?? 'other';
    if (!byMuscle.has(key)) byMuscle.set(key, []);
    byMuscle.get(key).push(e);
  }
  const content = el('div.stack');
  for (const [muscle, list] of [...byMuscle.entries()].sort(([a], [b]) => (MUSCLE_LABELS[a] ?? a).localeCompare(MUSCLE_LABELS[b] ?? b))) {
    content.appendChild(el('div.section-label', { text: MUSCLE_LABELS[muscle] ?? muscle }));
    content.appendChild(
      el(
        'div.listgroup',
        null,
        ...list.map((e) =>
          onTap(el('button.listitem', { type: 'button' }, el('span.grow', null, el('div.listitem-title', { text: e.name }))), () => {
            close();
            store.addEntry(session.id, e.id);
            toast(`Added ${e.short}`);
            onDone();
          }),
        ),
      ),
    );
  }
  close = openSheet({ title: 'Add an exercise', subtitle: 'Appended to the end of this session, three sets by default.', content });
}

/** Tag which station this entry was done on — remembered per exercise per gym. */
function stationSheet(session, entry, onDone) {
  const known = store.stationsFor(entry.exerciseId, session.gymId);
  const set = (station) => {
    store.reresolveEntry(session.id, entry.entryId, { station });
    onDone();
  };
  openSheet({
    title: 'Which station?',
    subtitle: 'Two cable machines in one gym rarely pull the same. Tag the one you are on and its history stays its own.',
    actions: [
      ...known.map((k) => ({ label: k + (entry.station === k ? ' · current' : ''), onSelect: () => set(k) })),
      { label: 'New station…', onSelect: () => textSheet({ title: 'Station name', placeholder: 'e.g. left stack', onSubmit: (v) => set(v) }) },
      ...(entry.station ? [{ label: 'No station', variant: 'ghost', onSelect: () => set(null) }] : []),
      { label: 'Cancel', variant: 'ghost' },
    ],
  });
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
  const coreEntries = (session.entries ?? []).filter((e) => e.group === 'core');
  const coreDone = coreEntries.filter((e) => e.sets.some((s) => s.done)).length;
  const coreNote =
    coreEntries.length && coreDone < coreEntries.length
      ? ` Core: ${coreDone} of ${coreEntries.length} moves logged — it is tracked, and under 75% means the placement is wrong, not you.`
      : '';

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
      (short > 0
        ? `${done} of ${total} sets logged. The ${short} you didn't do won't be recorded — an unlogged set is a set you didn't do, not a set of nothing.`
        : `All ${done} sets logged.`) + coreNote,
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

const TYPE_LABEL = { top: 'TOP', probe: 'PROBE', backoff: 'BACK-OFF', warmup: 'WARMUP' };

/** How a logged set reads in the list. */
function setSummary(s, ex) {
  const bw = ex.loadModel === 'bodyweight_plus' ? '+' : '';
  if (ex.metric === 'time') return `${s.seconds ?? s.targetSeconds ?? '—'}s`;
  if (ex.metric === 'weight_time') {
    return `${s.weightKg != null ? fmtWeight(s.weightKg) + ' × ' : ''}${s.seconds ?? s.targetSeconds ?? '—'}s`;
  }
  if (ex.metric === 'reps') return `${s.reps ?? s.targetReps ?? '—'} reps`;
  if (s.done) {
    return `${s.weightKg != null ? fmtWeight(s.weightKg) + bw : ''}${s.weightKg != null ? ' × ' : ''}${s.reps ?? '—'}${s.rpe ? ` @ ${s.rpe}` : ''}`;
  }
  return `${s.weightKg != null ? fmtWeight(s.weightKg) + bw : '—'} × ${s.targetReps ?? '—'}`;
}

/**
 * The editor for one pending set, by the exercise's metric. Returns the fields
 * to render and a `read()` that yields the values to log (or a reason not to).
 */
function setEditor(ex, current, { liveTimer }) {
  const draft = { weightKg: current.weightKg, reps: current.targetReps ?? null, rpe: null, seconds: null };
  const isBw = ex.loadModel === 'bodyweight_plus';
  const wantsWeight = ex.metric === 'weight_reps' || ex.metric === 'weight_time';
  const wantsReps = ex.metric === 'weight_reps' || ex.metric === 'reps';
  const wantsTime = ex.metric === 'time' || ex.metric === 'weight_time';
  const wantsRpe = ex.metric === 'weight_reps' && current.rpeTarget !== 10;

  const fields = el('div.stack');
  const weightStepper = wantsWeight
    ? stepper({
        value: current.weightKg,
        step: ex.increment,
        unit: ex.unit,
        min: isBw ? -60 : 0,
        label: isBw ? 'added kg' : 'kg',
        onChange: (v) => {
          draft.weightKg = v;
        },
      })
    : null;

  let repStepper = null;
  let quickReps = null;
  if (wantsReps) {
    repStepper = stepper({
      value: draft.reps,
      step: 1,
      min: 0,
      max: 100,
      label: 'reps',
      format: (v) => String(Math.round(v)),
      onChange: (v) => {
        draft.reps = v;
        quickReps?.setValue(v);
      },
    });
    quickReps = repRow({
      value: draft.reps,
      target: current.targetReps,
      onChange: (v) => {
        draft.reps = v;
        repStepper.setValue(v);
      },
    });
  }

  const grid = el('div.field-grid', null, weightStepper, repStepper);
  if (weightStepper || repStepper) fields.appendChild(grid);
  if (quickReps) fields.appendChild(el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Reps'), quickReps));
  if (wantsTime) {
    const t = liveTimer({ targetSeconds: current.targetSeconds });
    fields.appendChild(t.node);
    draft.readSeconds = () => t.getSeconds();
  }
  if (wantsRpe) {
    fields.appendChild(
      el(
        'div',
        null,
        el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'RPE'),
        rpeRow({ value: null, target: current.rpeTarget, onChange: (v) => { draft.rpe = v; } }),
      ),
    );
  } else if (ex.metric === 'weight_reps' && current.rpeTarget === 10) {
    fields.appendChild(el('p.xs.dim', { text: 'Last set: to failure. Logged as RPE 10.' }));
    draft.rpe = 10;
  }

  return {
    node: fields,
    read() {
      const out = {};
      if (wantsWeight) out.weightKg = draft.weightKg;
      if (wantsReps) {
        if (!draft.reps) return { error: 'Add a rep count first' };
        out.reps = draft.reps;
      }
      if (wantsTime) {
        const secs = draft.readSeconds?.() ?? 0;
        if (!secs) return { error: 'Start the timer first' };
        out.seconds = secs;
      }
      if (ex.metric === 'weight_reps') out.rpe = draft.rpe;
      return { values: out };
    },
  };
}

function mountLift(screen, session, ctx) {
  let activeEntry = 0;
  let activeSet = null;
  let liveTimer = null;

  // Resume where you left off rather than at the top.
  const firstUnfinished = session.entries.findIndex((e) => e.sets.some((s) => !s.done));
  if (firstUnfinished >= 0) activeEntry = firstUnfinished;

  const render = () => {
    liveTimer?.stop?.();
    liveTimer = null;
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

    append(screen, [header(session, () => finishFlow(session, ctx), () => { activeSet = null; render(); })]);

    // ---- exercise switcher (core work gets a divider — it is the tail of the day)
    const nav = el('div.exnav');
    let dividerDone = false;
    session.entries.forEach((e, i) => {
      if (e.group === 'core' && !dividerDone) {
        nav.appendChild(el('span.exnav-divider', { text: 'core', 'aria-hidden': 'true' }));
        dividerDone = true;
      }
      const complete = e.sets.length > 0 && e.sets.every((s) => s.done);
      const b = el('button', {
        type: 'button',
        text: getExercise(e.exerciseId).short,
        'aria-current': String(i === activeEntry),
        dataset: { complete: String(complete), group: e.group ?? 'lift' },
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
    const ref = snapEntry.reference;
    body.appendChild(
      el(
        'div.stack',
        null,
        el(
          'div.row',
          { style: { gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' } },
          snapEntry.tier ? el('span.pill.pill--t1', { text: snapEntry.tier }) : null,
          entry.group === 'core' ? el('span.pill', { text: 'CORE' }) : null,
          el('h2', { text: ex.name, style: { fontSize: 'var(--fs-lg)', fontWeight: '700' } }),
        ),
        el('div.small.muted.num', { text: snapEntry.label ?? '' }),
        ref
          ? el('div.xs.dim.num', {
              text: `Block reference e1RM ${Math.round(ref.e1rm)} kg${ex.loadModel === 'bodyweight_plus' ? ' (system)' : ''} · ${
                ref.source === 'test' ? 'set by last test' : ref.source === 'backoffs' ? 'raised by back-offs' : ref.source === 'probe-raise' ? 'raised by today\'s probe' : 'from the probe'
              }`,
            })
          : null,

        // The single most valuable element on the screen.
        snapEntry.lastTime
          ? el(
              'div.lasttime',
              null,
              el('div.lasttime-label', {
                text: `Last time · ${formatRelativeDate(snapEntry.lastTime.date, session.date)}${
                  snapEntry.scope === 'other' ? ' · other gym' : ''
                }`,
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
        ex.perSide ? el('div.small.muted', { text: 'Both sides count as one set.' }) : null,

        // Station and swap. Both re-resolve the entry, so both close once a set
        // is logged; after that the honest move is to add another exercise.
        el(
          'div.btn-row',
          { style: { marginTop: '0.25rem' } },
          ex.gymSpecific && session.gymId != null
            ? onTap(
                el('button.btn.btn--sm.btn--ghost', {
                  type: 'button',
                  text: entry.station ? `Station: ${entry.station}` : 'Station: any',
                  dataset: { station: '' },
                  ...(entry.sets.some((x) => x.done) ? { disabled: 'true' } : {}),
                }),
                () => stationSheet(session, entry, () => { activeSet = null; render(); }),
              )
            : null,
          entry.sets.some((x) => x.done)
            ? onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '+ Add exercise', dataset: { addExercise: '' } }), () =>
                addExerciseSheet(session, () => { activeEntry = session.entries.length - 1; activeSet = null; render(); scrollTop(); }),
              )
            : onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: entry.swappedFrom ? 'Swapped · change' : 'Swap exercise', dataset: { swap: '' } }), () =>
                swapSheet(session, entry, snapEntry, () => { activeSet = null; render(); }),
              ),
        ),
      ),
    );

    // ---- sets
    const list = el('div.setlist');
    entry.sets.forEach((s, i) => {
      const isActive = s.setId === activeSet;
      const typeLabel = TYPE_LABEL[s.type] ?? '';
      const main = setSummary(s, ex);

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
              : [typeLabel, s.rpeTarget ? (s.rpeTarget === 10 ? 'to failure' : `target RPE ${s.rpeTarget}`) : null]
                  .filter(Boolean)
                  .join(' · ') || 'to do',
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
      const editor = setEditor(ex, current, {
        liveTimer: (o) => {
          liveTimer = holdTimer(o);
          return { node: liveTimer, getSeconds: () => liveTimer.getSeconds() };
        },
      });

      body.appendChild(
        el('div.stack', { dataset: { editor: '' } }, el('div.eyebrow', { text: `Set ${entry.sets.indexOf(current) + 1}` }), editor.node),
      );

      const logLabel = ex.metric === 'time' || ex.metric === 'weight_time' ? 'Log hold' : 'Log set';
      screen.appendChild(
        actionBar(
          onTap(
            el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: logLabel }),
            () => {
              const r = editor.read();
              if (r.error) {
                toast(r.error);
                return;
              }
              const idx = entry.sets.indexOf(current);
              store.logSet(session.id, entry.entryId, current.setId, r.values);

              const rest = snapEntry.restSec ?? (entry.group === 'core' ? 45 : 120);
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
              // The rest bar has just appeared over the bottom of the screen;
              // bring the next set's controls back above it.
              requestAnimationFrame(() => {
                syncBottomChrome();
                revealBelowChrome(screen.querySelector('[data-editor]'));
              });
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

  const wrapped = () => render();
  wrapped.stop = () => liveTimer?.stop?.();
  ctx.onTeardown?.(() => liveTimer?.stop?.());
  return wrapped;
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
    talkTest: session.run?.talkTest ?? null,
    notes: session.run?.notes ?? '',
    track: session.run?.track ?? null,
    routeId: session.run?.routeId ?? null,
    plannedKm: session.run?.plannedKm ?? null,
  };

  // null → not chosen yet, 'gps' | 'timer' | 'manual'
  let mode = draft.track?.length ? 'gps' : null;
  let tracker = null;
  let mapCard = null;

  const stopTracker = () => {
    tracker?.stop?.();
    tracker = null;
    mapCard?.destroy();
    mapCard = null;
  };
  ctx.onTeardown?.(stopTracker);

  const routeOf = () => (draft.routeId ? store.getRoute(draft.routeId) : null);

  /** Pick a saved route, or go and plan one; the planner comes back here. */
  function routeCard() {
    const route = routeOf();
    const { routes } = store.getState();
    const pick = () => {
      let close = () => {};
      const list = el(
        'div.listgroup',
        null,
        ...routes.map((r) =>
          onTap(
            el('button.listitem', { type: 'button', dataset: { pickRoute: r.id } },
              el('span.listitem-mark.listitem-mark--run'),
              el('span.grow', null, el('div.listitem-title', { text: r.name })),
              el('span.num', { text: `${r.km.toFixed(2)} km` }),
            ),
            () => {
              close();
              draft.routeId = r.id;
              draft.plannedKm = r.km;
              // The route's distance is the honest prefill until GPS says otherwise.
              if (!draft.track?.length) draft.distanceKm = r.km;
              save();
              render();
            },
          ),
        ),
      );
      close = openSheet({
        title: 'Which route?',
        content: routes.length ? list : el('p.small.muted', { text: 'No saved routes yet.' }),
        actions: [
          { label: '+ Plan a new route', onSelect: () => navigate(`/routes/new?back=session/${session.id}`) },
          { label: 'Cancel', variant: 'ghost' },
        ],
      });
    };
    return el(
      'div.card',
      { dataset: { routeCard: '' } },
      el('div.row-between', null,
        el('div.grow', null,
          el('div.eyebrow', { text: 'Route' }),
          route
            ? el('div.listitem-title', { text: `${route.name} · ${route.km.toFixed(2)} km` })
            : el('div.small.muted', { text: 'Plan the loop first and the distance is known before you start.' }),
        ),
        el('div.btn-row', null,
          onTap(el('button.btn.btn--sm', { type: 'button', text: route ? 'Change' : 'Pick a route' }), pick),
          route
            ? onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: 'Remove' }), () => {
                draft.routeId = null;
                draft.plannedKm = null;
                save();
                render();
              })
            : null,
        ),
      ),
    );
  }

  /** Track live, time it, or just type the numbers in. */
  function modeBlock() {
    if (mode === 'gps' && draft.track?.length && !tracker) {
      // Already tracked — show the route on the map rather than the controls.
      mapCard?.destroy();
      mapCard = trackMapCard({ track: draft.track, route: routeOf() });
      return el(
        'div.card',
        null,
        el('div.eyebrow', { text: 'Tracked route' }),
        mapCard.node,
        el('p.xs.dim', { text: `${draft.track.length} GPS points recorded.` }),
      );
    }

    if (mode === 'gps' || mode === 'timer') {
      stopTracker();
      tracker = runTracker({
        useGps: mode === 'gps',
        route: routeOf(),
        onFinish: ({ seconds, km, track }) => {
          if (seconds > 0) draft.durationSec = seconds;
          if (km) draft.distanceKm = km;
          if (track?.length > 1) draft.track = downsample(track, { minMeters: 10 });
          mode = km ? 'gps' : 'manual';
          save();
          render();
        },
      });
      return tracker;
    }

    return el(
      'div.btn-row',
      null,
      geoSupported()
        ? onTap(el('button.btn.btn--primary', { type: 'button', text: 'Track with GPS' }), () => {
            mode = 'gps';
            render();
          })
        : null,
      onTap(el('button.btn', { type: 'button', text: 'Stopwatch' }), () => {
        mode = 'timer';
        render();
      }),
    );
  }

  /** Persist the draft without completing, so a mid-run kill loses nothing. */
  function save() {
    store.updateSession(session.id, (s) => {
      s.run = { ...(s.run ?? {}), ...draft };
    });
  }

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

    // CR10 effort with the 3–4 band marked (SYNTHESIS §3.3). ≥ 5 on an easy run
    // is an intensity error, and this number is the one training variable that
    // tracked injury in novices (Kluitenberg 2016).
    const effort = el('div.chips');
    for (let i = 1; i <= 10; i++) {
      const b = el('button.chip', {
        type: 'button',
        text: String(i),
        'aria-pressed': String(draft.effort === i),
        dataset: { band: i >= 3 && i <= 4 ? 'target' : i >= 5 ? 'high' : 'low' },
      });
      onTap(b, () => {
        draft.effort = i;
        for (const c of effort.children) c.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
      });
      effort.appendChild(b);
    }

    // Talk Test — could you say a full ~10-word sentence without a breath pause?
    const talk = el('div.chips');
    for (const [v, label] of [['yes', 'Full sentences'], ['no', 'Couldn\'t talk']]) {
      const b = el('button.chip', { type: 'button', text: label, 'aria-pressed': String(draft.talkTest === v), dataset: { talk: v } });
      onTap(b, () => {
        draft.talkTest = v;
        for (const c of talk.children) c.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-pressed', 'true');
      });
      talk.appendChild(b);
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

        mode == null ? routeCard() : null,
        modeBlock(),

        el('div', null, el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Distance'), distStep),
        el(
          'div',
          null,
          el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Time'),
          el('div.field-grid', null, minStep, secStep),
        ),
        el('div.stat', null, pace, paceNote),
        el(
          'div',
          null,
          el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Effort (CR10) · aim for 3–4'),
          effort,
        ),
        el(
          'div',
          null,
          el('div.eyebrow', { style: { marginBottom: '0.4rem' } }, 'Talk test — a full sentence without a breath?'),
          talk,
        ),
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

  function commit(viaFinish, { confirmed = false } = {}) {
    if (!draft.distanceKm || !draft.durationSec) {
      toast('Distance and time are both needed to log a run');
      return;
    }
    // The load rails run on what was ACTUALLY run, GPS or typed — a planned
    // 5.5 that became 7 is exactly the run the guard exists for (SYNTHESIS §3.1).
    if (!confirmed) {
      const { sessions, meta } = store.getState();
      const warnings = runLoadWarnings(
        sessions,
        { km: draft.distanceKm, date: session.date, sessionId: session.id },
        { today: session.date, priorInjury: meta.priorLowerLimbInjury === true },
      );
      if (warnings.length) {
        openSheet({
          title: 'That is a bigger jump than planned',
          subtitle: warnings.map((w) => w.message).join(' '),
          actions: [
            { label: 'Log it anyway', variant: 'danger', onSelect: () => commit(viaFinish, { confirmed: true }) },
            { label: 'Check the distance', variant: 'ghost' },
          ],
        });
        return;
      }
    }
    stopTracker();
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
// Completed / read-only view
// ---------------------------------------------------------------------------

function renderCompleted(screen, session, teardownCompleted = []) {
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
    const route = session.run.routeId ? store.getRoute(session.run.routeId) : null;
    if (session.run.track?.length > 1 || route) {
      const card = trackMapCard({ track: session.run.track ?? [], route });
      teardownCompleted.push(() => card.destroy());
      append(screen, [
        el('div.card', null,
          el('div.eyebrow', { text: route ? `Route · ${route.name}` : 'Route' }),
          card.node,
          route && session.run.plannedKm
            ? el('p.xs.dim', { style: { marginTop: '0.4rem' }, text: `Planned ${session.run.plannedKm.toFixed(2)} km · ran ${session.run.distanceKm} km` })
            : null,
        ),
      ]);
    }
    body.appendChild(
      el(
        'div.statgrid',
        null,
        el('div.stat', null, el('div.stat-value.num', { text: `${session.run.distanceKm}` }), el('div.stat-label', { text: 'km' })),
        el('div.stat', null, el('div.stat-value.num', { text: formatDuration(session.run.durationSec) }), el('div.stat-label', { text: 'time' })),
        el('div.stat', null, el('div.stat-value.num', { text: formatPace(p).replace(' /km', '') }), el('div.stat-label', { text: 'per km' })),
        session.run.effort
          ? el('div.stat', null, el('div.stat-value.num', { text: String(session.run.effort) }), el('div.stat-label', { text: 'CR10' }))
          : null,
        session.run.talkTest
          ? el('div.stat', null, el('div.stat-value', { text: session.run.talkTest === 'yes' ? '✓' : '✗' }), el('div.stat-label', { text: 'talk test' }))
          : null,
      ),
    );
  }

  // Does the record agree with itself? Read-only — it never blocks anything,
  // it makes a title/exercise mismatch visible instead of leaving it to memory.
  if (session.kind === 'lift') {
    const check = sessionIntegrity(session, getProgram(session.programRef?.version));
    if (!check.ok) {
      body.appendChild(
        el(
          'div.banner.banner--warn',
          { dataset: { integrity: 'mismatch' } },
          el('span.grow.small', { text: `Prescription mismatch: ${check.problems.join('; ')}.` }),
        ),
      );
    }
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
        el(
          'div.row-between',
          null,
          el('div.listitem-title', { text: ex.name + (entry.group === 'core' ? ' · core' : '') + (entry.swappedFrom ? ' · swapped in' : '') }),
          best.v && ex.metric === 'weight_reps' ? el('span.small.dim.num', { text: `e1RM ${Math.round(best.v)}kg` }) : null,
        ),
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
    const teardown = [];
    renderCompleted(screen, session, teardown);
    renderRest();
    return { unmount: () => teardown.forEach((fn) => fn()) };
  }

  unlockAudio();
  const releaseWake = keepAwake();
  // Hides the tab bar for the duration; see base.css. Both it and the action bar
  // live at bottom:0, and the tab bar would otherwise swallow taps on "Log set".
  document.body.dataset.session = 'active';
  // Teardown hooks let a screen release things the router cannot see — a GPS
  // watch and its wake lock would otherwise keep running after you navigate away
  // mid-run, draining the battery with nothing on screen to show for it.
  const teardown = [];
  const ctx = { onDone: () => navigate('/'), onTeardown: (fn) => teardown.push(fn) };

  // Lift and standalone core sessions share one logger: every entry carries
  // its own metric (weight × reps, reps, a hold, a loaded carry).
  const render = session.kind === 'run' ? mountRun(screen, session, ctx) : mountLift(screen, session, ctx);

  render();
  renderRest();

  return {
    unmount() {
      for (const fn of teardown) {
        try {
          fn();
        } catch (e) {
          console.error('teardown failed', e);
        }
      }
      releaseWake();
      delete document.body.dataset.session;
      store.flush().catch(() => {});
      renderRest();
    },
  };
}
