/**
 * GPS track maths. DOM-free, pure.
 *
 * The hard part of phone GPS is not distance — it is deciding which fixes to
 * believe. A phone standing still reports a slowly wandering position, and every
 * one of those wanders is counted as distance run unless you filter it. Left
 * unfiltered, a 40-minute run comes back 10–15% long and the pace is a lie.
 * That is worse than useless in an app whose job is to show honest numbers, so
 * the filtering here is deliberately conservative: it would rather drop a real
 * metre than invent one.
 */

const R_EARTH_M = 6_371_008.8;
const toRad = (d) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const DEFAULTS = {
  /** Fixes worse than this are guesses, not positions. */
  maxAccuracyM: 25,
  /** Below this, movement is indistinguishable from the receiver wandering. */
  minMoveM: 5,
  /** 12 m/s ≈ 43 km/h — beyond any runner, so it is a GPS jump, not a sprint. */
  maxSpeedMps: 12,
};

/**
 * Should this fix be added to the track?
 * @returns {{accept:boolean, reason:string, meters:number}}
 */
export function acceptPoint(prev, next, opts = {}) {
  const { maxAccuracyM, minMoveM, maxSpeedMps } = { ...DEFAULTS, ...opts };

  if (!Number.isFinite(next?.lat) || !Number.isFinite(next?.lon)) {
    return { accept: false, reason: 'invalid', meters: 0 };
  }
  if (next.acc != null && next.acc > maxAccuracyM) {
    return { accept: false, reason: 'inaccurate', meters: 0 };
  }
  if (!prev) return { accept: true, reason: 'first', meters: 0 };

  const meters = haversineMeters(prev, next);
  if (meters < minMoveM) return { accept: false, reason: 'jitter', meters };

  const dt = (next.t - prev.t) / 1000;
  if (dt > 0 && meters / dt > maxSpeedMps) {
    return { accept: false, reason: 'implausible', meters };
  }
  return { accept: true, reason: 'ok', meters };
}

/** Run a raw fix list through the filter. Mirrors what live tracking accumulates. */
export function buildTrack(fixes, opts = {}) {
  const points = [];
  let meters = 0;
  let rejected = 0;
  for (const fix of fixes ?? []) {
    const prev = points[points.length - 1] ?? null;
    const { accept, meters: d } = acceptPoint(prev, fix, opts);
    if (!accept) {
      rejected++;
      continue;
    }
    meters += prev ? d : 0;
    points.push({ lat: fix.lat, lon: fix.lon, t: fix.t, acc: fix.acc ?? null });
  }
  return { points, meters, km: Math.round((meters / 1000) * 100) / 100, rejected };
}

/** Total distance of an already-filtered track, in km. */
export function trackDistanceKm(points) {
  let m = 0;
  for (let i = 1; i < (points?.length ?? 0); i++) m += haversineMeters(points[i - 1], points[i]);
  return Math.round((m / 1000) * 100) / 100;
}

/**
 * Thin a track for storage, keeping shape.
 *
 * Distance-gated rather than every-Nth-point: a straight kilometre needs almost
 * no points, while a tight corner needs them all. Endpoints are always kept.
 */
export function downsample(points, { minMeters = 10 } = {}) {
  if (!points?.length) return [];
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (haversineMeters(out[out.length - 1], points[i]) >= minMeters) out.push(points[i]);
  }
  if (points.length > 1) out.push(points[points.length - 1]);
  return out;
}

/**
 * Project to SVG coordinates.
 *
 * Equirectangular with a cos(latitude) correction on longitude. Over a few
 * kilometres the error is far below a stroke width, and it keeps the drawing
 * dependency-free. Aspect ratio is preserved so a there-and-back does not get
 * stretched into a loop.
 */
export function projectTrack(points, { width = 300, height = 200, padding = 8 } = {}) {
  if (!points?.length) return { path: '', points: [], bounds: null };

  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const midLat = (minLat + maxLat) / 2;
  const xScale = Math.cos(toRad(midLat));
  const spanX = Math.max((maxLon - minLon) * xScale, 1e-9);
  const spanY = Math.max(maxLat - minLat, 1e-9);

  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const scale = Math.min(usableW / spanX, usableH / spanY);

  // Centre whichever axis has slack, so the trace sits in the middle of the box.
  const offX = padding + (usableW - spanX * scale) / 2;
  const offY = padding + (usableH - spanY * scale) / 2;

  const projected = points.map((p) => ({
    x: offX + (p.lon - minLon) * xScale * scale,
    // SVG y grows downward; latitude grows north. Flip so north is up.
    y: offY + (maxLat - p.lat) * scale,
  }));

  const path = projected
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  return { path, points: projected, bounds: { minLat, maxLat, minLon, maxLon } };
}

/** Rolling pace over the last `windowM` metres, in sec/km. Null until there is enough. */
export function recentPace(points, { windowM = 400 } = {}) {
  if (!points || points.length < 2) return null;
  let meters = 0;
  let i = points.length - 1;
  while (i > 0 && meters < windowM) {
    meters += haversineMeters(points[i - 1], points[i]);
    i--;
  }
  if (meters < 100) return null; // too little to be meaningful
  const seconds = (points[points.length - 1].t - points[i].t) / 1000;
  if (seconds <= 0) return null;
  return (seconds / meters) * 1000;
}
