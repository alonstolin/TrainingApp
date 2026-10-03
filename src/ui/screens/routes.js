/**
 * Routes — plan a run on a real map, keep the ones you like.
 *
 * Planning is tap-to-add-a-corner with straight segments between taps. The
 * distance readout is pinned at the top and updates on every tap, drag and
 * undo, next to the rung the plan wants — the whole point is to walk out the
 * door with a loop that measures 5.5 km, not 6.3.
 */

import { el, onTap, append } from '../dom.js';
import { openSheet, confirmSheet } from '../sheet.js';
import { textSheet } from '../stepper.js';
import { toast } from '../toast.js';
import * as store from '../../data/store.js';
import { CURRENT_PROGRAM } from '../../program/index.js';
import { createMap, currentPosition } from '../map.js';
import { routeDistanceKm, closeLoop, outAndBack, insertWaypoint, nearestSegment, routesThatFit, FIT_TOLERANCE } from '../../core/routes.js';
import { easyPaceSecPerKm, EASY_PACE_WINDOW_DAYS } from '../../core/stats.js';
import { formatPace } from '../../core/progression.js';
import { formatRelativeDate } from '../../core/dates.js';
import { navigate } from '../../router.js';

/** `#/routes/new?back=session/abc` → { back: 'session/abc' } */
function hashParams() {
  const q = window.location.hash.split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(q).entries());
}

/** The long-run target the plan wants next, if it is a distance. */
function currentTarget() {
  const c = store.cursors();
  const plan = CURRENT_PROGRAM.runPlan.find((w) => w.week === c.run.week) ?? CURRENT_PROGRAM.runMaintenance;
  return {
    long: plan.long?.kind === 'distance' ? plan.long.km : null,
    easy: plan.easy?.kind === 'distance' ? plan.easy.km : null,
  };
}

/** Where `?back=` returns to. Today lives at `/`, so it travels as 'today'. */
const backPath = (back, fallback) => (back == null ? fallback : back === 'today' ? '/' : `/${back}`);
/** The `?back=` suffix for a link onward, carrying the origin through. */
const backQuery = (back) => (back == null ? '' : `?back=${encodeURIComponent(back)}`);

/** One saved route as a tappable row: name, optional subtitle, distance. */
function routeRow(r, open, { sub = null, pill = null } = {}) {
  return onTap(
    el(
      'button.listitem',
      { type: 'button', dataset: { routeId: r.id } },
      el('span.listitem-mark.listitem-mark--run'),
      el('span.grow', null, el('div.listitem-title', { text: r.name }), sub ? el('div.listitem-sub', { text: sub }) : null),
      el('span.num', { style: { fontWeight: 700 }, text: `${r.km.toFixed(2)} km` }),
      pill,
    ),
    open,
  );
}

// ---------------------------------------------------------------------------
// Routes that fit a run — shown on Today's run card and a Calendar run day
// ---------------------------------------------------------------------------

/**
 * The saved routes that fit a run's target, plus a way to plan a new one.
 * Suggested, never attached: the route for a run is still chosen in the
 * session's "Which route?" card, and nothing is stored against the day.
 *
 * @param target  the resolved run's `target` ({kind:'distance', km} | {kind:'time', minutes})
 * @param o.back  where planning returns to ('today', 'calendar?day=…')
 * @param o.go    navigation; a sheet passes one that closes itself first
 */
