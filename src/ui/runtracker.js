/**
 * Run stopwatch, optionally driven by GPS.
 *
 * Two modes behind one control, because they are the same interaction: press
 * start, run, press stop, and the numbers land in the form. GPS just also fills
 * in the distance and remembers the shape of the route.
 *
 * The iOS constraint is real and stated in the UI rather than hidden: a web app
 * is suspended when the screen locks, so nothing is recorded while it is off.
 * A wake lock keeps the screen alive whenever the page is visible, which covers
 * the normal case of the phone being in a pocket with the app open — but if iOS
 * suspends the tab anyway, elapsed time still resolves correctly because it is
 * computed from wall-clock timestamps, never accumulated per tick.
 */

import { el, onTap } from './dom.js';
import { keepAwake } from './timer.js';
import { formatDuration } from '../core/dates.js';
import { createTrackBuilder, recentPace, projectTrack } from '../core/geo.js';
import { formatPace } from '../core/progression.js';
import { createMap } from './map.js';

export const geoSupported = () => typeof navigator !== 'undefined' && 'geolocation' in navigator;

/** Small SVG of a track. No tiles, no network — just the shape you ran. */
export function trackShape(points, { width = 320, height = 180 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'trackshape');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Route traced by GPS');

  const { path, points: pts } = projectTrack(points, { width, height, padding: 12 });
  if (!path) return svg;

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', path);
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', 'var(--pullup)');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-linejoin', 'round');
  line.setAttribute('stroke-linecap', 'round');
  svg.appendChild(line);

  // Start and finish, so an out-and-back is readable as one.
  const dot = (p, fill) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', p.x.toFixed(1));
    c.setAttribute('cy', p.y.toFixed(1));
    c.setAttribute('r', '4');
    c.setAttribute('fill', fill);
    return c;
  };
  svg.appendChild(dot(pts[0], 'var(--ink-3)'));
  if (pts.length > 1) svg.appendChild(dot(pts[pts.length - 1], 'var(--good)'));
  return svg;
}

/**
 * A finished run on the map: the track, the planned route if there was one,
 * start and finish. Falls back to the dependency-free SVG trace when the map
 * cannot load (no Leaflet, no network on first use).
 *
 * @returns {{node: HTMLElement, destroy(): void}}
 */
export function trackMapCard({ track, route, height = 240 }) {
  const box = el('div.mapbox.mapbox--card', { style: { height: `${height}px`, minHeight: `${height}px` }, dataset: { map: 'track' } });
  let api = null;
  let dead = false;
  createMap(box, { interactive: true, zoomed: true })
    .then((m) => {
      if (dead) return m.destroy();
      api = m;
      if (route?.waypoints?.length) m.setRoute(route.waypoints);
      if (track?.length) m.setTrack(track);
      m.fit([...(track ?? []), ...(route?.waypoints ?? [])]);
    })
    .catch(() => {
      box.classList.remove('mapbox');
      box.textContent = '';
      if (track?.length > 1) box.appendChild(trackShape(track));
    });
  return {
    node: box,
    destroy() {
      dead = true;
      api?.destroy();
    },
  };
}

/**
 * @param {{useGps:boolean, route?:object, onFinish:({seconds, km, track}) => void}} o
 */
