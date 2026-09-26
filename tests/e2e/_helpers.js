import { expect } from '@playwright/test';

/**
 * Shared e2e helpers.
 *
 * The one that matters: **never assume today's hero button starts a lift.**
 * The Today screen serves the slots for the actual weekday, so on a Saturday it
 * offers the long run, on a Tuesday the easy run, and on a Thursday nothing at
 * all. Specs that clicked `button.btn--xl` and then looked for "Log set" passed
 * from Monday to Friday and failed at weekends — which is exactly the kind of
 * test that teaches you to distrust the suite. `startLift` goes through the
 * "Something else" sheet, which can reach any session on any day.
 */

export const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

/** Days with a weighted pull-up ask for bodyweight before the session opens. */
export const acceptBodyweight = async (page) => {
  const use = page.locator('.sheet button', { hasText: 'Use this weight' });
  if (await use.isVisible().catch(() => false)) await use.click();
};

/** Open the "anything you could do today" sheet, whatever today happens to be. */
export const openAlternatives = async (page) => {
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await expect(page.locator('.sheet')).toBeVisible();
};

/** Start a session by name — 'Upper Push', 'Long Run', /Core — Phase/ … */
export const startVia = async (page, name) => {
  await openAlternatives(page);
  await page.locator('.sheet .listitem', { hasText: name }).first().click();
  await acceptBodyweight(page);
  await expect(page.locator('.screen--session')).toBeVisible();
};

/** A lift session with a weight-and-reps first exercise, on any day of the week. */
export const startLift = (page, name = 'Upper Push') => startVia(page, name);

/**
 * Freeze the clock on a date whose weekday the spec depends on. Monday is the
 * Lower day, so the Today screen leads with a lift.
 */
export const MONDAY = new Date(2026, 8, 21, 10, 0, 0); // 21 Sep 2026, local
export const fixDay = (page, when = MONDAY) => page.clock.setFixedTime(when);
