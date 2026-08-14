/** Settings — backup (the important one), profile, storage health, rescue hatches. */

import { el, onTap, append } from '../dom.js';
import { stepper } from '../stepper.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { toast } from '../toast.js';
import * as store from '../../data/store.js';
import * as db from '../../data/db.js';
import { exportBackup, importBackup, readFile, payloadText } from '../../data/backup.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
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
      onChange: (v) => store.setMeta({ bodyweightKg: v }),
    });
    blocks.appendChild(
      el(
        'div.stack',
        null,
        el('div.section-label', { text: 'Bodyweight' }),
        bw,
        el('p.xs.dim', { text: 'Used to compute weighted pull-up strength (bodyweight + added load). Without it that chart drifts whenever your weight does.' }),
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
            text: `Block ${c.mesocycle}, week ${c.weekInMeso} of ${CURRENT_PROGRAM.mesocycleWeeks} · ${c.lift.completed} lifts, ${c.run.longCompleted + c.run.easyCompleted} runs, ${c.core.completed} core logged`,
          }),
          el('div.small.muted', { style: { marginTop: '0.35rem' }, text: `Next up: ${c.lift.nextDayKey.replace('lift:', 'Day ')}` }),
        ),
        el('p.xs.dim', {
          text: 'Your place in the program follows the sessions you actually complete, not the calendar. Missing a week never triggers a deload you have not earned.',
        }),
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
