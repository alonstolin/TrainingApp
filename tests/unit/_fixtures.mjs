/** Shared test fixtures. */

import program from '../../src/program/program.v1.js';

let seq = 0;

export function mkSet(o = {}) {
  return {
    setId: `s${seq++}`,
    index: 0,
    type: 'work',
    weightKg: null,
    reps: null,
    seconds: null,
    rpe: null,
    done: true,
    ts: Date.now(),
    ...o,
  };
}

export function mkSession(o = {}) {
  const kind = o.kind ?? 'lift';
  return {
    id: o.id ?? `sess-${seq++}`,
    date: o.date ?? '2026-01-05',
    startedAt: o.startedAt ?? 1000 + seq,
    completedAt: null,
    updatedAt: o.updatedAt ?? 1000 + seq,
    status: o.status ?? 'completed',
    kind,
    dayKey: o.dayKey ?? (kind === 'lift' ? 'lift:B' : kind === 'run' ? 'run:easy' : 'core'),
    variant: o.variant ?? (kind === 'run' ? 'easy' : null),
    programRef: o.programRef ?? { programId: program.programId, version: 1 },
    prescriptionSnapshot: o.prescriptionSnapshot ?? null,
    bodyweightKg: o.bodyweightKg ?? 80,
    entries: o.entries ?? [],
    run: o.run ?? (kind === 'run' ? { distanceKm: 5, durationSec: 1800, effort: 4 } : null),
    notes: o.notes ?? '',
    feeling: o.feeling ?? null,
  };
}

export function mkEntry(exerciseId, sets) {
  return { entryId: `e-${seq++}`, exerciseId, order: 0, sets };
}

/** N completed lift sessions cycling through the programmed order. */
export function completedLifts(n, startDate = '2026-01-05') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(2026, 0, 5 + i * 2);
    out.push(
      mkSession({
        kind: 'lift',
        dayKey: program.liftCycle[i % program.liftCycle.length],
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        status: 'completed',
      }),
    );
  }
  return out;
}

export const emptyState = (meta = {}) => ({
  sessions: [],
  meta: { startDate: '2026-01-05', bodyweightKg: 80, ...meta },
});

export { program };
