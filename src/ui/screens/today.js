/** Today — the home screen. What to do right now, and one big button to start it. */

import { el, onTap, append, fmtSets } from '../dom.js';
import { openSheet } from '../sheet.js';
import { stepper } from '../stepper.js';
import { toast } from '../toast.js';
import { unlockAudio } from '../timer.js';
import * as store from '../../data/store.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
import { MUSCLE_LABELS } from '../../program/exercises.js';
import { resolveToday, alternatives, overlapWarning } from '../../core/schedule.js';
import { runLoadWarnings } from '../../core/progression.js';
import { getExercise } from '../../program/exercises.js';
import { backupNudge } from '../../data/backup.js';
import { trainingDate, formatRelativeDate, dayName } from '../../core/dates.js';
import { navigate } from '../../router.js';

const TRACK_LABEL = { lift: 'Lift', run: 'Run', core: 'Core' };
const ROLE_LABEL = { probe: 'probe week', test: 'test week', deload: 'deload' };

function begin(resolved, extra = {}) {
  unlockAudio(); // must happen inside a user gesture or the rest-timer beep stays muted
  const { meta } = store.getState();
  const c = store.cursors();
  const session = store.startSession(resolved, {
    mesocycle: c.mesocycle,
    bodyweightKg: meta.bodyweightKg,
    gymId: meta.lastGymId ?? null,
    ...extra,
  });
  navigate(`/session/${session.id}`);
}

/**
 * Start a session. On days with a bodyweight-plus lift the bodyweight is asked
 * for first: weighted pull-up strength and every percentage of its reference
 * are computed on bodyweight + load, so a stale number silently shifts the
 * prescription (SYNTHESIS §1.5).
 */
function startAndGo(resolved, extra = {}) {
  const needsBw =
    resolved.kind === 'lift' &&
    (resolved.entries ?? []).some((e) => getExercise(e.exerciseId).loadModel === 'bodyweight_plus');
  if (!needsBw) {
    begin(resolved, extra);
    return;
  }
  const { meta } = store.getState();
  let kg = meta.bodyweightKg ?? null;
  const control = stepper({
    value: kg,
    step: 0.5,
    min: 30,
    max: 250,
    label: 'kg',
    // The keypad is itself a sheet, and sheets do not nest — it would replace
    // this one. Half-kilo steps from the last reading are enough here.
    allowKeypad: false,
    onChange: (v) => {
      kg = v;
    },
  });
  openSheet({
    title: 'Bodyweight today?',
    subtitle: 'Pull-up strength is bodyweight plus the belt. Weigh in if you can; otherwise keep the last number.',
    content: control,
    actions: [
      {
        label: 'Use this weight',
        onSelect: () => {
          if (kg != null) store.logBodyweight(kg);
          begin(resolved, { ...extra, bodyweightKg: kg ?? meta.bodyweightKg ?? null });
        },
      },
      { label: 'Keep last', variant: 'ghost', onSelect: () => begin(resolved, extra) },
    ],
  });
}

function skipCard(card, onDone) {
  openSheet({
    title: `Skip ${card.session.name}?`,
    subtitle:
      'It gets recorded as missed and stays visible in your history. The next session moves up — nothing is silently lost.',
    actions: [
      {
        label: 'Mark as skipped',
        variant: 'danger',
        onSelect: () => {
          const c = store.cursors();
          store.skipSession(card.session, { mesocycle: c.mesocycle });
          toast('Marked as skipped');
          onDone();
        },
      },
      { label: 'Cancel', variant: 'ghost' },
    ],
  });
}

/**
 * Start a specific lift day now. Routes through `alternatives` rather than
 * touching the cursor, so nothing is skipped or consumed — swapping the order
 * of two sessions must not cost you one.
 */
function startSpecificDay(state, dayKey, onDone) {
  const alt = alternatives(state, CURRENT_PROGRAM).find((a) => a.session.dayKey === dayKey);
  if (!alt) return false;
  onDone();
  startAndGo(alt.session);
  return true;
}

