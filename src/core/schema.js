/**
 * Schema version, validation and migrations. DOM-free, pure.
 *
 * The export format is the only contract that has to survive forever — it is the
 * user's sole backup and the only path data has off the device. Validation is
 * deliberately permissive about unknown fields (forward compatibility) and strict
 * about the handful of fields the app cannot function without.
 */

export const SCHEMA_VERSION = 1;
export const BACKUP_FORMAT = 'trainingapp-backup';

export const DEFAULT_META = {
  schemaVersion: SCHEMA_VERSION,
  startDate: null,
  bodyweightKg: null,
  unit: 'kg',
  programId: 'strength-hypertrophy-10k',
  programVersion: 1,
  lastExportAt: null,
  sessionsSinceExport: 0,
  onboarded: false,
};

/** Migration chain: index N upgrades vN → vN+1. Append, never rewrite. */
const MIGRATIONS = [
  // (data) => { ...transform v1 into v2...; return data; },
];

export function migrate(data) {
  let v = data.schemaVersion ?? 1;
  let out = data;
  while (v < SCHEMA_VERSION) {
    const step = MIGRATIONS[v - 1];
    if (!step) break;
    out = step(out);
    v++;
  }
  out.schemaVersion = SCHEMA_VERSION;
  return out;
}

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Validate one session record. Returns an array of problem strings (empty = ok). */
export function validateSession(s, label = 'session') {
  const errs = [];
  if (!s || typeof s !== 'object') return [`${label}: not an object`];
  if (!isStr(s.id)) errs.push(`${label}: missing id`);
  if (!isDate(s.date)) errs.push(`${label}: bad date "${s.date}"`);
  if (!['lift', 'run', 'core'].includes(s.kind)) errs.push(`${label}: bad kind "${s.kind}"`);
  if (!['in_progress', 'completed', 'skipped'].includes(s.status)) {
    errs.push(`${label}: bad status "${s.status}"`);
  }
  if (s.entries != null && !Array.isArray(s.entries)) errs.push(`${label}: entries must be an array`);
  if (s.kind === 'run' && s.status === 'completed' && !s.run) {
    errs.push(`${label}: completed run has no run data`);
  }
  return errs;
}

/**
 * Validate a backup envelope before it is allowed anywhere near stored data.
 * @returns {{ok:boolean, errors:string[], warnings:string[], data?:object}}
 */
export function validateBackup(raw) {
  const errors = [];
  const warnings = [];

  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return { ok: false, errors: [`Not valid JSON: ${e.message}`], warnings };
    }
  }
  if (!data || typeof data !== 'object') {
    return { ok: false, errors: ['Backup is not an object'], warnings };
  }
  if (data.format !== BACKUP_FORMAT) {
    errors.push(`Wrong format tag: expected "${BACKUP_FORMAT}", got "${data.format ?? 'nothing'}"`);
  }
  if (!Array.isArray(data.sessions)) {
    errors.push('Backup has no sessions array');
  }
  if ((data.schemaVersion ?? 1) > SCHEMA_VERSION) {
    errors.push(
      `Backup is schema v${data.schemaVersion}, this app understands up to v${SCHEMA_VERSION}. Update the app first.`,
    );
  }
  if (errors.length) return { ok: false, errors, warnings };

  const clean = [];
  data.sessions.forEach((s, i) => {
    const e = validateSession(s, `session[${i}]`);
    if (e.length) warnings.push(...e);
    else clean.push(s);
  });

  if (clean.length === 0 && data.sessions.length > 0) {
    return { ok: false, errors: ['Every session in the backup failed validation'], warnings };
  }

  return {
    ok: true,
    errors,
    warnings,
    data: migrate({
      ...data,
      sessions: clean,
      meta: { ...DEFAULT_META, ...(data.meta ?? {}) },
    }),
  };
}

/** Build the export envelope. */
export function buildBackup(meta, sessions, appVersion) {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion ?? 'unknown',
    meta,
    sessions,
  };
}

/**
 * Merge imported sessions into existing ones. Union by id; on collision the
 * record with the newer `updatedAt` wins, so importing an older backup can never
 * clobber newer work.
 */
export function mergeSessions(existing, incoming) {
  const byId = new Map(existing.map((s) => [s.id, s]));
  let added = 0;
  let updated = 0;
  let ignored = 0;

  for (const s of incoming) {
    const cur = byId.get(s.id);
    if (!cur) {
      byId.set(s.id, s);
      added++;
    } else if ((s.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
      byId.set(s.id, s);
      updated++;
    } else {
      ignored++;
    }
  }

  const sessions = [...byId.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt ?? 0) - (b.startedAt ?? 0),
  );
  return { sessions, added, updated, ignored };
}
