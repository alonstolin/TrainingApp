import { test, expect } from '@playwright/test';

/**
 * Program v3 — the pieces pulled forward from the deferred list because the
 * program's own rules depend on them (SYNTHESIS Part 8), plus the integrity
 * check that makes a title/exercise mismatch visible instead of remembered.
 */

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

const startVia = async (page, name) => {
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await page.locator('.sheet .listitem', { hasText: name }).first().click();
};

/** Log `n` completed runs directly, dated back from today. */
const seedRuns = (page, runs) =>
  page.evaluate(async (list) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { trainingDate, addDays } = await import('./src/core/dates.js');
    for (const r of list) {
      const resolved = resolveSession(CURRENT_PROGRAM, `run:${r.variant}`, { runWeek: 5 });
      const s = store.startSession(resolved, { mesocycle: 1, date: addDays(trainingDate(), -r.daysAgo), bodyweightKg: 82 });
      store.updateSession(s.id, (x) => {
        x.run = { distanceKm: r.km, durationSec: r.km * 400, effort: 3, talkTest: 'yes', notes: '' };
      });
      store.completeSession(s.id, {});
    }
    await store.flush();
  }, runs);

test('a pull-up day asks for bodyweight first and the answer is logged with the session', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    store.setMeta({ bodyweightKg: 83 });
  });
  await startVia(page, 'Lower + Pull Volume');
  await expect(page.locator('.sheet-title')).toHaveText('Bodyweight today?');

  // Half a kilo up from the last reading, then confirm.
  await page.locator('.sheet .stepper button', { hasText: '+' }).click();
  await page.locator('.sheet button', { hasText: 'Use this weight' }).click();
  await expect(page.locator('.screen--session')).toBeVisible();

  const got = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const st = store.getState();
    return { session: store.activeSession().bodyweightKg, meta: st.meta.bodyweightKg, log: st.meta.bodyweightLog };
  });
  expect(got.session).toBe(83.5);
  expect(got.meta).toBe(83.5);
  expect(got.log.length).toBe(1);
  expect(got.log[0].kg).toBe(83.5);
});

test('a run logs CR10 effort and the talk test', async ({ page }) => {
  await boot(page);
  await startVia(page, 'Easy Run');
  await expect(page.locator('.screen--session')).toBeVisible();

  // Prefilled time (30 min); give it a distance.
  const plusDistance = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 40; i++) await plusDistance.click(); // 4.0 km

  await expect(page.locator('.eyebrow', { hasText: 'aim for 3–4' })).toBeVisible();
  await page.locator('.chip[data-band="target"]', { hasText: /^4$/ }).click();
  await page.locator('.chip[data-talk="yes"]').click();
  await page.locator('button', { hasText: 'Log run' }).click();
  await expect(page.locator('.page-title')).toBeVisible();

  const run = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.find((s) => s.kind === 'run').run;
  });
  expect(run.effort).toBe(4);
  expect(run.talkTest).toBe('yes');
});

test('a run more than 10% over the 30-day longest is challenged before it is logged, and can still be logged', async ({ page }) => {
  await boot(page);
  await seedRuns(page, [{ variant: 'long', km: 5.0, daysAgo: 7 }, { variant: 'easy', km: 4.0, daysAgo: 5 }]);
  await page.goto('./');
  await startVia(page, 'Long Run');
  await expect(page.locator('.screen--session')).toBeVisible();

  // Longest in 30 days is 5.0; log 6.5 — a 30% spike.
  await page.locator('.stepper').nth(0).locator('.stepper-value').click();
  await page.locator('.numfield').fill('6.5');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await page.locator('.stepper').nth(1).locator('.stepper-value').click();
  await page.locator('.numfield').fill('40');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();

  await page.locator('button', { hasText: 'Log run' }).click();
  await expect(page.locator('.sheet-title')).toContainText('bigger jump');
  await expect(page.locator('.sheet')).toContainText('associated with more injuries');
  await page.locator('.sheet button', { hasText: 'Check the distance' }).click();
  await expect(page.locator('.screen--session')).toBeVisible();

  await page.locator('button', { hasText: 'Log run' }).click();
  await page.locator('.sheet button', { hasText: 'Log it anyway' }).click();
  await expect(page.locator('.page-title')).toBeVisible();

  const logged = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.filter((s) => s.kind === 'run' && s.status === 'completed').length;
  });
  expect(logged).toBe(3);
});

test('the previous-injury question is asked once and hardens the spike warning', async ({ page }) => {
  await boot(page);
  await page.locator('.banner button', { hasText: 'Answer' }).click();
  await page.locator('.sheet button', { hasText: 'Yes, I have' }).click();
  await expect(page.locator('.banner button', { hasText: 'Answer' })).toHaveCount(0);

  await seedRuns(page, [{ variant: 'long', km: 5.0, daysAgo: 7 }]);
  await page.goto('./');
  // Today's long-run card (if today has one) or the alternatives sheet both go
  // through the same warning; check the copy from the run screen.
  await startVia(page, 'Long Run');
  await page.locator('.stepper').nth(0).locator('.stepper-value').click();
  await page.locator('.numfield').fill('7');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await page.locator('.stepper').nth(1).locator('.stepper-value').click();
  await page.locator('.numfield').fill('45');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await page.locator('button', { hasText: 'Log run' }).click();
  await expect(page.locator('.sheet')).toContainText('treat this as a stop');
});

test('a session whose title does not match its exercises is flagged in History and on the session', async ({ page }) => {
  await boot(page);
  // Doctor a session: Upper Push's exercises filed under Shoulders & Triceps.
  const id = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const push = resolveSession(CURRENT_PROGRAM, 'lift:A', { role: 'probe', historyFor: () => null, coreCompleted: 0 });
    const doctored = { ...push, dayKey: 'lift:D', name: CURRENT_PROGRAM.liftDays.D.name };
    const s = store.startSession(doctored, { mesocycle: 1, bodyweightKg: 82 });
    store.logSet(s.id, s.entries[2].entryId, s.entries[2].sets[0].setId, { weightKg: 20, reps: 12, rpe: 8 });
    store.completeSession(s.id, {});
    await store.flush();
    return s.id;
  });

  await page.locator('#tabbar a[data-tab="history"]').click();
  await expect(page.locator('[data-integrity="mismatch"]')).toBeVisible();

  await page.goto(`./#/session/${id}`);
  await expect(page.locator('[data-integrity="mismatch"]')).toContainText('Prescription mismatch');
  await expect(page.locator('[data-integrity="mismatch"]')).toContainText('not part of lift:D');
});

test('the bonus day is withdrawn outside probe weeks', async ({ page }) => {
  await boot(page);
  // Eight lifts on the lift-count clock → test week.
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    for (let i = 0; i < 8; i++) {
      const c = store.cursors();
      const r = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, { role: c.role, coreCompleted: 0, historyFor: () => null });
      const s = store.startSession(r, { mesocycle: c.mesocycle, bodyweightKg: 82 });
      store.completeSession(s.id, {});
    }
    await store.flush();
  });
  await page.goto('./');
  await expect(page.locator('.page-sub')).toContainText('test week');
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await expect(page.locator('.sheet .listitem', { hasText: 'Bonus' }).locator('.pill')).toHaveText('NOT THIS WEEK');
});