export function routeFitCard(target, { back, go = navigate } = {}) {
  const { routes, sessions } = store.getState();
  const pace = target.kind === 'time' ? easyPaceSecPerKm(sessions) : null;
  const fit = routesThatFit(routes, target, { paceSecPerKm: pace });

  const within = `${Math.round(FIT_TOLERANCE * 100)}%`;
  const note =
    !routes.length
      ? 'No saved routes yet. Plan a loop once and it is suggested whenever it fits.'
      : fit.match === 'unmatched'
        ? `No easy run in the last ${EASY_PACE_WINDOW_DAYS / 7} weeks to take a pace from, so every route, shortest first.`
        : fit.match === 'estimate'
          ? `${target.minutes} min at your easy pace (${formatPace(pace)}) is about ${fit.km.toFixed(1)} km — an estimate. Routes within ${within} of it.`
          : `Routes within ${within} of ${fit.km} km.`;

  const list = el('div.listgroup');
  for (const r of fit.routes) list.appendChild(routeRow(r, () => go(`/routes/${r.id}${backQuery(back)}`)));

  return el(
    'div.stack',
    { style: { gap: '0.5rem' }, dataset: { routeFit: fit.match } },
    el(
      'div.row',
      { style: { gap: '0.4rem', alignItems: 'center' } },
      el('span.eyebrow', { text: fit.match === 'unmatched' ? 'Your routes' : 'Routes that fit' }),
      fit.match === 'estimate' ? el('span.pill', { text: 'ESTIMATE' }) : null,
    ),
    el('p.xs.dim', { text: note }),
    fit.routes.length ? list : routes.length ? el('p.small.muted', { text: `None of your ${routes.length} routes is that distance.` }) : null,
    el(
      'div.btn-row',
      null,
      onTap(el('button.btn.btn--sm', { type: 'button', text: '+ Plan a route' }), () => go(`/routes/new${backQuery(back)}`)),
      routes.length
        ? onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: `All routes · ${routes.length}` }), () => go(`/routes${backQuery(back)}`))
        : null,
    ),
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function mountRoutes(root) {
  const screen = el('div.screen');
  root.appendChild(screen);
  const params = hashParams();
  const backTo = backPath(params.back, '/');

  const render = () => {
    const { routes } = store.getState();
    screen.textContent = '';
    append(screen, [
      el(
        'header.page-head',
        null,
        onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '‹ Back' }), () => navigate(backTo)),
        el('h1.page-title', { text: 'Routes', style: { marginTop: '0.75rem' } }),
        el('div.page-sub', { text: routes.length ? `${routes.length} saved` : 'Plan a loop once, run it whenever.' }),
      ),
    ]);

    const target = currentTarget();
    const list = el('div.listgroup');
    for (const r of routes) {
      const near = target.long && Math.abs(r.km - target.long) / target.long <= 0.03;
      list.appendChild(
        routeRow(r, () => navigate(`/routes/${r.id}${backQuery(params.back)}`), {
          sub: `${r.waypoints.length} corners · ${formatRelativeDate(new Date(r.updatedAt).toISOString().slice(0, 10))}`,
          pill: near ? el('span.pill.pill--good', { text: 'TARGET' }) : null,
        }),
      );
    }

    append(screen, [
      el(
        'div.stack-lg',
        null,
        onTap(el('button.btn.btn--primary.btn--block', { type: 'button', text: '+ Plan a new route' }), () =>
          navigate(`/routes/new${backQuery(params.back)}`),
        ),
        routes.length
          ? list
          : el('div.empty', null, el('div.empty-mark', { text: '⌖' }), el('p', { text: 'No routes yet.' }), el('p.small', { text: 'Tap the corners of a loop on the map and the distance adds up as you go.' })),
        target.long
          ? el('p.xs.dim', { text: `Next long run: ${target.long} km. Routes within 3% of it are marked.` })
          : null,
      ),
    ]);
  };

  render();
  return { unmount: store.subscribe(render) };
}

// ---------------------------------------------------------------------------
// Planner / editor
// ---------------------------------------------------------------------------

