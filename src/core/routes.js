/**
 * Planned routes. DOM-free, pure.
 *
 * A route is a list of tapped waypoints joined by straight segments. No road
 * snapping: it needs no third-party routing service, it works offline once
 * the tiles are cached, and tapping the corners of the streets you actually
 * run gets within a few percent — honest enough for a distance target. The
 * distance shown while planning is the sum of the segments, nothing more.
 */

import { haversineMeters } from './geo.js';

/** Sum of the straight segments, in km to two decimals. */
export function routeDistanceKm(waypoints) {
  let m = 0;
  for (let i = 1; i < (waypoints?.length ?? 0); i++) m += haversineMeters(waypoints[i - 1], waypoints[i]);
  return Math.round((m / 1000) * 100) / 100;
}

/** Append the start so the route ends where it began. No-op if it already does. */
export function closeLoop(waypoints) {
  if (!waypoints?.length || waypoints.length < 2) return waypoints ?? [];
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (haversineMeters(first, last) < 5) return waypoints;
  return [...waypoints, { lat: first.lat, lon: first.lon }];
}

/** Turn around and come back the way you went: doubles the distance. */
export function outAndBack(waypoints) {
  if (!waypoints?.length || waypoints.length < 2) return waypoints ?? [];
  return [...waypoints, ...waypoints.slice(0, -1).reverse().map((p) => ({ lat: p.lat, lon: p.lon }))];
}

/** Bounding box, for fitting a map. */
export function bounds(waypoints) {
  if (!waypoints?.length) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of waypoints) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Index of the segment closest to a point, so a tap near the line inserts a
 * corner there instead of appending to the end.
 */
export function nearestSegment(waypoints, point) {
  if (!waypoints || waypoints.length < 2) return null;
  let best = null;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const d = pointToSegmentMeters(point, a, b);
    if (best == null || d < best.meters) best = { index: i, meters: d };
  }
  return best;
}

/** Distance from p to segment ab, in metres, on a locally flat projection. */
export function pointToSegmentMeters(p, a, b) {
  const kx = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180) * 111_320;
  const ky = 110_540;
  const ax = 0;
  const ay = 0;
  const bx = (b.lon - a.lon) * kx;
  const by = (b.lat - a.lat) * ky;
  const px = (p.lon - a.lon) * kx;
  const py = (p.lat - a.lat) * ky;
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len2));
  const cx = ax + t * (bx - ax);
  const cy = ay + t * (by - ay);
  return Math.hypot(px - cx, py - cy);
}

/** Insert a waypoint before index `i` (or append when i is out of range). */
export function insertWaypoint(waypoints, i, point) {
  const out = [...(waypoints ?? [])];
  const at = i == null || i < 0 || i > out.length ? out.length : i;
  out.splice(at, 0, { lat: point.lat, lon: point.lon });
  return out;
}

/** A route record ready for the store. */
export function makeRoute({ id, name, waypoints, now = Date.now() }) {
  return {
    id,
    name: String(name ?? '').trim() || 'Untitled route',
    waypoints: (waypoints ?? []).map((p) => ({ lat: p.lat, lon: p.lon })),
    km: routeDistanceKm(waypoints),
    createdAt: now,
    updatedAt: now,
  };
}

/** Validate a route record from a backup. Returns problem strings. */
export function validateRoute(r, label = 'route') {
  const errs = [];
  if (!r || typeof r !== 'object') return [`${label}: not an object`];
  if (typeof r.id !== 'string' || !r.id) errs.push(`${label}: missing id`);
  if (!Array.isArray(r.waypoints)) errs.push(`${label}: waypoints must be an array`);
  else if (r.waypoints.some((p) => !Number.isFinite(p?.lat) || !Number.isFinite(p?.lon))) {
    errs.push(`${label}: a waypoint has no usable coordinates`);
  }
  return errs;
}