function chooseOther(state, onDone) {
  const alts = alternatives(state, CURRENT_PROGRAM);

  // Forward-declared: the row handlers are built before openSheet returns its
  // close function, and they MUST close it. The sheet host lives outside #app,
  // so a sheet left open survives navigation and its backdrop then silently
  // swallows every tap on the screen underneath.
  let close = () => {};

  const content = el(
    'div.listgroup',
    null,
    ...alts.map((a) =>
      onTap(
        el(
          'button.listitem',
          { type: 'button' },
          el(`span.listitem-mark.listitem-mark--${a.track}`),
          el(
            'span.grow',
            null,
            el('div.listitem-title', { text: a.session.name }),
            el('div.listitem-sub.truncate', { text: a.subtitle ?? '' }),
          ),
          a.isNext
            ? el('span.pill', { text: 'NEXT' })
            : a.unavailable
              ? el('span.pill.pill--warn', { text: 'NOT THIS WEEK' })
              : a.optional
                ? el('span.pill', { text: 'BONUS' })
                : null,
        ),
        () => {
          if (a.unavailable) {
            toast('The bonus day is for probe weeks only — it would push this week past the volume band.');
            return;
          }
          close();
          onDone();
          startAndGo(a.session);
        },
      ),
    ),
  );

  close = openSheet({
    title: 'Train something else',
    subtitle: 'Anything here can be done today. Your place in the program follows what you actually do.',
    content,
  });
}

function sessionCard(card, { hero = false } = {}) {
  const s = card.session;

  const kicker = el(
    'div.hero-kicker',
    null,
    el('span.eyebrow', { text: TRACK_LABEL[card.track] ?? '' }),
    s.isDeload ? el('span.pill.pill--deload', { text: 'DELOAD' }) : null,
    s.entries?.some((e) => e.tier === 'T1') ? el('span.pill.pill--t1', { text: 'HEAVY' }) : null,
    s.isGoal ? el('span.pill.pill--good', { text: 'GOAL' }) : null,
    s.isDown ? el('span.pill.pill--warn', { text: 'DOWN WEEK' }) : null,
    card.offSchedule
      ? el('span.pill.pill--warn', { text: `WAS ${dayName(trainingDate()).toUpperCase()}'S` })
      : null,
  );

  const body = el(
    hero ? 'div.hero' : 'div.card',
    null,
    kicker,
    el('div.hero-title', { text: s.name }),
    s.focus ? el('div.hero-focus', { text: s.focus }) : null,
    s.kind === 'run' ? el('div.hero-focus', { text: `Target: ${s.label}` }) : null,
    s.kind === 'lift'
      ? el(
          'ul.stack',
          { style: { marginTop: '0.9rem', gap: '0.25rem' } },
          ...s.entries
            .filter((e) => e.group !== 'core')
            .slice(0, 8)
            .map((e) =>
              el(
                'li.row-between.small',
                null,
                el('span.truncate.grow', { text: e.name }),
                el('span.dim.num', { text: e.label.replace(/ @ RPE.*| · last set.*| · race week.*/, '') }),
              ),
            ),
          // Core rides at the end of this day; one line, not five.
          s.entries.some((e) => e.group === 'core')
            ? el(
                'li.row-between.small',
                null,
                el('span.truncate.grow.muted', { text: `+ Core — phase ${s.corePhase ?? ''}`.trim() }),
                el('span.dim.num', { text: `${s.entries.filter((e) => e.group === 'core').length} moves` }),
              )
            : null,
        )
      : null,
    s.kind === 'core'
      ? el(
          'ul.stack',
          { style: { marginTop: '0.9rem', gap: '0.25rem' } },
          ...s.entries.map((e) =>
            el('li.row-between.small', null, el('span.truncate.grow', { text: e.name }), el('span.dim.num', { text: e.label })),
          ),
        )
      : null,
  );

  return body;
}

