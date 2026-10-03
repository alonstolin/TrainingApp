import { test, expect } from '@playwright/test';
import { boot, fixDay } from './_helpers.js';

/**
 * Progress's Attendance section (issue #6): sessions per week, then the skip
 * ledger, then shortfall by block — cause before cost. Placement only; the
 * numbers are the core ledger's, pinned in tests/unit/attendance.test.mjs.
 */

const openProgress = async (page) => {
  await page.locator('#tabbar').getByText('Progress').click();
  await expect(page.locator('.page-title')).toHaveText('Progress');
};

test('Attendance shows its three parts in order, and reads sensibly with nothing logged', async ({ page }) => {
  await fixDay(page);
  await boot(page);
  await openProgress(page);
  const section = page.locator('[data-attendance]');
  await expect(section).toBeVisible();
  const parts = await section.locator('[data-part]').evaluateAll((els) => els.map((e) => e.dataset.part));
  expect(parts).toEqual(['sessions', 'skips', 'shortfall']);
  await expect(section.locator('[data-part="skips"]')).toContainText('No skipped sessions');
  await expect(section.locator('[data-part="shortfall"]')).toContainText('First block');
});

test('a skipped session lands in the skip ledger and is told apart from a missed day', async ({ page }) => {
  await fixDay(page); // Monday: the hero is Lower
  await boot(page);
  await page.locator('button', { hasText: /^Skip$/ }).click();
  await page.locator('.sheet button', { hasText: 'Mark as skipped' }).click();
  await openProgress(page);
  const section = page.locator('[data-attendance]');
  await expect(section.locator('[data-part="skips"]')).toContainText('Lower + Pull Volume');
  await expect(section.locator('[data-part="sessions"] [data-mark="skipped"]')).toHaveCount(1);
  await expect(section.locator('[data-part="shortfall"]')).toContainText('Quads');
});
