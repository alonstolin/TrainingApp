import { test, expect } from '@playwright/test';

/**
 * The deload week is the program path most likely to be wrong and least likely
 * to be noticed: it only appears every fourth block of sessions, and if it
 * misbehaves it quietly resets your working loads instead of visibly breaking.
 *
 * With no running logged the mesocycle runs on the lift-count clock: a
 * four-week block of probe, probe, test, deload (see mesoState).
 */

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

/** Complete `n` lift sessions programmatically, at realistic loads and honest RPEs. */
async function seedLifts(page, n) {
  return page.evaluate(async (count) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { makeHistoryLookup } = await import('./src/core/schedule.js');

    const BASE = {
      'incline-bench': 80, ohp: 52.5, 'weighted-pullup': 15, 'back-squat': 120,
      rdl: 100, 'split-squat': 20, 'calf-raise': 80, 'cable-crunch': 20, 'pallof-press': 15, 'suitcase-carry': 24,
    };

    for (let i = 0; i < count; i++) {
      const st = store.getState();
      const c = store.cursors();
      const ctx = {
        role: c.role,
        weekInMeso: c.weekInMeso,
        runWeek: c.run.week,
        coreCompleted: c.core.completed,
        historyFor: makeHistoryLookup(st.sessions, st.index),
        bodyweightKg: 82,
      };
      const resolved = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, ctx);
      const s = store.startSession(resolved, { mesocycle: c.mesocycle, bodyweightKg: 82 });
      for (const entry of s.entries) {
        for (const set of entry.sets) {
          const values = {};
          if (set.targetSeconds != null) values.seconds = set.targetSeconds;
          else values.reps = set.targetRepMax ?? set.targetReps ?? 8;
          if (set.weightKg !== undefined) values.weightKg = set.weightKg ?? BASE[entry.exerciseId] ?? 20;
          // Probes are rated honestly at their target; everything else easy.
          if (set.type === 'probe') values.rpe = set.rpeTarget;
          else if (set.type === 'backoff') values.rpe = 8;
          else if (values.reps != null && set.weightKg !== undefined) values.rpe = 7;
          store.logSet(s.id, entry.entryId, set.setId, values);
        }
      }
      store.completeSession(s.id, { feeling: 4 });
    }
    await store.flush();
    const c = store.cursors();
    return { week: c.weekInMeso, meso: c.mesocycle, role: c.role, completed: c.lift.completed, blockLength: c.blockLength };
  }, n);
}

const inclineNow = (page) =>
  page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveLiftSession } = await import('./src/core/prescribe.js');
    const { makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = store.cursors();
    const r = resolveLiftSession(CURRENT_PROGRAM, 'lift:A', {
      role: c.role, weekInMeso: c.weekInMeso, coreCompleted: c.core.completed,
      historyFor: makeHistoryLookup(st.sessions, st.index), bodyweightKg: 82,
    });
    const e = r.entries.find((x) => x.exerciseId === 'incline-bench');
    const lateral = r.entries.find((x) => x.exerciseId === 'cable-lateral-raise');
    return {
      week: c.weekInMeso, meso: c.mesocycle, role: c.role, isDeload: r.isDeload,
      probe: e.plannedSets[0].weightKg, probeRpe: e.plannedSets[0].rpeTarget,
      backoff: e.plannedSets[1].weightKg,
      backoffSets: e.plannedSets.filter((s) => s.type === 'backoff').length,
      reference: e.reference?.e1rm ?? null,
      lateralSets: lateral.plannedSets.length,
      lateralLoad: lateral.plannedSets[0].weightKg,
    };
  });

test('the deload week is reached after twelve sessions and is flagged in the UI', async ({ page }) => {
  await boot(page);
  const c = await seedLifts(page, 12);
  expect(c.week).toBe(4);
  expect(c.role).toBe('deload');
  expect(c.meso).toBe(1);

  await page.goto('./');
  await expect(page.locator('.page-sub')).toContainText('Week 4 of 4');
  await expect(page.locator('.page-sub')).toContainText('deload');
  // The week note has to actually tell you not to freelance extra work.
  await expect(page.locator('.screen')).toContainText('DELOAD');
});

test('the test week asks for an RPE-9 triple; the deload keeps 80% of reference, cuts sets, and the next block resumes above it', async ({ page }) => {
  await boot(page);
  await seedLifts(page, 8); // end of the second probe week

  const test1 = await inclineNow(page);
  expect(test1.role).toBe('test');
  expect(test1.probeRpe).toBe(9);
  expect(test1.reference).toBeGreaterThan(0);
  const referenceBefore = test1.reference;

  await seedLifts(page, 4); // through the test week, into the deload
  const deload = await inclineNow(page);
  expect(deload.role).toBe('deload');
  expect(deload.isDeload).toBe(true);
  expect(deload.probeRpe).toBe(6);
  expect(deload.backoffSets).toBe(2);
  // Main-lift back-offs stay at 80% of the reference — 72% would be a warm-up.
  // (The reference itself may have risen during the test week's back-offs.)
  expect(deload.backoff).toBe(Math.round((deload.reference * 0.8) / 2.5) * 2.5);
  expect(deload.backoff).toBeGreaterThanOrEqual(test1.backoff);
  // Accessories: half the sets, 90% of the load.
  expect(deload.lateralSets).toBeLessThan(3);
  expect(deload.lateralLoad).toBeLessThan(test1.lateralLoad);

  // Complete the deload; block 2 must resume from the test-week triple, never
  // from the deliberately light deload session.
  await seedLifts(page, 4);
  const after = await inclineNow(page);
  expect(after.week).toBe(1);
  expect(after.meso).toBe(2);
  expect(after.role).toBe('probe');
  expect(after.reference).toBeGreaterThanOrEqual(referenceBefore);
  expect(after.backoff).toBeGreaterThanOrEqual(test1.backoff);
});

test('a full block of every modality leaves the app coherent', async ({ page }) => {
  await boot(page);
  await seedLifts(page, 16); // one complete four-week block

  await page.goto('./');
  await expect(page.locator('.page-sub')).toContainText('Block 2');

  for (const [tab, heading] of [['history', 'History'], ['progress', 'Progress']]) {
    await page.locator(`#tabbar a[data-tab="${tab}"]`).click();
    await expect(page.locator('.page-title')).toContainText(heading);
  }

  // Charts must render real series, not empty states.
  await expect(page.locator('.chart-card').first()).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();

  // Core rode along on Lower and Push and was logged — the adherence card says so.
  await page.locator('.chip', { hasText: 'Core' }).click();
  await expect(page.locator('[data-core-adherence="ok"]')).toBeVisible();
});
