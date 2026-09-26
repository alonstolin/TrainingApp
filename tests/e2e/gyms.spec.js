import { test, expect } from '@playwright/test';
import { fixDay, startLift } from './_helpers.js';

/**
 * Two gyms, one app: cable and machine loads are kept per gym and per station,
 * a taken station can be swapped for an alternative — once, or always at
 * that gym — and none of it leaks into the other gym.
 */

/**
 * The gym picker lives on the Today hero, which only carries one on a LIFT
 * day — so these specs pin the clock to a Monday (Lower) rather than passing
 * on weekdays and failing at weekends.
 */
const boot = async (page) => {
  await fixDay(page);
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

const addGyms = (page) =>
  page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const a = store.addGym('Home Gym');
    const b = store.addGym('Downtown');
    await store.flush();
    return { a: a.id, b: b.id };
  });

const startPush = (page) => startLift(page, 'Upper Push');

test('the Today card asks which gym once there are two, and the session records it', async ({ page }) => {
  await boot(page);
  await expect(page.locator('[data-gym-picker]')).toHaveCount(0);
  const { b } = await addGyms(page);
  await page.goto('./');
  const picker = page.locator('[data-gym-picker]');
  await expect(picker).toBeVisible();
  await picker.locator('.chip', { hasText: 'Downtown' }).click();
  await expect(picker.locator('.chip', { hasText: 'Downtown' })).toHaveAttribute('aria-pressed', 'true');

  await startPush(page);
  await expect(page.locator('[data-gym-pill]')).toHaveText('Downtown');
  const gymId = await page.evaluate(async () => (await import('./src/data/store.js')).activeSession().gymId);
  expect(gymId).toBe(b);
});

test('a station tag scopes history within a gym; a swap can be made standing for that gym only', async ({ page }) => {
  await boot(page);
  await addGyms(page);
  await page.goto('./');
  await page.locator('[data-gym-picker] .chip', { hasText: 'Home Gym' }).click();
  await startPush(page);

  // Cable laterals are the third entry and gym-specific: tag the station.
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await page.locator('[data-station]').click();
  await page.locator('.sheet button', { hasText: 'New station' }).click();
  await page.locator('.numfield').fill('left stack');
  await page.locator('.sheet button', { hasText: /^Save$/ }).click();
  await expect(page.locator('[data-station]')).toHaveText('Station: left stack');

  // Log all three sets at 20 kg and finish.
  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 8; i++) await plus.click();
  for (let i = 0; i < 3; i++) {
    await page.locator('button', { hasText: /^Log set$/ }).click();
    await page.waitForTimeout(120);
  }
  await page.locator('button', { hasText: /^Finish$/ }).click();
  await page.locator('.sheet button', { hasText: /^Finish$/ }).click();
  await expect(page.locator('.page-title')).toBeVisible();

  // Next Push at Home Gym: the laterals remember the station and the load.
  await startPush(page);
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await expect(page.locator('.lasttime-label')).toContainText('Last time');
  await expect(page.locator('.lasttime-sets')).toContainText('20');

  // At Downtown the same exercise has no history of its own: the Home Gym
  // number is offered as a guide, not a target.
  await page.locator('[data-gym-pill]').click();
  await page.locator('.sheet button', { hasText: 'Downtown' }).click();
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await expect(page.locator('.lasttime-label')).toContainText('other gym');
  await expect(page.locator('.suggestion')).toContainText('guide');

  // Swap the cable laterals for dumbbells — always at Downtown.
  await page.locator('[data-swap]').click();
  await page.locator('[data-swap-to="db-lateral-raise"]').click();
  await page.locator('.sheet button', { hasText: 'Always at Downtown' }).click();
  await expect(page.locator('h2', { hasText: 'Dumbbell Lateral Raise' })).toBeVisible();
  await expect(page.locator('[data-swap]')).toHaveText('Swapped · change');

  // Discard, reload, and check the standing swap: Downtown gets dumbbells,
  // Home Gym still gets the cable. (Today's lift slot is already used up, so
  // the sessions are started from "Train something anyway".)
  const discard = () =>
    page.evaluate(async () => {
      const store = await import('./src/data/store.js');
      store.abandonSession(store.activeSession().id);
      await store.flush();
    });
  const pick = (name) =>
    page.evaluate(async (n) => {
      const store = await import('./src/data/store.js');
      store.setMeta({ lastGymId: store.getState().meta.gyms.find((g) => g.name === n).id });
    }, name);

  await discard();
  await page.goto('./');
  await pick('Downtown');
  await startPush(page);
  await expect(page.locator('.exnav button', { hasText: 'DB Lateral' })).toBeVisible();
  await expect(page.locator('.exnav button', { hasText: 'Cable Lateral' })).toHaveCount(0);

  await discard();
  await page.goto('./');
  await pick('Home Gym');
  await startPush(page);
  await expect(page.locator('.exnav button', { hasText: 'Cable Lateral' })).toBeVisible();
  await expect(page.locator('.exnav button', { hasText: 'DB Lateral' })).toHaveCount(0);
});

test('after a set is logged the swap becomes "add exercise", and the addition lands at the end', async ({ page }) => {
  await boot(page);
  await startPush(page);
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await expect(page.locator('[data-swap]')).toBeVisible();
  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 4; i++) await plus.click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await expect(page.locator('[data-swap]')).toHaveCount(0);
  await page.locator('[data-add-exercise]').click();
  await page.locator('.sheet .listitem', { hasText: 'Hammer Curl' }).click();
  await expect(page.locator('h2', { hasText: 'Hammer Curl' })).toBeVisible();
  const last = await page.evaluate(async () => {
    const s = (await import('./src/data/store.js')).activeSession();
    const e = s.entries.at(-1);
    return { id: e.exerciseId, added: e.added, sets: e.sets.length };
  });
  expect(last).toEqual({ id: 'hammer-curl', added: true, sets: 3 });
});

test('Settings lists gyms with their standing swaps and can remove one without touching history', async ({ page }) => {
  await boot(page);
  const { b } = await addGyms(page);
  await page.evaluate(async (gymId) => {
    const store = await import('./src/data/store.js');
    store.setSubstitution(gymId, 'cable-lateral-raise', 'db-lateral-raise');
    await store.flush();
  }, b);
  await page.goto('./#/settings');
  const row = page.locator('.listitem', { hasText: 'Downtown' });
  await expect(row).toContainText('1 standing swap');
  await row.click();
  await page.locator('.sheet button', { hasText: 'Remove gym' }).click();
  await page.locator('.sheet button', { hasText: /^Remove$/ }).click();
  await expect(page.locator('.listitem', { hasText: 'Downtown' })).toHaveCount(0);
  const meta = await page.evaluate(async () => (await import('./src/data/store.js')).getState().meta);
  expect(meta.gyms.length).toBe(1);
  expect(meta.substitutions[b]).toBeUndefined();
});
