/**
 * Date helpers. DOM-free.
 *
 * HARD RULES:
 *  - Every date in stored data is a LOCAL calendar date string, 'YYYY-MM-DD'.
 *  - NEVER use `new Date('2026-08-17')`. That parses as UTC midnight and shifts
 *    the day backwards in any timezone west of Greenwich. Use parseLocalDate().
 *  - The training day rolls over at 03:00 local, so a 00:30 session logs to the
 *    previous day where it belongs.
 */

export const DAY_BOUNDARY_HOUR = 3;

const pad = (n) => String(n).padStart(2, '0');

/** Date object → 'YYYY-MM-DD' in LOCAL time. */
export function toLocalDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYY-MM-DD' → Date at LOCAL midnight. */
export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * The training day for a given instant, applying the 03:00 rollover.
 * A workout finished at 00:30 Saturday belongs to Friday.
 */
export function trainingDate(now = new Date()) {
  const d = new Date(now.getTime());
  if (d.getHours() < DAY_BOUNDARY_HOUR) d.setDate(d.getDate() - 1);
  return toLocalDate(d);
}

/** Day of week for a local date string. 0 = Sunday, matching Date#getDay(). */
export function dayOfWeek(dateStr) {
  return parseLocalDate(dateStr).getDay();
}

export function addDays(dateStr, n) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + n);
  return toLocalDate(d);
}

/**
 * Whole days from a → b. Computed on calendar dates via UTC noon anchors so that
 * DST transitions (a 23- or 25-hour day) can never produce an off-by-one.
 */
export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ua = Date.UTC(ay, am - 1, ad, 12);
  const ub = Date.UTC(by, bm - 1, bd, 12);
  return Math.round((ub - ua) / 86400000);
}

/** Monday-anchored start of the ISO week containing `dateStr`. */
export function startOfWeek(dateStr) {
  const d = parseLocalDate(dateStr);
  const dow = d.getDay(); // 0=Sun
  const back = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - back);
  return toLocalDate(d);
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayName = (dateStr) => DAY_NAMES[dayOfWeek(dateStr)];

/** '17 Aug' / '17 Aug 2025' when the year differs from today's. */
export function formatDate(dateStr, today = trainingDate()) {
  const d = parseLocalDate(dateStr);
  const sameYear = d.getFullYear() === parseLocalDate(today).getFullYear();
  return sameYear
    ? `${d.getDate()} ${MONTHS[d.getMonth()]}`
    : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'Today' / 'Yesterday' / 'Wed 13 Aug'. */
export function formatRelativeDate(dateStr, today = trainingDate()) {
  const diff = daysBetween(dateStr, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  return `${dayName(dateStr)} ${formatDate(dateStr, today)}`;
}

/** Seconds → '5:03' or '1:05:03'. */
export function formatDuration(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Seconds → '35 min' / '1h 05m', for prescriptions rather than clocks. */
export function formatMinutes(totalSec) {
  const m = Math.round(totalSec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${pad(m % 60)}m` : `${m} min`;
}
