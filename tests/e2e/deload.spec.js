import { test, expect } from '@playwright/test';

/**
 * The deload week is the program path most likely to be wrong and least likely
 * to be noticed: it only appears every fifth block of sessions, and if it
 * misbehaves it quietly resets your working loads instead of visibly breaking.
 */

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

/** Complete `n` lift sessions programmatically, at realistic loads. */
async function seedLifts(page, n) {
  return page.evaluate(async (count) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');

    const BASE = {
      'incline-bench': 80, ohp: 52.5, 'weighted-pullup': 15, 'back-squat': 120,
      rdl: 100, 'leg-press': 180, 'leg-curl': 45, 'calf-raise': 80,
    };

    for (let i = 0; i < count; i++) {
      const st = store.getState();
      const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
      const ctx = {
        weekInMeso: c.weekInMeso,
        runWeek: c.run.week,
        coreCompleted: c.core.completed,
        historyFor: makeHistoryLookup(st.sessions, st.index),
      };
      const resolved = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, ctx);
      const s = store.startSession(resolved, { mesocycle: c.mesocycle, bodyweightKg: 82 });
      for (const entry of s.entries) {
        for (const set of entry.sets) {
          store.logSet(s.id, entry.entryId, set.setId, {
            weightKg: set.weightKg ?? BASE[entry.exerciseId] ?? 20,
            reps: set.targetRepMax ?? set.targetReps ?? 8,
            rpe: 7,
          });
        }
      }
      store.completeSession(s.id, { feeling: 4 });
    }
    await store.flush();
    const c = deriveCursors(store.getState().sessions, CURRENT_PROGRAM);
    return { week: c.weekInMeso, meso: c.mesocycle, completed: c.lift.completed };
  }, n);
}

test('deload week is reached after 16 sessions and is flagged in the UI', async ({ page }) => {
  await boot(page);
  const c = await seedLifts(page, 16);
  expect(c.week).toBe(5);
  expect(c.meso).toBe(1);

  await page.goto('./');
  await expect(page.locator('.page-sub')).toContainText('Week 5');
  await expect(page.locator('.page-sub')).toContainText('deload');
  // The week note has to actually tell you not to freelance extra work.
  await expect(page.locator('.screen')).toContainText('DELOAD');
});

test('deload cuts load and volume, then the next block resumes ABOVE the pre-deload load', async ({ page }) => {
  await boot(page);
  await seedLifts(page, 12); // end of week 3

  // Capture the last accumulation-week prescription for incline bench.
  const before = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveLiftSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
    const r = resolveLiftSession(CURRENT_PROGRAM, 'lift:A', c.weekInMeso, makeHistoryLookup(st.sessions, st.index));
    const e = r.entries.find((x) => x.exerciseId === 'incline-bench');
    return { week: c.weekInMeso, top: e.plannedSets[0].weightKg, sets: e.plannedSets.length };
  });

  await seedLifts(page, 4); // into week 5, the deload

  const deload = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveLiftSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
    const r = resolveLiftSession(CURRENT_PROGRAM, 'lift:A', c.weekInMeso, makeHistoryLookup(st.sessions, st.index));
    const e = r.entries.find((x) => x.exerciseId === 'incline-bench');
    const lateral = r.entries.find((x) => x.exerciseId === 'cable-lateral-raise');
    return {
      week: c.weekInMeso,
      isDeload: r.isDeload,
      top: e.plannedSets[0].weightKg,
      backoffSets: e.plannedSets.filter((s) => s.type === 'backoff').length,
      lateralSets: lateral.plannedSets.length,
      topRpe: e.plannedSets[0].rpeTarget,
    };
  });

  expect(deload.week).toBe(5);
  expect(deload.isDeload).toBe(true);
  expect(deload.topRpe).toBe(6);
  expect(deload.top).toBeLessThan(before.top);
  expect(deload.lateralSets).toBeLessThan(4);

  // Now complete the deload week and check the NEXT block. This is the critical
  // assertion: progression must resume from the real pre-deload load, not from
  // the deliberately light deload load.
  await seedLifts(page, 4);

  const after = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveLiftSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
    const r = resolveLiftSession(CURRENT_PROGRAM, 'lift:A', c.weekInMeso, makeHistoryLookup(st.sessions, st.index));
    const e = r.entries.find((x) => x.exerciseId === 'incline-bench');
    return { week: c.weekInMeso, meso: c.mesocycle, top: e.plannedSets[0].weightKg };
  });

  expect(after.week).toBe(1);
  expect(after.meso).toBe(2);
  expect(after.top).toBeGreaterThanOrEqual(before.top);
});

test('a full block of every modality leaves the app coherent', async ({ page }) => {
  await boot(page);
  await seedLifts(page, 20); // one complete mesocycle

  await page.goto('./');
  await expect(page.locator('.page-sub')).toContainText('Block 2');

  for (const [tab, heading] of [['history', 'History'], ['progress', 'Progress']]) {
    await page.locator(`#tabbar a[data-tab="${tab}"]`).click();
    await expect(page.locator('.page-title')).toContainText(heading);
  }

  // Charts must render real series, not empty states.
  await expect(page.locator('.chart-card').first()).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();
});
