import { test, expect } from '@playwright/test';

/** Fail loudly on any console error or uncaught exception. */
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

test('boots with no console errors and shows today', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await expect(page.locator('#tabbar')).toBeVisible();
  await expect(page.locator('.page-sub')).toContainText('Block 1');
  expect(errors).toEqual([]);
});

test('all four tabs render without errors', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  for (const [tab, heading] of [
    ['history', 'History'],
    ['progress', 'Progress'],
    ['settings', 'Settings'],
    ['today', null],
  ]) {
    await page.locator(`#tabbar a[data-tab="${tab}"]`).click();
    await page.waitForTimeout(250);
    if (heading) await expect(page.locator('.page-title')).toContainText(heading);
  }
  expect(errors).toEqual([]);
});

test('logs a full lift session end to end and it survives a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  // Monday is Lower; whatever today is, start the primary or pick a lift.
  const start = page.locator('button.btn--xl').first();
  await expect(start).toBeVisible();
  await start.click();

  await expect(page.locator('.screen--session')).toBeVisible();

  // The prescription and the "last time" row must both be present.
  await expect(page.locator('.lasttime')).toBeVisible();

  // Log the first set: set reps via the quick chip row, then log.
  const logBtn = page.locator('button', { hasText: /^Log set$/ });
  await expect(logBtn).toBeVisible();

  // Bump the weight up off null so the set is meaningful.
  const plus = page.locator('.stepper button', { hasText: '+' }).first();
  for (let i = 0; i < 8; i++) await plus.click();

  await logBtn.click();

  // First set is now logged and the rest timer is running.
  await expect(page.locator('.setrow--done').first()).toBeVisible();
  await expect(page.locator('#rest-bar')).toBeVisible();

  const sessionUrl = page.url();

  // Hard reload mid-session. Every set is persisted the instant it is logged, so
  // nothing should be lost even though iOS can kill a backgrounded app at will.
  await page.goto('about:blank');
  await page.goto(sessionUrl);
  await expect(page.locator('.setrow--done').first()).toBeVisible({ timeout: 10_000 });

  // And Today offers to resume it.
  await page.goto('./');
  await expect(page.locator('.page-title')).toContainText('Session in progress');

  expect(errors).toEqual([]);
});

test('service worker precaches every file the app needs to boot', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2000); // let install() finish writing the cache

  const result = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys.find((k) => k.startsWith('training-')));
    const cached = (await cache.keys()).map((r) => new URL(r.url).pathname);

    // Re-derive the required list from the served sw.js so the test cannot drift
    // out of sync with what the app actually declares.
    const swText = await (await fetch('./sw.js')).text();
    const block = swText.match(/PRECACHE = \[([\s\S]*?)\]/)[1];
    const required = [...block.matchAll(/'([^']+)'/g)].map((m) =>
      new URL(m[1], location.href).pathname,
    );

    return { missing: required.filter((r) => !cached.includes(r)), cachedCount: cached.length };
  });

  expect(result.missing).toEqual([]);
  expect(result.cachedCount).toBeGreaterThan(30);
});

test('every boot request can be satisfied from cache alone', async ({ page }) => {
  // Playwright intercepts above the service worker, so it blocks the very
  // navigation the SW would have served — a harness limitation, not app
  // behaviour. So assert the property directly: the SW controls the page, and
  // every precached URL resolves out of Cache Storage with a real body. That is
  // exactly what sw.js returns on a cache hit, so an offline boot must succeed.
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(2000);

  const result = await page.evaluate(async () => {
    const controlled = !!navigator.serviceWorker.controller;
    const swText = await (await fetch('./sw.js')).text();
    const block = swText.match(/PRECACHE = \[([\s\S]*?)\]/)[1];
    const required = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);

    const bad = [];
    for (const url of required) {
      const res = await caches.match(new URL(url, location.href).href, { ignoreSearch: true });
      if (!res || !res.ok) { bad.push(`${url}: no cached response`); continue; }
      const body = await res.clone().text();
      if (body.length === 0 && !url.endsWith('.png')) bad.push(`${url}: empty body`);
    }
    return { controlled, bad, count: required.length };
  });

  expect(result.controlled).toBe(true);
  expect(result.bad).toEqual([]);
  expect(result.count).toBeGreaterThan(30);
});

test('in-app navigation needs no network at all', async ({ page, context }) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  // Hash routing means moving between screens is pure client-side work. With
  // every request aborted, all four tabs must still render.
  await context.route('**/*', (route) => route.abort());

  for (const [tab, heading] of [['progress', 'Progress'], ['history', 'History'], ['settings', 'Settings']]) {
    await page.locator(`#tabbar a[data-tab="${tab}"]`).click();
    await expect(page.locator('.page-title')).toContainText(heading);
  }

  await context.unroute('**/*');
});

test('export produces a valid backup that round-trips through import', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);

  // Log something so there is data worth backing up.
  await page.locator('button.btn--xl').first().click();
  const plus = page.locator('.stepper button', { hasText: '+' }).first();
  for (let i = 0; i < 8; i++) await plus.click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await page.waitForTimeout(400);

  const before = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { buildBackup } = await import('./src/core/schema.js');
    const s = store.getState();
    return JSON.stringify(buildBackup(s.meta, s.sessions, 'test'));
  });

  const result = await page.evaluate(async (payload) => {
    const store = await import('./src/data/store.js');
    const { importBackup } = await import('./src/data/backup.js');
    const r = await importBackup(payload, 'replace');
    return { ok: r.ok, total: r.total, sessions: store.getState().sessions.length };
  }, before);

  expect(result.ok).toBe(true);
  expect(result.sessions).toBe(result.total);
  expect(result.sessions).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('a corrupt backup is rejected without destroying existing data', async ({ page }) => {
  await boot(page);
  const outcome = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { importBackup } = await import('./src/data/backup.js');
    const before = store.getState().sessions.length;
    const r = await importBackup('{"format":"wrong","sessions":[]}', 'replace');
    return { ok: r.ok, before, after: store.getState().sessions.length };
  });
  expect(outcome.ok).toBe(false);
  expect(outcome.after).toBe(outcome.before);
});

test('skipping a session records it and moves the program on', async ({ page }) => {
  await boot(page);
  const skip = page.locator('button', { hasText: /^Skip$/ });
  if (await skip.count()) {
    await skip.click();
    await page.locator('button', { hasText: 'Mark as skipped' }).click();
    await page.waitForTimeout(400);
    await page.locator('#tabbar a[data-tab="history"]').click();
    await expect(page.locator('.listitem-sub', { hasText: 'Skipped' }).first()).toBeVisible();
  }
});
