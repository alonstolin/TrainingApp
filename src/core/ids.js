/**
 * Monotonic, lexicographically-sortable ids (ULID-shaped, simplified).
 *
 * Timestamp prefix means sorting ids sorts by creation time, and the counter
 * guarantees uniqueness even for ids minted within the same millisecond — which
 * happens constantly when logging sets quickly.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no I/L/O/U
let lastTime = 0;
let counter = 0;

function encodeTime(ms, len = 10) {
  let out = '';
  let t = ms;
  for (let i = 0; i < len; i++) {
    out = ALPHABET[t % 32] + out;
    t = Math.floor(t / 32);
  }
  return out;
}

function randomChars(len) {
  const g = globalThis.crypto;
  if (g?.getRandomValues) {
    const bytes = new Uint8Array(len);
    g.getRandomValues(bytes);
    return Array.from(bytes, (b) => ALPHABET[b % 32]).join('');
  }
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * 32)];
  return out;
}

export function newId(prefix = '') {
  const now = Date.now();
  if (now === lastTime) counter++;
  else {
    lastTime = now;
    counter = 0;
  }
  const id = `${encodeTime(now)}${encodeTime(counter, 2)}${randomChars(6)}`;
  return prefix ? `${prefix}-${id}` : id;
}