export function mountRoutePlanner(root, params) {
  const screen = el('div.screen.screen--map');
  root.appendChild(screen);
  const q = hashParams();
  const existing = params.id && params.id !== 'new' ? store.getRoute(params.id) : null;
  const backTo = backPath(q.back, '/routes');

  let waypoints = existing ? existing.waypoints.map((p) => ({ ...p })) : [];
  let name = existing?.name ?? '';
  let dirty = false;
  let mapApi = null;
  let destroyed = false;

  const target = currentTarget();
  const km = el('div.route-km.num', { text: '0.00' });
  const kmNote = el('div.route-km-note', { text: 'km · tap the map to add a corner' });
  const readout = el('div.route-readout', null, el('div', null, km, el('span.route-km-unit', { text: ' km' })), kmNote);

  const paint = () => {
    const d = routeDistanceKm(waypoints);
    km.textContent = d.toFixed(2);
    readout.dataset.km = String(d);
    let note = waypoints.length === 0 ? 'tap the map to add a corner, or start from where you are' : `${waypoints.length} corner${waypoints.length === 1 ? '' : 's'}`;
    if (target.long) {
      const diff = d - target.long;
      const pct = Math.abs(diff) / target.long;
      note += ` · long-run target ${target.long} km`;
      readout.dataset.onTarget = pct <= 0.03 ? 'yes' : 'no';
      if (waypoints.length >= 2) note += pct <= 0.03 ? ' ✓' : diff > 0 ? ` (+${diff.toFixed(2)})` : ` (${diff.toFixed(2)})`;
    }
    kmNote.textContent = note;
    if (mapApi) {
      mapApi.setRoute(waypoints);
      mapApi.setWaypoints(waypoints, {
        onDrag: (i, p) => {
          waypoints[i] = p;
          dirty = true;
          paint();
        },
        onTapMarker: (i) => {
          if (waypoints.length < 2) return;
          waypoints.splice(i, 1);
          dirty = true;
          paint();
        },
      });
    }
    undoBtn.toggleAttribute('disabled', waypoints.length === 0);
    closeBtn.toggleAttribute('disabled', waypoints.length < 3);
    backBtn.toggleAttribute('disabled', waypoints.length < 2);
    saveBtn.toggleAttribute('disabled', waypoints.length < 2);
  };

  const addPoint = (p) => {
    // A tap close to the line adds a corner there; otherwise it extends the end.
    const near = nearestSegment(waypoints, p);
    waypoints = near && near.meters < 25 ? insertWaypoint(waypoints, near.index, p) : insertWaypoint(waypoints, null, p);
    dirty = true;
    paint();
  };

  const mapBox = el('div.mapbox', { dataset: { map: 'planner' } });
  const undoBtn = onTap(el('button.btn.btn--sm', { type: 'button', text: 'Undo', dataset: { undo: '' } }), () => {
    waypoints = waypoints.slice(0, -1);
    dirty = true;
    paint();
  });
  const closeBtn = onTap(el('button.btn.btn--sm', { type: 'button', text: 'Close loop' }), () => {
    waypoints = closeLoop(waypoints);
    dirty = true;
    paint();
    mapApi?.fit(waypoints);
  });
  const backBtn = onTap(el('button.btn.btn--sm', { type: 'button', text: 'Out & back' }), () => {
    waypoints = outAndBack(waypoints);
    dirty = true;
    paint();
    mapApi?.fit(waypoints);
  });
  const locateBtn = onTap(el('button.btn.btn--sm', { type: 'button', text: waypoints.length ? 'Centre' : 'Start here', dataset: { locate: '' } }), async () => {
    locateBtn.textContent = 'Locating…';
    const pos = await currentPosition();
    if (destroyed) return;
    if (!pos) {
      toast('Could not get a location — tap the map to start instead.');
      locateBtn.textContent = 'Start here';
      return;
    }
    if (waypoints.length === 0) addPoint({ lat: pos.lat, lon: pos.lon });
    mapApi?.setPosition(pos);
    mapApi?.setView(pos, 16);
    locateBtn.textContent = 'Centre';
  });
  const saveBtn = onTap(el('button.btn.btn--primary.btn--block', { type: 'button', text: existing ? 'Save changes' : 'Save route', dataset: { save: '' } }), () =>
    textSheet({
      title: existing ? 'Route name' : 'Name this route',
      value: name || (target.long ? `${routeDistanceKm(waypoints).toFixed(1)} km loop` : ''),
      placeholder: 'e.g. River loop',
      onSubmit: (v) => {
        name = v;
        const saved = store.saveRoute({ id: existing?.id, name, waypoints });
        dirty = false;
        toast(`Saved · ${saved.km.toFixed(2)} km`, { kind: 'good' });
        // Back to the run that asked for a route, with the route attached.
        if (q.back?.startsWith('session/')) {
          const sessionId = q.back.split('/')[1];
          store.updateSession(sessionId, (s) => {
            s.run = { ...(s.run ?? {}), routeId: saved.id, plannedKm: saved.km };
          });
        }
        navigate(backTo);
      },
    }),
  );

  append(screen, [
    el(
      'header.page-head.page-head--tight',
      null,
      el(
        'div.row-between',
        null,
        onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: '‹ Back' }), () => {
          if (!dirty) return navigate(backTo);
          confirmSheet({ title: 'Leave without saving?', subtitle: 'The corners you tapped will be lost.', confirmLabel: 'Leave', onConfirm: () => navigate(backTo) });
        }),
        existing
          ? onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: 'Delete' }), () =>
              confirmSheet({
                title: `Delete ${existing.name}?`,
                subtitle: 'Runs logged on it keep their own tracks.',
                confirmLabel: 'Delete',
                onConfirm: () => {
                  store.deleteRoute(existing.id);
                  navigate('/routes');
                },
              }),
            )
          : null,
      ),
      readout,
    ),
    mapBox,
    el('div.map-tools', null, locateBtn, undoBtn, closeBtn, backBtn),
    el('div.map-actions', null, saveBtn, el('p.xs.dim', { text: 'Straight lines between corners. Tap a corner to remove it, drag to move it.' })),
  ]);
  paint();

  createMap(mapBox, { onTap: addPoint })
    .then(async (api) => {
      if (destroyed) return api.destroy();
      mapApi = api;
      if (waypoints.length) api.fit(waypoints);
      else {
        const pos = await currentPosition({ timeout: 4000 });
        if (destroyed) return;
        if (pos) {
          api.setView(pos, 15);
          api.setPosition(pos);
        } else api.setView({ lat: 32.08, lon: 34.78 }, 12);
      }
      paint();
      // Tests drive the planner through this rather than through Leaflet's
      // pointer handling, which emulated touch does not reach.
      window.__planner = { addPoint, getKm: () => routeDistanceKm(waypoints), getWaypoints: () => waypoints.map((p) => ({ ...p })) };
    })
    .catch((e) => {
      console.error(e);
      mapBox.appendChild(el('div.empty', null, el('p', { text: 'The map could not load. Check the connection and try again.' })));
    });

  return {
    unmount() {
      destroyed = true;
      delete window.__planner;
      mapApi?.destroy();
    },
  };
}
