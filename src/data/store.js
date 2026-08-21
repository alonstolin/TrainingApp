/**
 * Application state.
 *
 * Every session lives in memory (a few hundred records, ~2MB after years) and
 * derived indexes are maintained incrementally. Consequence: every read the UI
 * performs is a SYNCHRONOUS array or Map lookup. No screen ever awaits anything
 * to render, which is what lets the "last time you did this" row appear the
 * instant you tap into an exercise.
 *
 * Writes go the other way: a set is persisted the moment it is logged (iOS kills
 * backgrounded web apps constantly), coalesced through a short debounce so
 * hammering the stepper does not thrash IndexedDB.
 */

import * as db from './db.js';
import { newId } from '../core/ids.js';
import { trainingDate } from '../core/dates.js';
import { DEFAULT_META, SCHEMA_VERSION } from '../core/schema.js';
import { CURRENT_PROGRAM } from '../program/index.js';
import { deriveCursors } from '../core/schedule.js';
import { backoffLoad } from '../core/progression.js';
import { getExercise, setIncrementOverrides } from '../program/exercises.js';

const PERSIST_DEBOUNCE_MS = 250;

const state = {
  ready: false,
  meta: { ...DEFAULT_META },
  sessions: [],
  /** exerciseId → [{date, sessionId, sets, bodyweightKg}], newest first */
  index: new Map(),
  storage: { persisted: false, supported: false },
};

const listeners = new Set();
const dirty = new Set();
let persistTimer = null;
let metaDirty = false;

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) {
    try {
      fn(state);
    } catch (e) {
      console.error('store listener failed', e);
    }
  }
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

/** Newest-first by date, then by start time within a day. */
const byRecency = (a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : (b.startedAt ?? 0) - (a.startedAt ?? 0);

function rebuildIndex() {
  const idx = new Map();
  const done = state.sessions.filter((s) => s.status === 'completed').sort(byRecency);
  for (const s of done) {
    for (const entry of s.entries ?? []) {
      if (!entry.sets?.some((x) => x.done)) continue;
      if (!idx.has(entry.exerciseId)) idx.set(entry.exerciseId, []);
      idx.get(entry.exerciseId).push({
        date: s.date,
        sessionId: s.id,
        sets: entry.sets,
        bodyweightKg: s.bodyweightKg,
        startedAt: s.startedAt,
        // Both drive progression filtering; see makeHistoryLookup in core/schedule.js.
        // dayKey keeps heavy and volume exposures of the same lift from reading
        // each other's sets; isDeload keeps deloads from becoming the new baseline.
        dayKey: s.dayKey,
        isDeload: !!s.programRef?.isDeload,
      });
    }
  }
  state.index = idx;
}

/** What did I do last time on this exercise? O(1). */
export function lastTime(exerciseId) {
  return state.index.get(exerciseId)?.[0] ?? null;
}

export function historyFor(exerciseId, n = 10) {
  return (state.index.get(exerciseId) ?? []).slice(0, n);
}

export const cursors = () => deriveCursors(state.sessions, CURRENT_PROGRAM);

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(flush, PERSIST_DEBOUNCE_MS);
}

/**
 * Serialises all writes. `flush()` returns this chain, so awaiting it awaits
 * everything already queued — not just the caller's own batch.
 *
 * Without the chain, flush() collected the dirty set and returned a promise for
 * only that batch. A flush triggered while an earlier one was still writing
 * would find an empty dirty set and resolve instantly, so `await flush()` in the
 * pagehide handler could return while a just-logged set was still in flight —
 * and iOS tears the page down immediately after pagehide.
 */
let writeChain = Promise.resolve();

async function doPersist() {
  const ids = [...dirty];
  dirty.clear();
  const wasMetaDirty = metaDirty;
  metaDirty = false;
  if (!ids.length && !wasMetaDirty) return;

  try {
    if (ids.length) {
      const records = ids
        .map((id) => state.sessions.find((s) => s.id === id))
        .filter(Boolean);
      if (records.length) await db.putMany(db.STORES.sessions, records);
      const removed = ids.filter((id) => !state.sessions.some((s) => s.id === id));
      for (const id of removed) await db.del(db.STORES.sessions, id);
    }
    if (wasMetaDirty) {
      await db.put(db.STORES.meta, { key: 'meta', value: state.meta });
    }
  } catch (e) {
    // Re-mark dirty so a later write retries rather than silently losing data.
    for (const id of ids) dirty.add(id);
    if (wasMetaDirty) metaDirty = true;
    console.error('persist failed', e);
  }
}

export function flush() {
  clearTimeout(persistTimer);
  persistTimer = null;
  // Chained on both settle paths so one failed write cannot wedge the queue.
  writeChain = writeChain.then(doPersist, doPersist);
  return writeChain;
}

