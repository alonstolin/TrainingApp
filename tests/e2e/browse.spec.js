import { test, expect } from '@playwright/test';

/** Browsing and editing past work — the read/repair paths, not the logging path. */

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

async function seed(page, count) {
  await page.evaluate(async (n) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const BASE = { 'incline-bench': 80, ohp: 52.5, 'weighted-pullup': 15, 'back-squat': 120 };

    for (let i = 0; i < n; i++) {
      const st = store.getState();
      const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
      const ctx = {
        weekInMeso: c.weekInMeso, runWeek: c.run.week, coreCompleted: c.core.completed,
        historyFor: makeHistoryLookup(st.sessions, st.index),
      };
      const r = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, ctx);
      const s = store.startSession(r, { mesocycle: c.mesocycle, bodyweightKg: 82 });
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
  }, count);
}

test('history lists sessions and opens one in read-only detail', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await seed(page, 4);

  await page.goto('./#/history');
  await expect(page.locator('.page-title')).toContainText('History');
  await expect(page.locator('.listitem').first()).toBeVisible();

  await page.locator('.listitem').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();
  // A completed session shows a DONE pill, not a Finish button.
  await expect(page.locator('.pill', { hasText: 'DONE' })).toBeVisible();
  // And it summarises what was actually lifted, with an e1RM readout.
  await expect(page.locator('.card').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('progress drills into a single exercise with its full history', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await seed(page, 8);

  await page.goto('./#/progress');
  await expect(page.locator('.page-title')).toContainText('Progress');

  // The per-exercise list at the bottom of the Lifts tab.
  const row = page.locator('.listitem', { hasText: 'Incline Barbell Bench Press' }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();

  await expect(page.locator('.page-title')).toContainText('Incline Barbell Bench Press');
  await expect(page.locator('.stat').first()).toBeVisible();
  await expect(page.locator('.listitem').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('a past session can be deleted and disappears from history', async ({ page }) => {
  await boot(page);
  await seed(page, 3);

  const before = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.length;
  });
  expect(before).toBe(3);

  await page.goto('./#/history');
  await page.locator('.listitem').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();

  await page.locator('button', { hasText: 'Delete this session' }).click();
  await page.locator('.sheet button', { hasText: /^Delete$/ }).click();

  await expect(page.locator('.page-title')).toContainText('History');
  const after = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.length;
  });
  expect(after).toBe(2);
});

test('a logged set can be corrected mid-session', async ({ page }) => {
  await boot(page);

  await page.locator('button.btn--xl').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();

  const plus = page.locator('.stepper button', { hasText: '+' }).first();
  for (let i = 0; i < 10; i++) await plus.click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await expect(page.locator('.setrow--done').first()).toBeVisible();

  // Tap the logged set → Edit → it returns to an editable state.
  await page.locator('.setrow--done').first().click();
  await page.locator('.sheet button', { hasText: 'Edit this set' }).click();

  await expect(page.locator('.setrow--done')).toHaveCount(0);
  await expect(page.locator('button', { hasText: /^Log set$/ })).toBeVisible();
});

test('settings reports storage state and offers a backup', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await seed(page, 2);

  await page.goto('./#/settings');
  await expect(page.locator('.page-title')).toContainText('Settings');
  await expect(page.locator('button', { hasText: 'Export backup' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'Restore from backup' })).toBeVisible();
  await expect(page.locator('.screen')).toContainText('2 sessions');
  await expect(page.locator('.screen')).toContainText('Eviction protection');

  // Bodyweight is editable and persists.
  const bwPlus = page.locator('.stepper button', { hasText: '+' }).first();
  await bwPlus.click();
  await page.waitForTimeout(400);
  const bw = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().meta.bodyweightKg;
  });
  expect(bw).not.toBeNull();

  expect(errors).toEqual([]);
});
