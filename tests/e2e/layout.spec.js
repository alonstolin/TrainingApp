import { test, expect } from '@playwright/test';
import { boot, acceptBodyweight, startLift } from './_helpers.js';

/**
 * Nothing the session needs may sit under the fixed bars.
 *
 * The bug this pins: the session screen reserved a hand-written 104px at the
 * bottom while the action bar (88px) and the rest timer stacked on it (~44px)
 * covered 132px, so the last row of the set editor — the RPE chips, always
 * last — could not be scrolled into view, and the rest bar overlapped the
 * action bar by 8px. Both clearances are measured now (ui/chrome.js), so these
 * assertions hold on any device and any safe-area inset.
 */

/** Box of the first match, or null when it is not on the page. */
const boxOf = async (page, selector) => {
  const l = page.locator(selector).first();
  return (await l.count()) ? l.boundingBox() : null;
};

test('the whole set editor clears the action bar and the rest timer', async ({ page }) => {
  await boot(page);
  await startLift(page);

  // Log a set: that starts the rest timer, which is the state the clearance
  // was wrong in.
  const plus = page.locator('.stepper button', { hasText: '+' }).first();
  for (let i = 0; i < 6; i++) await plus.click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await expect(page.locator('.rest-bar')).toBeVisible();
  // No manual scrolling: the next set's controls must be usable as they are.
  await page.waitForTimeout(600);

  const action = await boxOf(page, '.actionbar');
  const rest = await boxOf(page, '.rest-bar');
  // The RPE row is the last chip row in the editor, and the last thing on the
  // screen — which is exactly why it was the casualty.
  const rpe = await page.locator('.screen--session .chips').last().boundingBox();
  expect(action).not.toBeNull();
  expect(rest).not.toBeNull();
  expect(rpe).not.toBeNull();

  // The rest bar sits ON the action bar, not inside it.
  expect(rest.y + rest.height).toBeLessThanOrEqual(action.y + 1);
  // And the last editor control clears both.
  expect(rpe.y + rpe.height).toBeLessThanOrEqual(rest.y + 1);
});

test('the measured chrome tracks what is actually on screen', async ({ page }) => {
  await boot(page);
  const read = () =>
    page.evaluate(() => ({
      chrome: parseFloat(getComputedStyle(document.body).getPropertyValue('--bottom-chrome')),
      action: parseFloat(getComputedStyle(document.body).getPropertyValue('--actionbar-h')),
      tabbar: document.getElementById('tabbar').getBoundingClientRect().height,
    }));

  // Outside a session: the tab bar, nothing else.
  const idle = await read();
  expect(idle.action).toBe(0);
  expect(idle.chrome).toBeCloseTo(idle.tabbar, 0);

  // Inside one: the action bar, and the tab bar is gone.
  await startLift(page);
  await page.waitForTimeout(150);
  const inSession = await read();
  const action = await boxOf(page, '.actionbar');
  expect(inSession.action).toBeCloseTo(action.height, 0);
  expect(inSession.chrome).toBeCloseTo(action.height, 0);
});

test('a long day scrolls to its last exercise without the tab bar eating it', async ({ page }) => {
  await boot(page);
  await page.goto('./#/history');
  await expect(page.locator('.page-title')).toHaveText('History');
  // With a rest timer running outside a session, the bar stacks on the tab bar
  // and the page has to reserve room for both.
  await page.evaluate(async () => {
    const { startRest } = await import('./src/ui/timer.js');
    startRest(120, 'Test');
  });
  await expect(page.locator('.rest-bar')).toBeVisible();
  await page.waitForTimeout(250);
  const chrome = await page.evaluate(() => parseFloat(getComputedStyle(document.body).getPropertyValue('--bottom-chrome')));
  const rest = await boxOf(page, '.rest-bar');
  const tabbar = await boxOf(page, '#tabbar');
  expect(chrome).toBeCloseTo(rest.height + tabbar.height, 0);
  expect(rest.y + rest.height).toBeLessThanOrEqual(tabbar.y + 1);
});
