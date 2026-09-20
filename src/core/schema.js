/**
 * Schema version, validation and migrations. DOM-free, pure.
 *
 * The export format is the only contract that has to survive forever — it is the
 * user's sole backup and the only path data has off the device. Validation is
 * deliberately permissive about unknown fields (forward compatibility) and strict
 * about the handful of fields the app cannot function without.
 */

import { validateRoute } from './routes.js';

export const SCHEMA_VERSION = 2;
export const BACKUP_FORMAT = 'trainingapp-backup';

export const DEFAULT_META = {
  /** exerciseId → weight increment, for gyms whose stacks are not 2.5kg. */
  increments: {},
  schemaVersion: SCHEMA_VERSION,
  startDate: null,
  bodyweightKg: null,
  /** [{ date, kg }] — every bodyweight entered, for the drift flag and the review. */
  bodyweightLog: [],
  unit: 'kg',
  programId: 'strength-hypertrophy-10k',
  programVersion: 3,
  lastExportAt: null,
  sessionsSinceExport: 0,
  onboarded: false,
  /** true | false | null (not yet asked). The one novice-runner injury predictor found in every cohort. */
  priorLowerLimbInjury: null,
  /** One-time v3 entry marker; see mesoState() in core/schedule.js. */
  v3StartedAt: null,
  /** [{ id, name }] and the one picked last, so the Today card can preselect it. */
  gyms: [],
  lastGymId: null,
  /** gymId → { exerciseId → substitute exerciseId } — "always at this gym". */
  substitutions: {},
};

/** Migration chain: index N upgrades vN → vN+1. Append, never rewrite. */
const MIGRATIONS = [
  // v1 → v2: routes, gyms, bodyweight log. Nothing about sessions changes.
  (data) => ({
    ...data,
    routes: Array.isArray(data.routes) ? data.routes : [],
    meta: {
      ...(data.meta ?? {}),
      gyms: data.meta?.gyms ?? [],
      bodyweightLog: data.meta?.bodyweightLog ?? [],
      substitutions: data.meta?.substitutions ?? {},
    },
  }),
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
  if (s.gymId != null && !isStr(s.gymId)) errs.push(`${label}: gymId must be a string`);
  if (s.run?.talkTest != null && !['yes', 'no'].includes(s.run.talkTest)) {
    errs.push(`${label}: run.talkTest must be "yes" or "no"`);
  }
  if (s.kind === 'run' && s.status === 'completed' && !s.run) {
    errs.push(`${label}: completed run has no run data`);
  }
  // A GPS track is optional, but a malformed one must not reach the renderer —
  // projectTrack would produce NaN coordinates and the SVG would vanish silently.
  if (s.run?.track != null) {
    if (!Array.isArray(s.run.track)) {
      errs.push(`${label}: run.track must be an array`);
    } else if (
      s.run.track.some((p) => !Number.isFinite(p?.lat) || !Number.isFinite(p?.lon))
    ) {
      errs.push(`${label}: run.track contains a point without usable coordinates`);
    }
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
  if (data.routes != null && !Array.isArray(data.routes)) {
    errors.push('Backup routes must be an array');
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
  const cleanRoutes = [];
  (data.routes ?? []).forEach((r, i) => {
    const e = validateRoute(r, `route[${i}]`);
    if (e.length) warnings.push(...e);
    else cleanRoutes.push(r);
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
      routes: cleanRoutes,
      meta: { ...DEFAULT_META, ...(data.meta ?? {}) },
    }),
  };
}

/** Build the export envelope. `routes` is optional for callers that predate it. */
export function buildBackup(meta, sessions, routesOrVersion, maybeVersion) {
  const routes = Array.isArray(routesOrVersion) ? routesOrVersion : [];
  const appVersion = Array.isArray(routesOrVersion) ? maybeVersion : routesOrVersion;
  return {
    format: BACKUP_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: appVersion ?? 'unknown',
    meta,
    sessions,
    routes,
  };
}

/**
 * Does a logged session still agree with itself?
 *
 * A session stores three things that must describe the same day: its dayKey,
 * the programRef it was started under, and the frozen prescription snapshot
 * whose name is the title the UI shows. The entries are copied from that
 * snapshot at start, so every exercise should be one the day (or its core
 * block) prescribes — unless it was deliberately swapped or added, which the
 * entry says. Read-only: it never blocks logging, it makes a mismatch visible.
 *
 * @param program the program VERSION the session ran under (getProgram(ref.version))
 * @returns {{ok:boolean, problems:string[]}}
 */
export function sessionIntegrity(session, program) {
  const problems = [];
  if (!session || session.kind !== 'lift') return { ok: true, problems };
  const snap = session.prescriptionSnapshot;
  const ref = session.programRef ?? {};
  if (!snap) return { ok: true, problems };

  if (snap.dayKey && session.dayKey && snap.dayKey !== session.dayKey) {
    problems.push(`snapshot is ${snap.dayKey} but the session is filed as ${session.dayKey}`);
  }
  if (ref.dayKey && session.dayKey && ref.dayKey !== session.dayKey) {
    problems.push(`program reference says ${ref.dayKey}, session says ${session.dayKey}`);
  }

  const letter = (snap.dayKey ?? session.dayKey ?? '').split(':')[1];
  const day = program?.liftDays?.[letter];
  if (day && ref.version === program.version && snap.name && snap.name !== day.name) {
    problems.push(`titled "${snap.name}" but ${snap.dayKey} is "${day.name}" in program v${program.version}`);
  }

  if (day) {
    const allowed = new Set(day.blocks.map((b) => b.exerciseId));
    for (const phase of program.core?.phases ?? []) for (const b of phase.blocks) allowed.add(b.exerciseId);
    // Against the version the session ran under the day's block list is the
    // truth. Against any other version it can only be lenient — the snapshot
    // itself is the best record of what that day contained.
    const strict = ref.version === program.version;
    const snapIds = new Set((snap.entries ?? []).map((e) => e.exerciseId));
    for (const e of session.entries ?? []) {
      if (e.swappedFrom || e.added) continue;
      const snapEntry = (snap.entries ?? []).find((x) => x.exerciseId === e.exerciseId);
      if (snapEntry?.swappedFrom || snapEntry?.added) continue;
      if (!allowed.has(e.exerciseId) && (strict || !snapIds.has(e.exerciseId))) {
        problems.push(`${e.exerciseId} is not part of ${snap.dayKey ?? session.dayKey}`);
      }
    }
  }
  return { ok: problems.length === 0, problems };
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
