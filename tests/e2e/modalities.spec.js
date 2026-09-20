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
  const use = page.locator('.sheet button', { hasText: 'Use this weight' });
  if (await use.isVisible().catch(() => false)) await use.click();
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

test('logs core work, handling loaded reps and timed holds in one logger', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await startVia(page, /Core — Phase/);

  // Phase 1 opens with the cable crunch (weight × reps). Log both sets.
  await expect(page.locator('.exnav button').first()).toBeVisible();
  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 8; i++) await plus.click(); // 20 kg
  for (let i = 0; i < 2; i++) {
    await page.locator('button', { hasText: /^Log set$/ }).click();
    await page.waitForTimeout(150);
  }

  // Jump to the timed balance hold and run the hold timer.
  await page.locator('.exnav button', { hasText: 'SL Balance' }).click();
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
      done: e.sets.filter((x) => x.done).map((x) => ({ reps: x.reps, seconds: x.seconds, weightKg: x.weightKg })),
    }));
  });

  const crunch = logged.find((e) => e.id === 'cable-crunch');
  const balance = logged.find((e) => e.id === 'single-leg-balance');

  expect(crunch.done.length).toBe(2);
  expect(crunch.done[0].reps).toBeGreaterThan(0);
  expect(crunch.done[0].weightKg).toBe(20);
  expect(balance.done.length).toBe(1);
  expect(balance.done[0].seconds).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('core rides at the end of Lower, behind a divider, and counts as a core session once logged', async ({ page }) => {
  await boot(page);
  await startVia(page, 'Lower + Pull Volume');
  await expect(page.locator('.exnav-divider')).toHaveText(/core/i);
  await expect(page.locator('.exnav button[data-group="core"]')).toHaveCount(5);

  await page.locator('.exnav button', { hasText: 'Cable Crunch' }).click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await page.waitForTimeout(200);

  await page.locator('button', { hasText: /^Finish$/ }).click();
  await page.locator('.sheet button', { hasText: /^Finish$/ }).click();

  const core = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.cursors().core.completed;
  });
  expect(core).toBe(1);
});

test('the probe sets the block reference and fills the back-offs at 80% of it', async ({ page }) => {
  await boot(page);
  await startVia(page, 'Upper Push'); // incline bench: probe, then back-offs

  await expect(page.locator('.setrow-sub').first()).toContainText('PROBE');

  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 32; i++) await plus.click(); // 32 x 2.5kg = 80kg
  // Reps are prefilled at 4; rate it RPE 8 → e1RM 80 × (1 + 6/30) = 96.
  await page.locator('.chips').last().locator('.chip', { hasText: /^8$/ }).click();

  await page.locator('button', { hasText: /^Log set$/ }).click();
  await page.waitForTimeout(300);

  const result = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const s = store.activeSession();
    const entry = s.entries[0];
    const probe = entry.sets.find((x) => x.type === 'probe');
    const backoffs = entry.sets.filter((x) => x.type === 'backoff');
    return {
      probe: probe.weightKg,
      rpe: probe.rpe,
      backoffs: backoffs.map((b) => b.weightKg),
      reference: s.prescriptionSnapshot.entries[0].reference?.e1rm,
    };
  });

  expect(result.probe).toBe(80);
  expect(result.rpe).toBe(8);
  expect(result.reference).toBe(96);
  // 80% of 96 = 76.8, snapped to the 2.5kg grid.
  expect(result.backoffs).toEqual([77.5, 77.5, 77.5]);
  await expect(page.locator('text=Block reference e1RM 96')).toBeVisible();
});
