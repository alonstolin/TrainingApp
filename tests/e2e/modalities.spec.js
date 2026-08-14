import { test, expect } from '@playwright/test';

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

/** Start a specific session via the "Something else" sheet. */
async function startVia(page, name) {
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();

  await page.locator('.sheet .listitem', { hasText: name }).first().click();
  await expect(page.locator('.screen--session')).toBeVisible();
}

test('logs a run with a live-computed pace', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startVia(page, 'Easy Run');

  // Distance and time are prefilled from the plan; nudge them and check pace.
  const steppers = page.locator('.stepper');
  await expect(steppers).toHaveCount(3); // distance, minutes, seconds

  const plusDistance = steppers.nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 5; i++) await plusDistance.click();

  const plusMinutes = steppers.nth(1).locator('button', { hasText: '+' });
  for (let i = 0; i < 3; i++) await plusMinutes.click();

  // Pace must be computed and displayed, not left blank.
  await expect(page.locator('.stat-value')).toContainText('/km');

  await page.locator('.chip', { hasText: /^4$/ }).first().click(); // effort
  await page.locator('button', { hasText: 'Log run' }).click();

  await expect(page.locator('.page-title')).toBeVisible();

  const logged = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const runs = store.getState().sessions.filter((s) => s.kind === 'run' && s.status === 'completed');
    return runs.map((r) => ({ km: r.run.distanceKm, sec: r.run.durationSec, effort: r.run.effort }));
  });

  expect(logged.length).toBe(1);
  expect(logged[0].km).toBeGreaterThan(0);
  expect(logged[0].sec).toBeGreaterThan(0);
  expect(logged[0].effort).toBe(4);
  expect(errors).toEqual([]);
});

test('a run refuses to log without both distance and time', async ({ page }) => {
  await boot(page);
  await startVia(page, 'Easy Run');

  // Zero the distance out.
  const minus = page.locator('.stepper').nth(0).locator('button', { hasText: '−' });
  for (let i = 0; i < 60; i++) await minus.click();

  await page.locator('button', { hasText: 'Log run' }).click();
  await expect(page.locator('.toast')).toContainText('Distance and time');
  await expect(page.locator('.screen--session')).toBeVisible();
});

test('logs core work, handling both timed holds and rep-based sets', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startVia(page, 'Core');

  // Phase 1 opens with Dead Bug (reps). Log every set of it.
  await expect(page.locator('.exnav button').first()).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.locator('button', { hasText: /^Log set$/ }).click();
    await page.waitForTimeout(150);
  }

  // Jump to a timed exercise and run the hold timer.
  await page.locator('.exnav button', { hasText: 'Front Plank' }).click();
  await expect(page.locator('.bigtimer')).toBeVisible();

  await page.locator('button', { hasText: 'Start hold' }).click();
  await page.waitForTimeout(1200);
  await page.locator('button', { hasText: 'Stop' }).click();
  await page.locator('button', { hasText: 'Log hold' }).click();

  const logged = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const s = store.getState().sessions.find((x) => x.kind === 'core');
    return (s.entries ?? []).map((e) => ({
      id: e.exerciseId,
      done: e.sets.filter((x) => x.done).map((x) => ({ reps: x.reps, seconds: x.seconds })),
    }));
  });

  const deadbug = logged.find((e) => e.id === 'dead-bug');
  const plank = logged.find((e) => e.id === 'front-plank');

  expect(deadbug.done.length).toBe(3);
  expect(deadbug.done[0].reps).toBeGreaterThan(0);
  expect(plank.done.length).toBe(1);
  expect(plank.done[0].seconds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('back-off loads recalculate from the top set actually hit', async ({ page }) => {
  await boot(page);
  await startVia(page, 'Upper Push'); // incline bench, top set + back-offs

  // Set an explicit top-set load, then log it.
  await page.evaluate(() => {
    const s = window.__store?.activeSession?.();
    void s;
  });

  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 32; i++) await plus.click(); // 32 x 2.5kg = 80kg

  await page.locator('button', { hasText: /^Log set$/ }).click();
  await page.waitForTimeout(300);

  const result = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const s = store.activeSession();
    const entry = s.entries[0];
    const top = entry.sets.find((x) => x.type === 'top');
    const backoffs = entry.sets.filter((x) => x.type === 'backoff');
    return { top: top.weightKg, backoffs: backoffs.map((b) => b.weightKg) };
  });

  expect(result.top).toBe(80);
  // 85% of 80 = 68, snapped to the 2.5kg grid.
  for (const b of result.backoffs) expect(b).toBe(67.5);
});
