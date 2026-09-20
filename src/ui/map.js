/**
 * The map. Leaflet, vendored and precached, loaded only on screens that show
 * a map so Today and History never parse it.
 *
 * Tiles are the only network dependency in the app. Two key-free sources —
 * CARTO's dark basemap (fits the app; free for non-commercial use with
 * attribution) with OpenStreetMap's standard tiles as the fallback if CARTO
 * errors. The service worker caches every tile viewed, so routes you actually
 * run stay viewable offline; a tile never seen shows as a grey square and the
 * route still draws on top of it. `crossOrigin: true` makes the responses
 * CORS rather than opaque, which is what lets them be cached cleanly.
 */

const LEAFLET_JS = './vendor/leaflet/leaflet.js';
const LEAFLET_CSS = './vendor/leaflet/leaflet.css';

const TILES = [
  {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts: { subdomains: 'abcd', maxZoom: 19, crossOrigin: true, attribution: '© OpenStreetMap contributors © CARTO' },
  },
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opts: { maxZoom: 19, crossOrigin: true, attribution: '© OpenStreetMap contributors' },
  },
];

let loading = null;

/** Resolve the global `L`, loading the vendored build once. */
export function loadLeaflet() {
  if (typeof window !== 'undefined' && window.L) return Promise.resolve(window.L);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet did not define L')));
    script.onerror = () => reject(new Error('Leaflet failed to load'));
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

const toLatLng = (p) => [p.lat, p.lon];

/**
 * A map with the three layers the app draws: a planned route (dashed), a run
 * track (solid), and the current position (dot + accuracy ring).
 *
 * @param container  an element with a height
 * @param o { interactive?, onTap?(latlon), follow? }
 */
export async function createMap(container, o = {}) {
  const L = await loadLeaflet();
  const map = L.map(container, {
    zoomControl: false,
    attributionControl: true,
    tap: false, // Leaflet's tap shim double-fires on iOS 13+; pointer events are enough
    ...(o.interactive === false ? { dragging: false, touchZoom: false, scrollWheelZoom: false, doubleClickZoom: false, boxZoom: false, keyboard: false } : {}),
  });
  map.attributionControl.setPrefix('');

  let tileIndex = 0;
  let tiles = null;
  const mountTiles = () => {
    if (tiles) tiles.remove();
    const t = TILES[tileIndex];
    tiles = L.tileLayer(t.url, t.opts).addTo(map);
    let errors = 0;
    tiles.on('tileerror', () => {
      // A handful of errors is a dead zone in the cache; many is a dead source.
      errors++;
      if (errors > 8 && tileIndex < TILES.length - 1) {
        tileIndex++;
        mountTiles();
      }
    });
  };
  mountTiles();

  const routeLine = L.polyline([], { className: 'route-line', color: '#8ab4ff', weight: 4, opacity: 0.9, dashArray: '8 8', lineCap: 'round' }).addTo(map);
  const trackLine = L.polyline([], { className: 'track-line', color: '#5ee3a0', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(map);
  const accuracy = L.circle([0, 0], { radius: 0, color: '#ffffff', weight: 1, opacity: 0.35, fillOpacity: 0.08 });
  const dot = L.circleMarker([0, 0], { radius: 7, color: '#0d0d0d', weight: 2, fillColor: '#ffffff', fillOpacity: 1 });
  const markers = L.layerGroup().addTo(map);

  let follow = !!o.follow;
  let hasPosition = false;

  // Screens build their DOM before attaching it, so the map is usually created
  // on an element with no size yet — Leaflet then draws into a 0×0 box. Watch
  // the container and re-measure whenever it changes, replaying a fit that was
  // asked for before there was anything to fit into.
  let pendingFit = null;
  const hasSize = () => container.clientWidth > 0 && container.clientHeight > 0;
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
    if (!hasSize()) return;
    map.invalidateSize();
    if (pendingFit) {
      const f = pendingFit;
      pendingFit = null;
      f();
    }
  }) : null;
  ro?.observe(container);

  if (o.onTap) {
    map.on('click', (e) => o.onTap({ lat: e.latlng.lat, lon: e.latlng.lng }));
  }
  // Dragging the map means the runner wants to look around: stop following
  // until they ask again.
  map.on('dragstart', () => {
    if (follow) {
      follow = false;
      o.onFollowChange?.(false);
    }
  });

  const api = {
    L,
    map,
    setRoute(points) {
      routeLine.setLatLngs((points ?? []).map(toLatLng));
    },
    setTrack(points) {
      trackLine.setLatLngs((points ?? []).map(toLatLng));
    },
    setPosition(fix) {
      if (!fix) return;
      const ll = toLatLng(fix);
      dot.setLatLng(ll);
      accuracy.setLatLng(ll);
      accuracy.setRadius(fix.acc ?? 0);
      if (!hasPosition) {
        accuracy.addTo(map);
        dot.addTo(map);
        hasPosition = true;
        if (!o.zoomed) map.setView(ll, 16);
      }
      if (follow) map.panTo(ll, { animate: true, duration: 0.4 });
    },
    setFollow(on) {
      follow = on;
      o.onFollowChange?.(on);
      if (on && hasPosition) map.panTo(dot.getLatLng());
    },
    isFollowing: () => follow,
    /** Draggable waypoint markers for the planner. */
    setWaypoints(points, { onDrag, onTapMarker } = {}) {
      markers.clearLayers();
      (points ?? []).forEach((p, i) => {
        const m = L.marker(toLatLng(p), {
          draggable: !!onDrag,
          icon: L.divIcon({ className: 'wp', html: `<span class="wp-dot${i === 0 ? ' wp-dot--start' : ''}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
          keyboard: false,
        });
        if (onDrag) m.on('dragend', () => onDrag(i, { lat: m.getLatLng().lat, lon: m.getLatLng().lng }));
        if (onTapMarker) m.on('click', () => onTapMarker(i));
        markers.addLayer(m);
      });
    },
    fit(points, { padding = 40, maxZoom = 17 } = {}) {
      const pts = (points ?? []).map(toLatLng);
      if (pts.length === 0) return;
      const run = () => {
        if (pts.length === 1) map.setView(pts[0], 16);
        else map.fitBounds(L.latLngBounds(pts), { padding: [padding, padding], maxZoom });
      };
      if (hasSize()) run();
      else pendingFit = run;
    },
    setView(point, zoom = 15) {
      map.setView(toLatLng(point), zoom);
    },
    invalidate() {
      map.invalidateSize();
    },
    destroy() {
      ro?.disconnect();
      map.remove();
    },
  };
  return api;
}

/** A best-effort current location, or null. Never throws. */
export function currentPosition({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy ?? null }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 30_000 },
    );
  });
}
