/**
 * Export / import.
 *
 * There is no server. The export IS the backup, and deleting the home-screen
 * icon deletes everything with no warning and no recovery. So export has to be
 * effortless enough that it actually happens, and it has to have fallbacks —
 * iOS handles downloads inconsistently inside standalone web apps.
 *
 * Three tiers, in order of preference:
 *   1. Web Share with a file  → the iOS share sheet → Files / iCloud / AirDrop.
 *      This is the only tier that gets data OFF the device, so it goes first.
 *   2. <a download> + blob URL → works in Safari tabs, patchy when standalone.
 *   3. Raw JSON in a textarea  → ugly, always works. The genuine escape hatch.
 */

import * as store from './store.js';
import { buildBackup, validateBackup, mergeSessions } from '../core/schema.js';
import { APP_VERSION } from '../version.js';

const filename = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `training-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json`;
};

export function buildPayload() {
  const { meta, sessions } = store.getState();
  return buildBackup(meta, sessions, APP_VERSION);
}

export function payloadText() {
  return JSON.stringify(buildPayload(), null, 2);
}

function markExported() {
  store.setMeta({ lastExportAt: Date.now(), sessionsSinceExport: 0 });
}

/**
 * @returns {Promise<{method:string, ok:boolean, text?:string, error?:string}>}
 * `method: 'manual'` means the caller must show the text for copy/paste.
 */
export async function exportBackup() {
  const text = payloadText();
  const name = filename();

  // Tier 1 — share sheet.
  try {
    if (navigator.canShare && navigator.share) {
      const file = new File([text], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Training backup' });
        markExported();
        return { method: 'share', ok: true };
      }
    }
  } catch (e) {
    // AbortError means the user dismissed the sheet — that is a deliberate
    // cancellation, not a failure, and must not fall through to another tier.
    if (e?.name === 'AbortError') return { method: 'share', ok: false, error: 'cancelled' };
  }

  // Tier 2 — download link.
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    markExported();
    return { method: 'download', ok: true };
  } catch (e) {
    void e;
  }

  // Tier 3 — show the raw text.
  markExported();
  return { method: 'manual', ok: true, text };
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Could not read file'));
    r.readAsText(file);
  });
}

/**
 * Import a backup.
 * @param {string|object} raw
 * @param {'merge'|'replace'} mode
 *
 * Always snapshots current data first, so a bad import is recoverable.
 */
export async function importBackup(raw, mode = 'merge') {
  const result = validateBackup(raw);
  if (!result.ok) {
    return { ok: false, errors: result.errors, warnings: result.warnings };
  }

  const incoming = result.data;
  const current = store.getState();

  await store.snapshotBackup(buildPayload(), `before ${mode} import`);

  let sessions;
  let stats;
  if (mode === 'replace') {
    sessions = incoming.sessions;
    stats = { added: sessions.length, updated: 0, ignored: 0 };
  } else {
    const merged = mergeSessions(current.sessions, incoming.sessions);
    sessions = merged.sessions;
    stats = { added: merged.added, updated: merged.updated, ignored: merged.ignored };
  }

  const meta =
    mode === 'replace'
      ? incoming.meta
      : {
          ...current.meta,
          startDate: current.meta.startDate ?? incoming.meta.startDate,
          bodyweightKg: current.meta.bodyweightKg ?? incoming.meta.bodyweightKg,
          onboarded: current.meta.onboarded || incoming.meta.onboarded,
        };

  await store.replaceAllData(meta, sessions);

  return { ok: true, mode, stats, warnings: result.warnings, total: sessions.length };
}

/** Restore one of the automatic pre-import snapshots. */
export async function restoreSnapshot(backupId) {
  const all = await store.listBackups();
  const rec = all.find((b) => b.id === backupId);
  if (!rec) return { ok: false, errors: ['Snapshot not found'] };
  return importBackup(rec.payload, 'replace');
}

/**
 * Should we nudge for a backup? After 14 days or 10 logged sessions, whichever
 * comes first.
 */
export function backupNudge(meta) {
  const days = meta.lastExportAt
    ? (Date.now() - meta.lastExportAt) / 86400000
    : Infinity;
  const count = meta.sessionsSinceExport ?? 0;
  if (meta.lastExportAt == null && count < 3) return null;
  if (days >= 14) {
    return meta.lastExportAt
      ? `It has been ${Math.floor(days)} days since your last backup.`
      : 'You have never backed up. Deleting the app would lose everything.';
  }
  if (count >= 10) return `${count} sessions logged since your last backup.`;
  return null;
}