function touch(id) {
  dirty.add(id);
  schedulePersist();
}

export function setMeta(patch) {
  state.meta = { ...state.meta, ...patch };
  // Increments feed the pure prescription layer through a module registry, so a
  // change here has to be pushed across or the next session is resolved with the
  // old step size.
  if ('increments' in patch) setIncrementOverrides(state.meta.increments);
  metaDirty = true;
  schedulePersist();
  notify();
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function init() {
  try {
    const [sessions, metaRows] = await Promise.all([
      db.getAll(db.STORES.sessions),
      db.getAll(db.STORES.meta),
    ]);
    state.sessions = sessions.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt ?? 0) - (b.startedAt ?? 0),
    );
    const stored = metaRows.find((r) => r.key === 'meta')?.value;
    state.meta = { ...DEFAULT_META, ...(stored ?? {}) };
    state.meta.schemaVersion = SCHEMA_VERSION;
  } catch (e) {
    console.error('store init failed — running with empty state', e);
    state.sessions = [];
    state.meta = { ...DEFAULT_META };
  }

  // Custom increments are configuration for the pure prescription layer, so they
  // have to be installed before anything resolves a session.
  setIncrementOverrides(state.meta.increments);

  // First launch IS day one. Without this the drift calculation has no anchor
  // and the Today screen can never tell you that you are behind.
  if (!state.meta.startDate) {
    state.meta.startDate = trainingDate();
    metaDirty = true;
    schedulePersist();
  }

  rebuildIndex();
  state.ready = true;
  state.storage = await db.requestPersistence();
  notify();
  return state;
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a session from a resolved prescription and store the prescription
 * snapshot on it. That snapshot is why program.v1.js can be edited freely
 * forever without rewriting what past sessions said to do.
 */
export function startSession(resolved, opts = {}) {
  const now = Date.now();
  const date = opts.date ?? trainingDate();

  const session = {
    id: newId(resolved.kind),
    date,
    startedAt: now,
    completedAt: null,
    updatedAt: now,
    status: 'in_progress',
    kind: resolved.kind,
    dayKey: resolved.dayKey,
    variant: resolved.variant ?? null,
    programRef: {
      programId: CURRENT_PROGRAM.programId,
      version: CURRENT_PROGRAM.version,
      dayKey: resolved.dayKey,
      mesocycle: opts.mesocycle ?? null,
      week: resolved.weekInMeso ?? null,
      isDeload: !!resolved.isDeload,
      runWeek: resolved.runWeek ?? null,
      corePhase: resolved.phase ?? null,
    },
    prescriptionSnapshot: resolved,
    bodyweightKg: opts.bodyweightKg ?? state.meta.bodyweightKg ?? null,
    entries: (resolved.entries ?? []).map((e, i) => ({
      entryId: `e${i}`,
      exerciseId: e.exerciseId,
      order: e.order ?? i,
      sets: (e.plannedSets ?? []).map((p, j) => ({
        setId: `s${j}`,
        index: j,
        type: p.type ?? 'work',
        weightKg: p.weightKg ?? null,
        reps: null,
        seconds: null,
        rpe: null,
        targetReps: p.targetReps ?? null,
        targetSeconds: p.targetSeconds ?? null,
        rpeTarget: p.rpeTarget ?? null,
        derivedFromTop: p.derivedFromTop ?? false,
        pctOfTop: p.pctOfTop ?? null,
        done: false,
        ts: null,
      })),
    })),
    run:
      resolved.kind === 'run'
        ? { distanceKm: null, durationSec: null, effort: null, notes: '' }
        : null,
    notes: '',
    feeling: null,
  };

  state.sessions.push(session);
  touch(session.id);
  notify();
  // Persist the envelope straight away so a session killed before its first set
  // is still resumable rather than vanishing.
  flush().catch((e) => console.error('session create persist failed', e));
  return session;
}

export const getSession = (id) => state.sessions.find((s) => s.id === id) ?? null;

export const activeSession = () =>
  state.sessions.find((s) => s.status === 'in_progress') ?? null;

/**
 * Apply a mutation to a session, persist it, and notify.
 *
 * `immediate` bypasses the write debounce. Logging a set uses it: the debounce
 * exists to coalesce rapid stepper fiddling, but a committed set is the one piece
 * of work that must never be lost, and iOS can kill a backgrounded web app inside
 * a 250ms window without warning.
 */
export function updateSession(id, fn, { immediate = false } = {}) {
  const s = getSession(id);
  if (!s) return null;
  fn(s);
  s.updatedAt = Date.now();
  touch(id);
  if (s.status === 'completed') rebuildIndex();
  notify();
  if (immediate) flush().catch((e) => console.error('immediate persist failed', e));
  return s;
}

