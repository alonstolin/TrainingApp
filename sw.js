/* eslint-env serviceworker */
/**
 * Service worker.
 *
 * The app has no backend, so the strategy is simply: precache everything, serve
 * cache-first, never require the network. Once installed it works in a basement
 * gym with no signal, permanently.
 *
 * The two lines below marked GENERATED are rewritten by tools/gen-sw-manifest.mjs.
 * Forgetting to add a new file to the precache list is the #1 way this app breaks
 * offline, so that list is generated rather than hand-maintained, and CI fails if
 * it drifts (`npm run check:sw`).
 */

// <<<GENERATED-VERSION-START>>>
const VERSION = '2026.08.14-cc8cd4cc';
// <<<GENERATED-VERSION-END>>>

const CACHE = `training-${VERSION}`;

// <<<PRECACHE-START>>>
const PRECACHE = [
  './',
  './assets/icons/apple-touch-icon-180.png',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/icon-512.png',
  './index.html',
  './manifest.webmanifest',
  './playwright.config.js',
  './src/core/calendar.js',
  './src/core/dates.js',
  './src/core/ids.js',
  './src/core/prescribe.js',
  './src/core/progression.js',
  './src/core/schedule.js',
  './src/core/schema.js',
  './src/core/stats.js',
  './src/data/backup.js',
  './src/data/db.js',
  './src/data/store.js',
  './src/main.js',
  './src/program/exercises.js',
  './src/program/index.js',
  './src/program/program.v1.js',
  './src/router.js',
  './src/ui/chart.js',
  './src/ui/dom.js',
  './src/ui/screens/calendar.js',
  './src/ui/screens/exercise.js',
  './src/ui/screens/history.js',
  './src/ui/screens/progress.js',
  './src/ui/screens/session.js',
  './src/ui/screens/settings.js',
  './src/ui/screens/today.js',
  './src/ui/sheet.js',
  './src/ui/stepper.js',
  './src/ui/timer.js',
  './src/ui/toast.js',
  './src/version.js',
  './styles/base.css',
  './styles/components.css',
  './styles/tokens.css',
];
// <<<PRECACHE-END>>>

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Deliberately NOT cache.addAll(). GitHub Pages serves assets with
      // Cache-Control: max-age=600, so a plain addAll immediately after a deploy
      // can precache the PREVIOUS version of a file straight from the HTTP cache.
      // Forcing {cache:'reload'} and putting under a clean key avoids that.
      await Promise.all(
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(new Request(url, { cache: 'reload' }));
            if (res.ok) await cache.put(url, res);
          } catch {
            // One unreachable asset must not abort the whole install.
          }
        }),
      );
      // No skipWaiting() here — the new worker waits until the user opts in, so
      // an update can never swap the app out from under an in-progress workout.
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'VERSION') {
    event.ports[0]?.postMessage({ version: VERSION });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hash routing means every route resolves to the one document, so navigations
  // always serve cached index.html. Deep links and offline nav never 404.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cached = await caches.match('./index.html', { ignoreSearch: true });
        if (cached) return cached;
        try {
          return await fetch(req);
        } catch {
          return new Response('<h1>Offline</h1><p>Open the app once online to install it.</p>', {
            headers: { 'Content-Type': 'text/html' },
            status: 503,
          });
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: false });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch (err) {
        const fallback = await caches.match(req, { ignoreSearch: true });
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});
