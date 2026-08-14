/**
 * Hash router.
 *
 * Hash routing rather than the History API because GitHub Pages has no rewrite
 * rules — a deep link to /TrainingApp/progress would 404 on a hard reload.
 * With hashes every route is the same document, which also makes the service
 * worker's navigation handling trivially correct offline.
 */

import { clear, scrollTop } from './ui/dom.js';

const routes = [];
let current = null;
let root = null;

export function register(pattern, mount) {
  // '#/session/:id' → capture group per :param
  const keys = [];
  const rx = new RegExp(
    `^${pattern.replace(/:[A-Za-z]+/g, (m) => {
      keys.push(m.slice(1));
      return '([^/]+)';
    })}$`,
  );
  routes.push({ rx, keys, mount });
}

function parse() {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash.split('?')[0];
}

export function navigate(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (window.location.hash === target) {
    render();
    return;
  }
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export const back = () => window.history.back();

function markTab(path) {
  const tab = path === '/' ? 'today' : path.split('/')[1];
  for (const a of document.querySelectorAll('#tabbar a')) {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

export function render() {
  const path = parse();

  // Screens own teardown of their own timers, listeners and wake locks.
  try {
    current?.unmount?.();
  } catch (e) {
    console.error('unmount failed', e);
  }
  current = null;

  // Sheets live outside #app, so one left open would survive navigation and its
  // backdrop would silently swallow every tap on the new screen.
  const sheetHost = document.getElementById('sheet-host');
  if (sheetHost) clear(sheetHost);

  clear(root);

  for (const route of routes) {
    const m = path.match(route.rx);
    if (!m) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    try {
      current = route.mount(root, params) ?? null;
    } catch (e) {
      console.error('screen failed to mount', e);
      root.textContent = '';
      const p = document.createElement('div');
      p.className = 'screen';
      p.innerHTML =
        '<h1 class="page-title">Something broke</h1>' +
        `<p class="page-sub">${String(e.message ?? e)}</p>` +
        '<p class="small muted" style="margin-top:1rem">Your logged data is safe — it lives in the database, not in this screen. Try Settings → Force update.</p>';
      root.appendChild(p);
    }
    markTab(path);
    scrollTop();
    return;
  }

  navigate('/', { replace: true });
}

export function start(mountRoot) {
  root = mountRoot;
  window.addEventListener('hashchange', render);
  render();
}
