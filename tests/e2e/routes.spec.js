import { test, expect } from '@playwright/test';

/**
 * Route planning on a real map. Tiles are aborted (nothing leaves the test
 * machine; Leaflet renders grey squares and the route draws on top), and the
 * planner is driven through window.__planner because Leaflet's pointer
 * handling does not see emulated touch.
 */

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

const blockTiles = (page) =>
  page.route(/basemaps\.cartocdn\.com|tile\.openstreetmap\.org/, (route) => route.abort());

/** A ~1 km square around Tel Aviv's Rabin Square. */
const SQUARE = [
  { lat: 32.0804, lon: 34.7805 },
  { lat: 32.0804, lon: 34.7911 }, // ~1.0 km east
  { lat: 32.0714, lon: 34.7911 }, // ~1.0 km south
  { lat: 32.0714, lon: 34.7805 },
];

test('the planner adds corners on tap, shows the distance live, closes the loop and saves', async ({ page }) => {
  await blockTiles(page);
  await boot(page);
  await page.goto('./#/routes/new');
  await expect(page.locator('[data-map="planner"].leaflet-container')).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction(() => !!window.__planner);

  const km = page.locator('.route-km');
  await expect(km).toHaveText('0.00');
  for (const [i, p] of SQUARE.entries()) {
    await page.evaluate((pt) => window.__planner.addPoint(pt), p);
    const now = Number(await km.textContent());
    if (i > 0) expect(now).toBeGreaterThan(0);
  }
  const open = Number(await km.textContent());
  expect(open).toBeGreaterThan(2.8);
  expect(open).toBeLessThan(3.2);

  await page.locator('button', { hasText: 'Close loop' }).click();
  const closed = Number(await km.textContent());
  expect(closed).toBeGreaterThan(open);
  expect(closed).toBeLessThan(4.2);
  await expect(page.locator('path.route-line')).toBeVisible();

  await page.locator('[data-undo]').click();
  expect(Number(await km.textContent())).toBeCloseTo(open, 1);
  await page.locator('button', { hasText: 'Close loop' }).click();

  await page.locator('[data-save]').click();
  await page.locator('.numfield').fill('Rabin square');
  await page.locator('.sheet button', { hasText: /^Save$/ }).click();

  await expect(page.locator('.page-title')).toHaveText('Routes');
  const row = page.locator('[data-route-id]');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Rabin square');
  await expect(row).toContainText(`${closed.toFixed(2)} km`);

  // Survives a reload — it is in IndexedDB, not in memory.
  await page.goto('./#/routes');
  await expect(page.locator('[data-route-id]')).toHaveCount(1);
});

test('"out & back" doubles the distance', async ({ page }) => {
  await blockTiles(page);
  await boot(page);
  await page.goto('./#/routes/new');
  await page.waitForFunction(() => !!window.__planner);
  for (const p of SQUARE.slice(0, 2)) await page.evaluate((pt) => window.__planner.addPoint(pt), p);
  const one = Number(await page.locator('.route-km').textContent());
  await page.locator('button', { hasText: 'Out & back' }).click();
  expect(Number(await page.locator('.route-km').textContent())).toBeCloseTo(one * 2, 1);
});

test('a saved route can be picked on a run, prefills the distance, and shows on the logged run', async ({ page }) => {
  await blockTiles(page);
  await boot(page);
  const routeId = await page.evaluate(async (pts) => {
    const store = await import('./src/data/store.js');
    const { closeLoop } = await import('./src/core/routes.js');
    return store.saveRoute({ name: 'Square', waypoints: closeLoop(pts) }).id;
  }, SQUARE);

  // Start a long run from the alternatives sheet.
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await page.locator('.sheet .listitem', { hasText: 'Long Run' }).first().click();
  await expect(page.locator('.screen--session')).toBeVisible();

  await page.locator('[data-route-card] button', { hasText: 'Pick a route' }).click();
  await page.locator(`[data-pick-route="${routeId}"]`).click();
  await expect(page.locator('[data-route-card]')).toContainText('Square');
  const km = await page.locator('.stepper').nth(0).locator('.stepper-num').textContent();
  expect(Number(km)).toBeGreaterThan(3.5);

  // Give it a time and log it.
  await page.locator('.stepper').nth(1).locator('.stepper-value').click();
  await page.locator('.numfield').fill('25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await page.locator('button', { hasText: 'Log run' }).click();
  // The 30-day longest is nothing, so no spike sheet; but be tolerant.
  const anyway = page.locator('.sheet button', { hasText: 'Log it anyway' });
  if (await anyway.isVisible().catch(() => false)) await anyway.click();
  await expect(page.locator('.page-title')).toBeVisible();

  const run = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.find((s) => s.kind === 'run' && s.status === 'completed').run;
  });
  expect(run.routeId).toBe(routeId);
  expect(run.plannedKm).toBeGreaterThan(3.5);

  await page.goto('./#/history');
  await page.locator('.listitem').first().click();
  await expect(page.locator('.card', { hasText: 'Route · Square' })).toBeVisible();
  await expect(page.locator('[data-map="track"] path.route-line')).toBeVisible();
});

test('the planner started from a run comes back to it with the route attached', async ({ page }) => {
  await blockTiles(page);
  await boot(page);
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await page.locator('.sheet .listitem', { hasText: 'Easy Run' }).first().click();
  const sessionId = await page.evaluate(async () => (await import('./src/data/store.js')).activeSession().id);

  await page.locator('[data-route-card] button', { hasText: 'Pick a route' }).click();
  await page.locator('.sheet button', { hasText: 'Plan a new route' }).click();
  await page.waitForFunction(() => !!window.__planner);
  for (const p of SQUARE.slice(0, 3)) await page.evaluate((pt) => window.__planner.addPoint(pt), p);
  await page.locator('[data-save]').click();
  await page.locator('.numfield').fill('L-shape');
  await page.locator('.sheet button', { hasText: /^Save$/ }).click();

  await expect(page).toHaveURL(new RegExp(`#/session/${sessionId}$`));
  await expect(page.locator('[data-route-card]')).toContainText('L-shape');
});

test('routes round-trip through a backup', async ({ page }) => {
  await boot(page);
  const before = await page.evaluate(async (pts) => {
    const store = await import('./src/data/store.js');
    const { buildPayload, importBackup } = await import('./src/data/backup.js');
    store.saveRoute({ name: 'Square', waypoints: pts });
    const payload = buildPayload();
    store.deleteRoute(store.getState().routes[0].id);
    const gone = store.getState().routes.length;
    const r = await importBackup(JSON.stringify(payload), 'merge');
    return { inPayload: payload.routes.length, gone, ok: r.ok, after: store.getState().routes.length, name: store.getState().routes[0]?.name };
  }, SQUARE);
  expect(before).toEqual({ inPayload: 1, gone: 0, ok: true, after: 1, name: 'Square' });
});
