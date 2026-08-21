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
  /** 12 m/s ≈ 43 km/h — beyond any runner, so it is a GPS jump, not a sprint. */
  maxSpeedMps: 12,
  /** Smoothing strength: alpha = SMOOTH_K / reportedAccuracy, clamped. */
  smoothK: 1.4,
  minAlpha: 0.08,
  maxAlpha: 0.45,
  /** Distance from the anchor before a segment counts, scaled to the noise. */
  anchorK: 1.6,
  minAnchorM: 8,
  /** Below this average speed a segment is drift, not travel. */
  minSegmentMps: 0.5,
};

/**
 * How hard to smooth, from what the receiver says about itself.
 *
 * Smoothing has to match the noise. Too little and every wobble is counted as
 * distance; too much and real corners get cut, which under-reports a running
 * track. Scaling to reported accuracy gets both: a clean 4m fix is barely
 * touched, a ragged 20m fix is heavily averaged.
 */
export function smoothingAlpha(accuracyM, opts = {}) {
  const { smoothK, minAlpha, maxAlpha } = { ...DEFAULTS, ...opts };
  return Math.min(maxAlpha, Math.max(minAlpha, smoothK / (accuracyM ?? 8)));
}

/**
 * Should this fix be believed at all?
 *
 * Only two hard rejections: the receiver admitting it does not know where it is,
 * and a jump no human could make. Small-scale wobble is NOT rejected here — that
 * is the smoother's job, and gating on it was actively harmful (see below).
 *
 * @returns {{accept:boolean, reason:string, meters:number}}
 */
export function acceptPoint(prev, next, opts = {}) {
  const { maxAccuracyM, maxSpeedMps } = { ...DEFAULTS, ...opts };

  if (!Number.isFinite(next?.lat) || !Number.isFinite(next?.lon)) {
    return { accept: false, reason: 'invalid', meters: 0 };
  }
  if (next.acc != null && next.acc > maxAccuracyM) {
    return { accept: false, reason: 'inaccurate', meters: 0 };
  }
  if (!prev) return { accept: true, reason: 'first', meters: 0 };

  const meters = haversineMeters(prev, next);
  const dt = (next.t - prev.t) / 1000;
  if (dt > 0 && meters / dt > maxSpeedMps) {
    return { accept: false, reason: 'implausible', meters };
  }
  return { accept: true, reason: 'ok', meters };
}

/**
 * Streaming distance accumulator. Feed it raw fixes, read `meters` and `points`.
 *
 * Three stages, each fixing a distinct failure:
 *
 *  1. SMOOTH (adaptive EMA). Summing raw fixes measures the jagged path the
 *     receiver reported, not the smooth one you ran, and a jagged line is longer.
 *     Simulated against an 8km run this alone is the difference between +60% and
 *     +3% in poor signal.
 *
 *  2. ANCHOR GATE. Distance is only committed once you are convincingly away
 *     from the last committed point, scaled to reported accuracy. Chord-cutting
 *     across an 8m gate is negligible even on a 400m track's bends (~0.3%).
 *
 *  3. SEGMENT SPEED. Crossing that gate takes a runner ~2s and a phone sitting on
 *     a bench ~30s, so average speed over the segment separates travel from drift
 *     cleanly. Without it, five stationary minutes invent 50-130m.
 *
 * Superseded approach, kept as a warning: a fixed 5m "minimum movement" gate.
 * At 1Hz and ~3.4 m/s a real stride is only ~3.4m per fix — BELOW the gate — so
 * it discarded genuine movement and preferentially kept fixes where noise had
 * pushed the jump over 5m. It selected for noise, and still over-reported by 42%
 * in an urban simulation.
 */
export function createTrackBuilder(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  let smooth = null;
  let anchor = null;
  let last = null;
  let meters = 0;
  let rejected = 0;
  const points = [];

  return {
    /** @returns {{accepted:boolean, reason:string, meters:number}} */
    push(fix) {
      const { accept, reason } = acceptPoint(last, fix, cfg);
      if (!accept) {
        rejected++;
        return { accepted: false, reason, meters };
      }
      last = fix;

      if (!smooth) {
        smooth = { lat: fix.lat, lon: fix.lon, t: fix.t };
        anchor = { ...smooth };
      } else {
        const a = smoothingAlpha(fix.acc, cfg);
        smooth = {
          lat: smooth.lat + a * (fix.lat - smooth.lat),
          lon: smooth.lon + a * (fix.lon - smooth.lon),
          t: fix.t,
        };
      }
      points.push({ lat: smooth.lat, lon: smooth.lon, t: fix.t, acc: fix.acc ?? null });

      const gate = Math.max(cfg.minAnchorM, cfg.anchorK * (fix.acc ?? 8));
      const d = haversineMeters(anchor, smooth);
      if (d >= gate) {
        const dt = (smooth.t - anchor.t) / 1000;
        if (dt > 0 && d / dt >= cfg.minSegmentMps) meters += d;
        anchor = { ...smooth };
      }
      return { accepted: true, reason, meters };
    },
    get meters() { return meters; },
    get km() { return Math.round((meters / 1000) * 100) / 100; },
    get points() { return points; },
    get rejected() { return rejected; },
  };
}

/** Batch form of createTrackBuilder — same maths, whole list at once. */
export function buildTrack(fixes, opts = {}) {
  const b = createTrackBuilder(opts);
  for (const f of fixes ?? []) b.push(f);
  return { points: b.points, meters: b.meters, km: b.km, rejected: b.rejected };
}

/**
 * Distance of an already-smoothed track, in km.
 *
 * For a stored track, whose points came out of createTrackBuilder and are
 * therefore already smoothed. Do NOT hand this raw fixes — that is exactly the
 * naive sum this module exists to avoid.
 */
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