export default function mountToday(root) {
  const screen = el('div.screen');
  root.appendChild(screen);

  const rerender = () => {
    const state = store.getState();
    const today = resolveToday(state, CURRENT_PROGRAM);
    screen.textContent = '';

    // ---- header
    append(screen, [
      el(
        'header.page-head',
        null,
        el('div.eyebrow', { text: `${dayName(today.date)} · ${formatRelativeDate(today.date)}` }),
        el('h1.page-title', { text: today.resume ? 'Session in progress' : today.isRestDay ? 'Rest day' : 'Today' }),
        el('div.page-sub', {
          text:
            today.mesoSource === 'entry-deload'
              ? `Entry deload · one week, then the first probe week · Run week ${Math.min(today.runWeek, CURRENT_PROGRAM.runPlan.length)}`
              : `Block ${today.mesocycle} · Week ${today.weekInMeso} of ${today.blockLength ?? CURRENT_PROGRAM.mesocycleWeeks}${
                  today.role ? ` · ${ROLE_LABEL[today.role] ?? today.role}` : today.isDeload ? ' · deload' : ''
                } · Run week ${Math.min(today.runWeek, CURRENT_PROGRAM.runPlan.length)}`,
        }),
      ),
    ]);

    // ---- mesocycle strip
    const strip = el('div.mesostrip', { style: { marginBottom: '1.25rem' } });
    const blockLength = today.blockLength ?? CURRENT_PROGRAM.mesocycleWeeks;
    for (let w = 1; w <= blockLength; w++) {
      const stateAttr =
        w === today.weekInMeso ? (today.isDeload ? 'deload' : 'current') : w < today.weekInMeso ? 'done' : 'todo';
      strip.appendChild(el('span', { dataset: { state: stateAttr, role: w === blockLength ? 'deload' : w === blockLength - 1 ? 'test' : 'probe' } }));
    }
    screen.appendChild(strip);

    if (today.weekNote) {
      screen.appendChild(
        el('p.small.muted', { text: today.weekNote, style: { marginBottom: '1.25rem' } }),
      );
    }

    const blocks = el('div.stack-lg');
    screen.appendChild(blocks);

    // ---- first-run: bodyweight is required for honest weighted pull-up numbers
    if (state.meta.bodyweightKg == null) {
      blocks.appendChild(
        el(
          'div.banner.banner--info',
          null,
          el('span.grow.small', {
            text: 'Set your bodyweight once — weighted pull-up strength is bodyweight plus added load, so without it that number drifts as you do.',
          }),
          onTap(el('button.btn.btn--sm', { type: 'button', text: 'Set' }), () => navigate('/settings')),
        ),
      );
    }

    // ---- one-time: previous lower-limb injury (SYNTHESIS §3.4)
    if (state.meta.priorLowerLimbInjury == null) {
      const ask = () =>
        openSheet({
          title: 'One question about your running',
          subtitle:
            'Have you had a lower-limb running injury before — shin, knee, Achilles or calf, foot? A previous injury is the one predictor found in every novice-runner study, and it makes the distance rules stricter.',
          actions: [
            { label: 'Yes, I have', onSelect: () => store.setMeta({ priorLowerLimbInjury: true }) },
            { label: 'No', onSelect: () => store.setMeta({ priorLowerLimbInjury: false }) },
            { label: 'Later', variant: 'ghost' },
          ],
        });
      blocks.appendChild(
        el(
          'div.banner.banner--info',
          null,
          el('span.grow.small', { text: 'One question about previous running injuries sets how cautious the distance rules are.' }),
          onTap(el('button.btn.btn--sm', { type: 'button', text: 'Answer' }), ask),
        ),
      );
    }

    // ---- backup nudge
    const nudge = backupNudge(state.meta);
    if (nudge) {
      blocks.appendChild(
        el(
          'div.banner.banner--warn',
          null,
          el('span.grow.small', { text: nudge }),
          onTap(el('button.btn.btn--sm', { type: 'button', text: 'Back up' }), () => navigate('/settings')),
        ),
      );
    }

    // ---- resume
    if (today.resume) {
      const r = today.resume;
      const logged = (r.entries ?? []).reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
      blocks.appendChild(
        el(
          'div.stack',
          null,
          el(
            'div.card.card--accent',
            null,
            el('div.eyebrow', { text: 'Unfinished' }),
            el('div.hero-title', { text: r.prescriptionSnapshot?.name ?? r.kind }),
            el('div.small.muted', {
              text: `${formatRelativeDate(r.date)} · ${logged} set${logged === 1 ? '' : 's'} logged`,
            }),
          ),
          onTap(
            el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: 'Resume session' }),
            () => navigate(`/session/${r.id}`),
          ),
          onTap(
            el('button.btn.btn--ghost.btn--block', { type: 'button', text: 'Discard it' }),
            () =>
              openSheet({
                title: 'Discard this session?',
                subtitle: `${logged} logged set${logged === 1 ? '' : 's'} will be deleted. This cannot be undone.`,
                actions: [
                  {
                    label: 'Discard',
                    variant: 'danger',
                    onSelect: () => {
                      store.abandonSession(r.id);
                      toast('Session discarded');
                    },
                  },
                  { label: 'Keep it', variant: 'ghost' },
                ],
              }),
          ),
        ),
      );
    }

    // ---- catch-up prompt
    if (!today.resume && today.needsCatchUp) {
      blocks.appendChild(
        el(
          'div.banner.banner--info',
          null,
          el('span.grow.small', {
            text: `You're ${today.drift.lift} lift${today.drift.lift === 1 ? '' : 's'} and ${
              today.drift.run
            } run${today.drift.run === 1 ? '' : 's'} behind schedule. Carry on in order, or skip ahead from Settings — either is fine.`,
          }),
        ),
      );
    }

    // ---- primary session
    if (!today.resume && today.primary) {
      const card = today.primary;
      const group = el('div.stack', null, sessionCard(card, { hero: true }));

      // Muscle-overlap guard. The template spaces overlapping days apart, but the
      // schedule follows what you actually do — fall behind and a 48h gap can
      // compress to 24h without anything looking wrong.
      if (card.track === 'lift') {
        const clash = overlapWarning(state.sessions, CURRENT_PROGRAM, card.session.dayKey);
        if (clash) {
          // Cap the list: naming six muscles reads as noise, and the point lands
          // with two or three.
          const names = clash.muscles.map((m) => (MUSCLE_LABELS[m] ?? m).toLowerCase());
          const shown = names.slice(0, 3);
          const list =
            names.length > 3
              ? `${shown.join(', ')} and more`
              : shown.length > 1
                ? `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
                : shown[0];
          // "yesterday" has to be true. A session finished this morning is not
          // yesterday, and saying so undermines every other number in the app.
          const when = clash.since.date === trainingDate() ? 'earlier today' : 'yesterday';
          const swapTo = clash.suggestion ? CURRENT_PROGRAM.liftDays[clash.suggestion.split(':')[1]] : null;

          const warnBlock = el('div.stack', { style: { gap: '0.5rem' } });
          const banner = el(
            'div.banner.banner--warn',
            null,
            el('span.grow.small', {
              text: `You trained ${list} ${when} on ${
                clash.since.prescriptionSnapshot?.name ?? 'your last session'
              }. ${card.session.name} leans on the same muscles, so today's heavy work will be worth less.`,
            }),
          );
          warnBlock.appendChild(banner);

          if (swapTo) {
            warnBlock.appendChild(
              el(
                'div.btn-row',
                null,
                onTap(
                  el('button.btn.btn--sm', { type: 'button', text: `Do ${swapTo.name} instead` }),
                  () => {
                    if (!startSpecificDay(state, clash.suggestion, rerender)) {
                      toast('Could not switch — pick one from “Something else”.');
                    }
                  },
                ),
              ),
            );
          }
          // Above the card, not below it: a six-exercise card can push a warning
          // off-screen entirely, and this one is meant to change what you do next.
          group.insertBefore(warnBlock, group.firstChild);
        }
      }

      // Race week: legs light, or none inside 48 h of the 10K (SYNTHESIS §4.4).
      if (card.track === 'lift' && today.raceWeek && card.session.dayKey === 'lift:B') {
        group.insertBefore(
          el(
            'div.banner.banner--warn',
            null,
            el('span.grow.small', {
              text: today.raceWeek.recommendSkip
                ? `The 10K is in about ${today.raceWeek.hoursToLongRun}h. Legs are prescribed light — skipping them is the better call this close. Upper-body work is unchanged.`
                : 'Race week: leg work is halved and kept easy so nothing lingers into the 10K. Pull-ups and curls are unchanged.',
            }),
          ),
          group.firstChild,
        );
      }

      // Running-load rails on the planned distance — single-run spike and
      // weekly jump (SYNTHESIS §3.1).
      if (card.track === 'run' && card.session.target.km) {
        for (const w of runLoadWarnings(state.sessions, { km: card.session.target.km, date: today.date }, {
          today: today.date,
          priorInjury: state.meta.priorLowerLimbInjury === true,
        })) {
          group.appendChild(el('div.banner.banner--warn', null, el('span.small', { text: w.message })));
        }
      }

      group.appendChild(
        onTap(
          el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: `Start ${card.session.name}` }),
          () => startAndGo(card.session),
        ),
      );
      group.appendChild(
        el(
          'div.btn-row',
          null,
          onTap(el('button.btn.btn--ghost', { type: 'button', text: 'Something else' }), () =>
            chooseOther(state, rerender),
          ),
          onTap(el('button.btn.btn--ghost', { type: 'button', text: 'Skip' }), () => skipCard(card, rerender)),
        ),
      );
      blocks.appendChild(group);
    }

    // ---- also today
    if (!today.resume && today.also.length) {
      const group = el('div.stack', null, el('div.section-label', { text: 'Also today' }));
      for (const card of today.also) {
        group.appendChild(
          onTap(el('button', { type: 'button', style: { display: 'block', width: '100%', textAlign: 'left' } }, sessionCard(card)), () =>
            startAndGo(card.session),
          ),
        );
      }
      blocks.appendChild(group);
    }

    // ---- rest day
    if (!today.resume && today.isRestDay) {
      const done = today.completedToday.length;
      blocks.appendChild(
        el(
          'div.stack',
          null,
          el(
            'div.card',
            null,
            el('div.hero-title', { text: done ? 'Done for today' : today.restByDefault ? 'Rest day — by design' : 'Nothing scheduled' }),
            el('p.small.muted', {
              style: { marginTop: '0.5rem' },
              text: done
                ? 'Session logged. Recovery is where the adaptation actually happens.'
                : today.restByDefault
                  ? (today.role === 'test'
                      ? 'Test week: the optional run and bonus day are off by default so the RPE-9 triples are honest. Bone needs a rest day too.'
                      : 'The long run is 8 km or more now, so the optional run is off by default. Take it only if the legs feel fresh.')
                  : 'Rest is programmed, not a gap. Train anyway if you want to — it will slot in correctly.',
            }),
          ),
          onTap(el('button.btn.btn--block', { type: 'button', text: 'Train something anyway' }), () =>
            chooseOther(state, rerender),
          ),
        ),
      );
    }

    // ---- optional extras
    if (!today.resume && today.optional.length) {
      const group = el('div.stack', null, el('div.section-label', { text: 'Optional' }));
      for (const card of today.optional) {
        group.appendChild(
          onTap(
            el(
              'button.listitem',
              { type: 'button', style: { border: '1px solid var(--line)', borderRadius: 'var(--r-md)', background: 'var(--surface)' } },
              el(`span.listitem-mark.listitem-mark--${card.track}`),
              el(
                'span.grow',
                null,
                el('div.listitem-title', { text: card.session.name }),
                el('div.listitem-sub.truncate', {
                  text: card.session.focus ?? card.session.label ?? '',
                }),
              ),
            ),
            () => startAndGo(card.session),
          ),
        );
      }
      blocks.appendChild(group);
    }

    // ---- what you did today
    if (today.completedToday.length) {
      const group = el('div.stack', null, el('div.section-label', { text: 'Logged today' }));
      const list = el('div.listgroup');
      for (const s of today.completedToday) {
        const summary =
          s.kind === 'run'
            ? `${s.run?.distanceKm ?? '?'}km`
            : s.status === 'skipped'
              ? 'Skipped'
              : fmtSets((s.entries ?? []).flatMap((e) => e.sets), { max: 3 });
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
                el('div.listitem-sub.truncate', { text: summary }),
              ),
            ),
            () => navigate(`/session/${s.id}`),
          ),
        );
      }
      group.appendChild(list);
      blocks.appendChild(group);
    }
  };

  rerender();
  const unsub = store.subscribe(rerender);
  return { unmount: unsub };
}