/**
 * Log (or re-log) one set.
 *
 * When the TOP set of a main lift is logged, every back-off set that has not yet
 * been performed is recalculated from the load actually hit — not the load that
 * was planned. Back-offs should reflect the day you are having.
 */
export function logSet(sessionId, entryId, setId, values) {
  return updateSession(
    sessionId,
    (s) => {
      const entry = s.entries.find((e) => e.entryId === entryId);
      if (!entry) return;
      const set = entry.sets.find((x) => x.setId === setId);
      if (!set) return;

      Object.assign(set, values, { done: true, ts: Date.now() });

      if (set.type === 'top' && set.weightKg != null) {
        const ex = getExercise(entry.exerciseId);
        for (const other of entry.sets) {
          if (other.derivedFromTop && !other.done) {
            other.weightKg = backoffLoad(set.weightKg, other.pctOfTop ?? 0.85, ex);
          }
        }
      }
    },
    { immediate: true },
  );
}

export function unlogSet(sessionId, entryId, setId) {
  return updateSession(
    sessionId,
    (s) => {
      const set = s.entries.find((e) => e.entryId === entryId)?.sets.find((x) => x.setId === setId);
      if (set) Object.assign(set, { done: false, reps: null, seconds: null, rpe: null, ts: null });
    },
    { immediate: true },
  );
}

/** Add an extra set to an entry, copying the last one as the starting point. */
export function addSet(sessionId, entryId) {
  return updateSession(sessionId, (s) => {
    const entry = s.entries.find((e) => e.entryId === entryId);
    if (!entry) return;
    const prev = entry.sets[entry.sets.length - 1];
    entry.sets.push({
      ...prev,
      setId: `s${entry.sets.length}-${Date.now().toString(36)}`,
      index: entry.sets.length,
      type: prev?.type === 'top' ? 'work' : (prev?.type ?? 'work'),
      reps: null,
      seconds: null,
      rpe: null,
      done: false,
      ts: null,
    });
  });
}

export function removeSet(sessionId, entryId, setId) {
  return updateSession(sessionId, (s) => {
    const entry = s.entries.find((e) => e.entryId === entryId);
    if (entry && entry.sets.length > 1) {
      entry.sets = entry.sets.filter((x) => x.setId !== setId);
    }
  });
}

export function completeSession(id, patch = {}) {
  return updateSession(
    id,
    (s) => {
      Object.assign(s, patch);
      s.status = 'completed';
      s.completedAt = Date.now();
      // Sets left untouched are dropped rather than recorded as zeros — an unlogged
      // set is a set you did not do, not a set of nothing.
      for (const entry of s.entries ?? []) {
        entry.sets = entry.sets.filter((x) => x.done);
      }
      state.meta.sessionsSinceExport = (state.meta.sessionsSinceExport ?? 0) + 1;
      metaDirty = true;
    },
    { immediate: true },
  );
}

/** Record a session as deliberately missed. Advances the cursor; stays in history. */
export function skipSession(resolved, opts = {}) {
  const s = startSession(resolved, opts);
  return updateSession(
    s.id,
    (x) => {
      x.status = 'skipped';
      x.completedAt = Date.now();
      x.entries = [];
      x.notes = opts.reason ?? '';
    },
    { immediate: true },
  );
}

export function abandonSession(id) {
  const i = state.sessions.findIndex((s) => s.id === id);
  if (i === -1) return;
  state.sessions.splice(i, 1);
  touch(id);
  rebuildIndex();
  notify();
}

export function deleteSession(id) {
  abandonSession(id);
}

// ---------------------------------------------------------------------------
// Bulk operations (import)
// ---------------------------------------------------------------------------

export async function replaceAllData(meta, sessions) {
  state.meta = { ...DEFAULT_META, ...meta, schemaVersion: SCHEMA_VERSION };
  state.sessions = [...sessions].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt ?? 0) - (b.startedAt ?? 0),
  );
  await db.replaceAll(db.STORES.sessions, state.sessions);
  await db.put(db.STORES.meta, { key: 'meta', value: state.meta });
  rebuildIndex();
  notify();
}

/** Snapshot current data before a destructive import. Keeps the last 3. */
export async function snapshotBackup(payload, label) {
  const rec = { id: newId('bk'), createdAt: Date.now(), label, payload };
  await db.put(db.STORES.backups, rec);
  const all = await db.getAll(db.STORES.backups);
  const stale = all.sort((a, b) => b.createdAt - a.createdAt).slice(3);
  for (const s of stale) await db.del(db.STORES.backups, s.id);
  return rec;
}

export const listBackups = () =>
  db.getAll(db.STORES.backups).then((r) => r.sort((a, b) => b.createdAt - a.createdAt));