export function runTracker({ useGps = false, route = null, onFinish }) {
  let startedAt = null;
  let elapsedBefore = 0;
  let ticker = null;
  let watchId = null;
  let wake = null;
  // The builder owns smoothing and distance; `track` is its smoothed output.
  const builder = createTrackBuilder();
  const track = builder.points;
  let status = useGps ? 'GPS: waiting for a fix…' : '';

  const face = el('div.bigtimer-face.num', { text: '0:00' });
  const distEl = el('div.stat-value.num', { text: '—' });
  const paceEl = el('div.stat-value.num', { text: '—' });
  const statusEl = el('div.xs.dim', { text: status });
  const shapeBox = el('div.trackbox');
  // The live map: planned route dashed, the track solid, a dot for you. When it
  // cannot load, the SVG trace in shapeBox takes over.
  const mapBox = el('div.mapbox.mapbox--card', { dataset: { map: 'live' } });
  const followBtn = el('button.map-follow', { type: 'button', text: 'Following', 'aria-pressed': 'true' });
  let mapApi = null;
  let mapFailed = false;
  if (useGps) {
    mapBox.appendChild(followBtn);
    createMap(mapBox, {
      follow: true,
      onFollowChange: (on) => {
        followBtn.setAttribute('aria-pressed', String(on));
        followBtn.textContent = on ? 'Following' : 'Follow me';
      },
    })
      .then((api) => {
        mapApi = api;
        mapBox.appendChild(followBtn);
        if (route?.waypoints?.length) {
          api.setRoute(route.waypoints);
          api.fit(route.waypoints);
        }
        if (track.length) {
          api.setTrack(track);
          api.setPosition(track[track.length - 1]);
        }
      })
      .catch(() => {
        mapFailed = true;
        mapBox.remove();
      });
    onTap(followBtn, () => mapApi?.setFollow(!mapApi.isFollowing()));
  }

  const elapsed = () =>
    elapsedBefore + (startedAt ? (Date.now() - startedAt) / 1000 : 0);

  const paint = () => {
    face.textContent = formatDuration(elapsed());
    if (useGps) {
      const km = builder.km;
      distEl.textContent = km ? km.toFixed(2) : '—';
      const rp = recentPace(track);
      paceEl.textContent = rp ? formatPace(rp).replace(' /km', '') : '—';
      statusEl.textContent = status;
    }
  };

  const startTicking = () => {
    stopTicking();
    ticker = setInterval(paint, 500);
  };
  const stopTicking = () => {
    if (ticker) clearInterval(ticker);
    ticker = null;
  };

  const onFix = (pos) => {
    const fix = {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      t: pos.timestamp ?? Date.now(),
      acc: pos.coords.accuracy ?? null,
    };
    const { accepted, reason } = builder.push(fix);
    if (accepted) {
      status = `GPS: tracking · ±${Math.round(fix.acc ?? 0)}m`;
      if (mapApi) {
        mapApi.setPosition(track[track.length - 1] ? { ...track[track.length - 1], acc: fix.acc } : fix);
        if (track.length === 1 || track.length % 3 === 0) mapApi.setTrack(track);
      } else if (mapFailed && (track.length === 1 || track.length % 5 === 0)) renderShape();
    } else if (reason === 'inaccurate') {
      status = `GPS: weak signal (±${Math.round(fix.acc ?? 0)}m) — not recording`;
    }
    paint();
  };

  const onGeoError = (err) => {
    status =
      err?.code === 1
        ? 'GPS: permission denied — enter distance by hand below.'
        : 'GPS: unavailable right now — enter distance by hand below.';
    paint();
  };

  const renderShape = () => {
    shapeBox.textContent = '';
    if (track.length > 1) shapeBox.appendChild(trackShape(track));
  };

  const beginWatch = () => {
    if (!useGps || !geoSupported()) return;
    watchId = navigator.geolocation.watchPosition(onFix, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  };
  const endWatch = () => {
    if (watchId != null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
  };

  const btn = el('button.btn.btn--primary.btn--xl.btn--block', {
    type: 'button',
    text: useGps ? 'Start run' : 'Start timer',
  });
  const finishBtn = el('button.btn.btn--good.btn--block', {
    type: 'button',
    text: 'Use this',
    disabled: 'true',
  });

  const setRunning = (running) => {
    btn.textContent = running ? 'Pause' : elapsedBefore > 0 ? 'Resume' : useGps ? 'Start run' : 'Start timer';
    btn.className = `btn btn--xl btn--block ${running ? 'btn--danger' : 'btn--primary'}`;
    if (elapsedBefore > 0 || running) finishBtn.removeAttribute('disabled');
  };

  onTap(btn, () => {
    if (startedAt) {
      elapsedBefore = elapsed();
      startedAt = null;
      stopTicking();
      endWatch();
      wake?.();
      wake = null;
    } else {
      startedAt = Date.now();
      wake = keepAwake();
      startTicking();
      beginWatch();
    }
    setRunning(!!startedAt);
    paint();
  });

  onTap(finishBtn, () => {
    const seconds = Math.round(elapsed());
    startedAt = null;
    stopTicking();
    endWatch();
    wake?.();
    wake = null;
    onFinish({ seconds, km: useGps ? builder.km : null, track: track.slice() });
  });

  const root = el(
    'div.card.stack',
    null,
    el('div.bigtimer', null, face),
    useGps
      ? el(
          'div.statgrid',
          null,
          el('div.stat', null, distEl, el('div.stat-label', { text: 'km' })),
          el('div.stat', null, paceEl, el('div.stat-label', { text: 'recent pace' })),
        )
      : null,
    useGps ? mapBox : null,
    useGps ? shapeBox : null,
    btn,
    finishBtn,
    useGps ? statusEl : null,
    useGps
      ? el('p.xs.dim', {
          text: 'Keep the screen on. iOS suspends web apps when the phone locks, so anything run with the screen off is not recorded.',
        })
      : null,
  );

  root.stop = () => {
    stopTicking();
    endWatch();
    wake?.();
    wake = null;
    mapApi?.destroy();
    mapApi = null;
  };
  paint();
  return root;
}
