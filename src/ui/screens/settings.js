/** Settings — backup (the important one), profile, storage health, rescue hatches. */

import { el, onTap, append } from '../dom.js';
import { stepper, textSheet } from '../stepper.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { toast } from '../toast.js';
import * as store from '../../data/store.js';
import * as db from '../../data/db.js';
import { exportBackup, importBackup, readFile, payloadText } from '../../data/backup.js';
import { CURRENT_PROGRAM, getExercise } from '../../program/index.js';
import { APP_VERSION } from '../../version.js';
import { trainingDate, formatRelativeDate } from '../../core/dates.js';
import { navigate } from '../../router.js';

const fmtBytes = (n) => (n == null ? '—' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

function showManualExport(text) {
  const box = el('textarea', { rows: 10, readonly: true, style: { fontFamily: 'var(--mono)', fontSize: '11px' } });
  box.value = text;
  openSheet({
    title: 'Copy your backup',
    subtitle: 'Select all and copy this somewhere safe — Notes, email to yourself, anywhere off this phone.',
    content: box,
    actions: [{ label: 'Done', variant: 'ghost' }],
  });
  setTimeout(() => {
    box.focus();
    box.select();
  }, 100);
}

function importFlow(onDone) {
  const fileInput = el('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  const pasteBox = el('textarea', { rows: 6, placeholder: '…or paste backup JSON here' });

  const run = async (raw, mode) => {
    const result = await importBackup(raw, mode);
    if (!result.ok) {
      openSheet({ title: 'Import failed', subtitle: result.errors.join('\n'), actions: [{ label: 'OK', variant: 'ghost' }] });
      return;
    }
    const bits = [`${result.stats.added} added`];
    if (result.stats.updated) bits.push(`${result.stats.updated} updated`);
    if (result.stats.ignored) bits.push(`${result.stats.ignored} already current`);
    toast(`Imported · ${bits.join(', ')}`, { kind: 'good', duration: 6000 });
    onDone?.();
  };

  const askMode = (raw) =>
    openSheet({
      title: 'How should this import?',
      subtitle: 'Your current data is snapshotted first either way, so a bad import can be undone.',
      actions: [
        { label: 'Merge — keep both, newest wins', onSelect: () => run(raw, 'merge') },
        { label: 'Replace everything', variant: 'danger', onSelect: () => run(raw, 'replace') },
        { label: 'Cancel', variant: 'ghost' },
      ],
    });

  fileInput.addEventListener('change', async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    try {
      askMode(await readFile(f));
    } catch (e) {
      toast(`Could not read that file: ${e.message}`, { kind: 'bad' });
    }
  });

  openSheet({
    title: 'Restore a backup',
    content: el(
      'div.stack',
      null,
      onTap(el('button.btn.btn--block', { type: 'button', text: 'Choose a file' }), () => fileInput.click()),
      fileInput,
      pasteBox,
      onTap(el('button.btn.btn--ghost.btn--block', { type: 'button', text: 'Use pasted text' }), () => {
        if (!pasteBox.value.trim()) {
          toast('Nothing pasted');
          return;
        }
        askMode(pasteBox.value);
      }),
    ),
  });
}

export default function mountSettings(root) {
  const screen = el('div.screen');
  root.appendChild(screen);

  let storageInfo = null;
  db.storageEstimate().then((s) => {
    storageInfo = s;
    render();
  });

  const render = () => {
    const state = store.getState();
    const { meta, sessions } = state;
    screen.textContent = '';

    append(screen, [el('header.page-head', null, el('h1.page-title', { text: 'Settings' }))]);

    const blocks = el('div.stack-lg');
    screen.appendChild(blocks);

    // ---- BACKUP (first, because it is the one that matters)
    const lastExport = meta.lastExportAt ? formatRelativeDate(trainingDate(new Date(meta.lastExportAt))) : 'never';
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { style: { marginTop: 0 }, text: 'Backup' }),
        el(
          'div.card',
          null,
          el('p.small', {
            text: 'Your training data lives only on this phone. Deleting the home screen icon deletes all of it, silently and unrecoverably. There is no server copy.',
          }),
          el('p.small.muted', { style: { marginTop: '0.5rem' }, text: `${sessions.length} sessions · last backed up ${lastExport}` }),
        ),
        onTap(el('button.btn.btn--primary.btn--block', { type: 'button', text: 'Export backup' }), async () => {
          const r = await exportBackup();
          if (r.method === 'manual') showManualExport(r.text);
          else if (r.error === 'cancelled') toast('Export cancelled');
          else toast('Backup exported', { kind: 'good' });
          render();
        }),
        onTap(el('button.btn.btn--ghost.btn--block', { type: 'button', text: 'Restore from backup' }), () => importFlow(render)),
        onTap(el('button.btn.btn--ghost.btn--block.btn--sm', { type: 'button', text: 'Show backup as text' }), () => showManualExport(payloadText())),
      ),
    );

    // ---- PROFILE
    const bw = stepper({
      value: meta.bodyweightKg,
      step: 0.5,
      min: 30,
      max: 250,
      label: 'kg',
      onChange: (v) => (v == null ? store.setMeta({ bodyweightKg: null }) : store.logBodyweight(v)),
    });
    const bwLog = meta.bodyweightLog ?? [];
    const drift =
      bwLog.length >= 2
        ? Math.round((bwLog[bwLog.length - 1].kg - bwLog[0].kg) * 10) / 10
        : null;
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Bodyweight' }),
        bw,
        el('p.xs.dim', {
          text:
            'Used for weighted pull-up strength (bodyweight + added load) and every percentage of its block reference. Weigh in weekly — a downward drift over 0.5 kg in two weeks during the running build is a nutrition signal, not a training one.',
        }),
        bwLog.length
          ? el('p.xs.dim.num', { text: `${bwLog.length} readings since ${formatRelativeDate(bwLog[0].date)}${drift != null ? ` · ${drift > 0 ? '+' : ''}${drift} kg overall` : ''}` })
          : null,
      ),
    );

    // ---- GYMS
    const gyms = meta.gyms ?? [];
    const gymList = el('div.listgroup');
    for (const g of gyms) {
      const subs = Object.entries(meta.substitutions?.[g.id] ?? {});
      gymList.appendChild(
        onTap(
          el(
            'button.listitem',
            { type: 'button' },
            el('span.listitem-mark.listitem-mark--lift'),
            el(
              'span.grow',
              null,
              el('div.listitem-title', { text: g.name }),
              el('div.listitem-sub.truncate', {
                text: `${sessions.filter((x) => x.gymId === g.id && x.status === 'completed').length} sessions${
                  subs.length ? ` · ${subs.length} standing swap${subs.length === 1 ? '' : 's'}` : ''
                }`,
              }),
            ),
            meta.lastGymId === g.id ? el('span.pill', { text: 'CURRENT' }) : null,
          ),
          () =>
            openSheet({
              title: g.name,
              actions: [
                {
                  label: 'Rename',
                  onSelect: () =>
                    textSheet({ title: 'Rename gym', value: g.name, onSubmit: (v) => store.renameGym(g.id, v) }),
                },
                ...subs.map(([from, to]) => ({
                  label: `Stop swapping ${getExercise(from).short} → ${getExercise(to).short}`,
                  variant: 'ghost',
                  onSelect: () => store.setSubstitution(g.id, from, null),
                })),
                {
                  label: 'Remove gym',
                  variant: 'danger',
                  onSelect: () =>
                    confirmSheet({
                      title: `Remove ${g.name}?`,
                      subtitle: 'Sessions logged there keep their history; only the label and its standing swaps go.',
                      confirmLabel: 'Remove',
                      onConfirm: () => store.removeGym(g.id),
                    }),
                },
                { label: 'Cancel', variant: 'ghost' },
              ],
            }),
        ),
      );
    }
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Gyms' }),
        gyms.length ? gymList : null,
        el('p.xs.dim', {
          text: 'Cable stacks, machines and Smith bars are not the same weight from one gym to the next, so their history is kept per gym — and per station within a gym. Barbells and dumbbells are shared. With two or more gyms, the Today card asks which one you are at.',
        }),
        onTap(el('button.btn.btn--ghost.btn--block.btn--sm', { type: 'button', text: '+ Add a gym' }), () =>
          textSheet({ title: 'Gym name', placeholder: 'e.g. Downtown', onSubmit: (v) => store.addGym(v) }),
        ),
      ),
    );

    // ---- RUNNING RISK
    const injury = meta.priorLowerLimbInjury;
    const injuryChips = el('div.chips');
    for (const [v, label] of [[true, 'Yes'], [false, 'No']]) {
      const b = el('button.chip', { type: 'button', text: label, 'aria-pressed': String(injury === v) });
      onTap(b, () => store.setMeta({ priorLowerLimbInjury: v }));
      injuryChips.appendChild(b);
    }
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Previous lower-limb running injury' }),
        injuryChips,
        el('p.xs.dim', {
          text: 'Shin, knee, Achilles or calf, foot. The one predictor found in every novice-runner cohort (HR ≈ 2–3). "Yes" makes the distance warnings read as stops.',
        }),
      ),
    );

    // ---- PROGRAM
    const c = store.cursors();
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Program' }),
        el(
          'div.card',
          null,
          el('div.listitem-title', { text: CURRENT_PROGRAM.name }),
          el('div.small.muted', {
            style: { marginTop: '0.35rem' },
            text: `Block ${c.mesocycle}, week ${c.weekInMeso} of ${c.blockLength ?? CURRENT_PROGRAM.mesocycleWeeks} (${c.role}) · ${c.lift.completed} lifts, ${c.run.longCompleted + c.run.easyCompleted} runs, ${c.core.completed} core logged`,
          }),
          el('div.small.muted', { style: { marginTop: '0.35rem' }, text: `Next up: ${c.lift.nextDayKey.replace('lift:', 'Day ')}` }),
        ),
        el('p.xs.dim', {
          text:
            c.mesoSource === 'run'
              ? 'During the 10K build the lifting week follows the running week, so lifting deloads land on the running down-weeks. If running stops for two weeks the lift count takes over.'
              : 'Your place in the program follows the sessions you actually complete, not the calendar. Missing a week never triggers a deload you have not earned.',
        }),
        meta.v3StartedAt
          ? el('p.xs.dim', { text: `Program v${CURRENT_PROGRAM.version} since ${formatRelativeDate(meta.v3StartedAt.date)}${meta.v3StartedAt.deloadFirst ? ' · entered through a deload week' : ''}.` })
          : null,
        meta.startDate
          ? null
          : onTap(el('button.btn.btn--ghost.btn--block.btn--sm', { type: 'button', text: 'Set today as the program start' }), () => {
              store.setMeta({ startDate: trainingDate() });
              toast('Start date set');
            }),
      ),
    );

    // ---- STORAGE
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Storage' }),
        el(
          'div.card',
          null,
          el(
            'div.row-between.small',
            null,
            el('span.muted', { text: 'Eviction protection' }),
            el(`span.pill.${state.storage.persisted ? 'pill--good' : 'pill--warn'}`, {
              text: state.storage.persisted ? 'PROTECTED' : 'NOT GRANTED',
            }),
          ),
          el('div.row-between.small', { style: { marginTop: '0.5rem' } }, el('span.muted', { text: 'Used' }), el('span.num', { text: fmtBytes(storageInfo?.usage) })),
          el('div.row-between.small', { style: { marginTop: '0.35rem' } }, el('span.muted', { text: 'Available' }), el('span.num', { text: fmtBytes(storageInfo?.quota) })),
          state.storage.persisted
            ? null
            : el('p.xs.dim', { style: { marginTop: '0.6rem' }, text: 'Safari grants this on its own once the app is installed to the home screen and used regularly. Export regularly regardless.' }),
        ),
      ),
    );

    // ---- MAINTENANCE
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Maintenance' }),
        onTap(
          el('button.btn.btn--block', { type: 'button', text: 'Check for updates' }),
          async (ev) => {
            const btn = ev.currentTarget;
            btn.textContent = 'Checking…';
            btn.setAttribute('disabled', 'true');
            try {
              const result = await window.__checkForUpdate?.();
              if (result === 'updating') toast('Update found — reloading…', { kind: 'good' });
              else if (result === 'downloading') toast('Downloading an update…');
              else if (result === 'current') toast(`You're on the latest (${APP_VERSION})`, { kind: 'good' });
              else toast('Updates are unavailable in this browser');
            } catch {
              toast('Could not reach the server — try again on a connection');
            }
            btn.textContent = 'Check for updates';
            btn.removeAttribute('disabled');
          },
        ),
        onTap(el('button.btn.btn--ghost.btn--block', { type: 'button', text: 'Force update' }), () =>
          confirmSheet({
            title: 'Force update?',
            subtitle: 'Clears the cached app files and reloads from the network. Your logged training data is NOT touched — it lives in the database, not the cache.',
            confirmLabel: 'Clear cache and reload',
            variant: 'primary',
            onConfirm: async () => {
              try {
                const regs = await navigator.serviceWorker?.getRegistrations?.();
                for (const r of regs ?? []) await r.unregister();
                const keys = await caches.keys();
                for (const k of keys) await caches.delete(k);
              } catch (e) {
                console.error(e);
              }
              window.location.reload();
            },
          }),
        ),
        onTap(el('button.btn.btn--danger.btn--block', { type: 'button', text: 'Erase all training data' }), () =>
          confirmSheet({
            title: 'Erase everything?',
            subtitle: `All ${sessions.length} sessions will be permanently deleted. Export a backup first if you are not certain.`,
            confirmLabel: 'Erase everything',
            onConfirm: async () => {
              await db.wipeAll();
              window.location.reload();
            },
          }),
        ),
      ),
    );

    blocks.appendChild(
      el('p.xs.dim.center', { style: { marginTop: '1rem' }, text: `Training · ${APP_VERSION}` }),
    );
    void navigate;
  };

  render();
  return { unmount: store.subscribe(render) };
}
