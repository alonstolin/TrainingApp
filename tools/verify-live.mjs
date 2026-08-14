#!/usr/bin/env node
/**
 * Smoke-test the DEPLOYED site, not the dev server.
 *
 * Everything that only breaks in production breaks here: the /TrainingApp/
 * subpath, real HTTPS, real GitHub Pages cache headers, and the service worker
 * registering under a scope it does not own by default.
 */

import { webkit, devices } from '@playwright/test';

const URL = process.argv[2] ?? 'https://alonstolin.github.io/TrainingApp/';
const fails = [];
const ok = (label) => console.log(`  ✓ ${label}`);
const bad = (label, detail) => {
  fails.push(`${label}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
};

console.log(`\nVerifying ${URL}\n`);

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const failedRequests = [];
page.on('requestfailed', (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));

await page.goto(URL, { waitUntil: 'load' });

// --- boots
try {
  await page.waitForSelector('.page-title', { timeout: 15000 });
  ok('app boots and renders Today');
} catch {
  bad('app boots', 'no .page-title appeared');
}

// --- no errors
if (errors.length === 0) ok('no console errors or uncaught exceptions');
else bad('console clean', errors.slice(0, 3).join(' | '));

if (failedRequests.length === 0) ok('every request resolved');
else bad('all requests resolve', failedRequests.slice(0, 3).join(' | '));

// --- PWA install requirements
const head = await page.evaluate(() => ({
  manifest: document.querySelector('link[rel=manifest]')?.getAttribute('href'),
  appleIcon: document.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href'),
  capable: document.querySelector('meta[name=apple-mobile-web-app-capable]')?.content,
  statusBar: document.querySelector('meta[name=apple-mobile-web-app-status-bar-style]')?.content,
  viewport: document.querySelector('meta[name=viewport]')?.content,
  title: document.title,
}));

head.manifest ? ok('manifest linked') : bad('manifest linked');
head.appleIcon ? ok('apple-touch-icon linked') : bad('apple-touch-icon linked');
head.capable === 'yes' ? ok('installs standalone (apple-mobile-web-app-capable)') : bad('standalone capable');
head.viewport?.includes('viewport-fit=cover')
  ? ok('viewport-fit=cover set (safe-area insets work)')
  : bad('viewport-fit=cover');

const manifest = await page.evaluate(async (href) => {
  const res = await fetch(href);
  return res.ok ? res.json() : null;
}, head.manifest);

if (manifest?.display === 'standalone' && manifest.icons?.length >= 2) {
  ok(`manifest valid — "${manifest.name}", ${manifest.icons.length} icons, ${manifest.display}`);
} else {
  bad('manifest valid', JSON.stringify(manifest)?.slice(0, 120));
}

// --- service worker under the real subpath scope
await page.waitForTimeout(4000);
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { registered: false };
  await navigator.serviceWorker.ready;
  const keys = await caches.keys();
  const name = keys.find((k) => k.startsWith('training-'));
  const cache = name ? await caches.open(name) : null;
  const cached = cache ? (await cache.keys()).length : 0;
  return {
    registered: true,
    scope: reg.scope,
    controlled: !!navigator.serviceWorker.controller,
    cacheName: name,
    cached,
  };
});

if (sw.registered) ok(`service worker registered · scope ${sw.scope}`);
else bad('service worker registered');
if (sw.controlled) ok('service worker controls the page');
else bad('service worker controls the page');
if (sw.cached > 30) ok(`${sw.cached} files precached (${sw.cacheName})`);
else bad('precache populated', `only ${sw.cached} files`);

// --- offline capability: can the cache satisfy every boot request?
const offline = await page.evaluate(async () => {
  const swText = await (await fetch('./sw.js')).text();
  const block = swText.match(/PRECACHE = \[([\s\S]*?)\]/)[1];
  const required = [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  const missing = [];
  for (const u of required) {
    const res = await caches.match(new URL(u, location.href).href, { ignoreSearch: true });
    if (!res || !res.ok) missing.push(u);
  }
  return { total: required.length, missing };
});
offline.missing.length === 0
  ? ok(`all ${offline.total} boot assets served from cache — works offline`)
  : bad('offline ready', `missing ${offline.missing.slice(0, 3).join(', ')}`);

// --- the program actually loaded
const program = await page.evaluate(async () => {
  const { CURRENT_PROGRAM } = await import('./src/program/index.js');
  return {
    name: CURRENT_PROGRAM.name,
    days: Object.keys(CURRENT_PROGRAM.liftDays).length,
    runWeeks: CURRENT_PROGRAM.runPlan.length,
    goalKm: CURRENT_PROGRAM.runPlan.at(-1).long.km,
    corePhases: CURRENT_PROGRAM.corePhases.length,
  };
});
program.goalKm === 10 && program.days === 5 && program.corePhases === 3
  ? ok(`program loaded — ${program.days} lift days, ${program.runWeeks}-week ramp to ${program.goalKm}K, ${program.corePhases} core phases`)
  : bad('program loaded', JSON.stringify(program));

// --- a real logging round-trip against production
await page.locator('button.btn--xl').first().click();
await page.waitForSelector('.screen--session');
const plus = page.locator('.stepper button', { hasText: '+' }).first();
for (let i = 0; i < 8; i++) await plus.click();
await page.locator('button', { hasText: /^Log set$/ }).click();
await page.waitForTimeout(800);

const logged = await page.evaluate(async () => {
  const store = await import('./src/data/store.js');
  const s = store.activeSession();
  return s?.entries?.[0]?.sets?.filter((x) => x.done).length ?? 0;
});
logged > 0 ? ok('logged a set and it persisted') : bad('logging works');

// --- and it survives a full reload
await page.goto('about:blank');
await page.goto(URL);
await page.waitForSelector('.page-title', { timeout: 15000 });
const survived = await page.evaluate(async () => {
  const store = await import('./src/data/store.js');
  return store.getState().sessions.length;
});
survived > 0 ? ok('data survives a hard reload') : bad('data survives reload');

await browser.close();

console.log('');
if (fails.length) {
  console.log(`FAILED (${fails.length}):`);
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('All live checks passed.\n');
