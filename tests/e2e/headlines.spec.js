import { test, expect } from '@playwright/test';
import { boot } from './_helpers.js';

/**
 * Progress opens on the two goals (issue #7): three goal-lift cards and the
 * 10K, then Attendance, then everything else under Details. Placement only;
 * the series is pinned in tests/unit/stats.test.mjs.
 */

test('Progress reads headlines, then Attendance, then Details — with no routes button', async ({ page }) => {
  await boot(page);
  await page.locator('#tabbar').getByText('Progress').click();
  await expect(page.locator('.page-title')).toHaveText('Progress');

  const order = await page
    .locator('[data-headlines], [data-attendance], [data-details]')
    .evaluateAll((els) => els.map((e) => Object.keys(e.dataset)[0]));
  expect(order).toEqual(['headlines', 'attendance', 'details']);

  const headlines = page.locator('[data-headlines]');
  await expect(headlines.locator('[data-goal]')).toHaveCount(4);
  // Nothing logged: each lift says so rather than drawing an empty chart.
  await expect(headlines.locator('[data-goal="incline-bench"]')).toContainText('No probes yet');
  await expect(headlines.locator('[data-goal="weighted-pullup"]')).toContainText('No probes yet');
  await expect(headlines.locator('[data-goal="10k"]')).toContainText('10 km');
  // The existing charts survive, under Details.
  await expect(page.locator('[data-details]')).toContainText('Top set weight');
  await expect(page.locator('.screen button', { hasText: /route/i })).toHaveCount(0);
});
