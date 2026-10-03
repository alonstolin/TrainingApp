import { test, expect } from '@playwright/test';
import { boot, fixDay } from './_helpers.js';

/**
 * Today's week line (issue #5): one collapsed line directly below the hero,
 * expanding into direct sets per muscle. Placement only — the numbers are
 * the core's, pinned in tests/unit/attendance.test.mjs.
 */

test('the week line sits below the hero, collapsed, and expands into sets per muscle', async ({ page }) => {
  await fixDay(page); // Monday: the hero is Lower
  await boot(page);
  const line = page.locator('[data-week-line]');
  await expect(line).toBeVisible();
  await expect(line.locator('summary')).toHaveText(/This week: 0 of 4 sessions/);

  const hero = await page.locator('.hero').boundingBox();
  const box = await line.boundingBox();
  expect(box.y).toBeGreaterThan(hero.y + hero.height);
  // One line, so it never pushes what follows off the first screen. ("Also
  // today" only appears when a weekday carries two required days, which the
  // v3 template never does, so the line's own height is what can be held.)
  expect(box.height).toBeLessThan(64);

  const rows = line.locator('[data-muscle]');
  await expect(rows.first()).toBeHidden();
  await line.locator('summary').click();
  await expect(rows.first()).toBeVisible();
  await expect(line.locator('[data-muscle="side-delts"]')).toContainText('Side delts');
  await expect(line.locator('[data-muscle="side-delts"]')).toContainText('0 + 8');
});
