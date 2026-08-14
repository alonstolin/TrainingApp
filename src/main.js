/** Bootstrap: hydrate the store, register the service worker, start the router. */

import * as store from './data/store.js';
import { start, register, navigate } from './router.js';
import { attachTimerLifecycle } from './ui/timer.js';
import { el, onTap, clear } from './ui/dom.js';
import { APP_VERSION } from './version.js';

import mountToday from './ui/screens/today.js';
import mountSession from './ui/screens/session.js';
import mountHistory from './ui/screens/history.js';
import mountProgress from './ui/screens/progress.js';
import mountSettings from './ui/screens/settings.js';
import mountExercise from './ui/screens/exercise.js';

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

let refreshing = false;

function showUpdatePill(worker) {
  const pill = document.getElementById('update-pill');
  if (!pill) return;

  // Never interrupt a workout. Reloading mid-session would lose the set the user
  // is part-way through entering; the update can wait until next launch.
  if (store.activeSession()) return;

  clear(pill);
  pill.hidden = false;
  pill.appendChild(el('span', { text: 'Update ready' }));
  pill.appendChild(
    onTap(
      el('button', { type: 'button', text: 'Reload', style: { fontWeight: '700', textDecoration: 'underline' } }),
      () => {
        pill.hidden = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      },
    ),
  );
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;

  // Whether this page was ALREADY controlled when we registered. On a first-ever
  // visit the worker activates and calls clients.claim(), which fires
  // controllerchange — reloading on that would make the app visibly reload the
  // very first time it is opened. Only a genuine update warrants a reload.
  const hadController = !!navigator.serviceWorker.controller;

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
      // THE critical flag. GitHub Pages serves sw.js with max-age=600, so without
      // this the browser checks a cached copy of the worker and deploys land
      // unpredictably — the classic "my phone still has the old version".
      updateViaCache: 'none',
    });

    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        // A worker reaching 'installed' WITH an existing controller means this is
        // an update, not a first install.
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdatePill(worker);
        }
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Skip the first-install claim; only reload for a real update.
      if (!hadController) return;
      // Guarded, or skipWaiting + reload becomes an infinite reload loop.
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // iOS PWAs stay resident for days; without an explicit poke the browser's own
    // update check may effectively never fire. Throttled to once an hour.
    let lastCheck = 0;
    const maybeUpdate = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - lastCheck < 3600_000) return;
      lastCheck = now;
      reg.update().catch(() => {});
    };
    maybeUpdate();
    document.addEventListener('visibilitychange', maybeUpdate);
  } catch (e) {
    console.warn('service worker registration failed', e);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

async function boot() {
  const root = document.getElementById('app');

  try {
    await store.init();
  } catch (e) {
    console.error(e);
    root.innerHTML =
      '<div class="screen"><h1 class="page-title">Storage unavailable</h1>' +
      '<p class="page-sub">This browser blocked local storage, so training data cannot be saved. ' +
      'Private browsing is the usual cause — open the app in a normal tab, or install it to the home screen.</p></div>';
    return;
  }

  register('/', mountToday);
  register('/session/:id', mountSession);
  register('/history', mountHistory);
  register('/progress', mountProgress);
  register('/exercise/:id', mountExercise);
  register('/settings', mountSettings);

  document.getElementById('tabbar').hidden = false;
  start(root);
  attachTimerLifecycle();

  // Persist writes before the app is suspended or closed. pagehide is the only
  // event iOS reliably fires; beforeunload is not dependable there.
  const flush = () => store.flush().catch(() => {});
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush();
  });

  registerSW();

  console.info(`Training ${APP_VERSION}`);
  void navigate;
}

boot();
