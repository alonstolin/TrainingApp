/**
 * Minimal promise wrapper over IndexedDB.
 *
 * IndexedDB rather than localStorage because: ~15k sets over three years is
 * roughly 2MB, uncomfortably close to Safari's ~5MB localStorage cap; and
 * localStorage is synchronous, so every write would parse and re-stringify the
 * entire history on the main thread — mid-set, on a phone.
 *
 * Granularity is one record per SESSION (~2–4KB), not one per set and not one
 * giant blob. Small atomic writes, no index gymnastics.
 */

const DB_NAME = 'training-app';
const DB_VERSION = 1;

export const STORES = {
  sessions: 'sessions',
  meta: 'meta',
  backups: 'backups',
};

let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.sessions)) {
        const store = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('kind', 'kind', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.backups)) {
        db.createObjectStore(STORES.backups, { keyPath: 'id' });
      }
      void ev;
    };

    req.onsuccess = () => {
      const db = req.result;
      // A second tab requesting a version bump must not be blocked forever.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });

  return dbPromise;
}

function tx(db, storeNames, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeNames, mode);
    let result;
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
    result = fn(t);
  });
}

const wrap = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function getAll(storeName) {
  const db = await openDb();
  const t = db.transaction([storeName], 'readonly');
  return wrap(t.objectStore(storeName).getAll()).then((r) => r ?? []);
}

export async function put(storeName, value) {
  const db = await openDb();
  return tx(db, [storeName], 'readwrite', (t) => t.objectStore(storeName).put(value));
}

export async function putMany(storeName, values) {
  const db = await openDb();
  return tx(db, [storeName], 'readwrite', (t) => {
    const store = t.objectStore(storeName);
    for (const v of values) store.put(v);
  });
}

export async function del(storeName, key) {
  const db = await openDb();
  return tx(db, [storeName], 'readwrite', (t) => t.objectStore(storeName).delete(key));
}

export async function clear(storeName) {
  const db = await openDb();
  return tx(db, [storeName], 'readwrite', (t) => t.objectStore(storeName).clear());
}

export async function get(storeName, key) {
  const db = await openDb();
  const t = db.transaction([storeName], 'readonly');
  return wrap(t.objectStore(storeName).get(key));
}

/** Replace an entire store's contents atomically — used by "replace" imports. */
export async function replaceAll(storeName, values) {
  const db = await openDb();
  return tx(db, [storeName], 'readwrite', (t) => {
    const store = t.objectStore(storeName);
    store.clear();
    for (const v of values) store.put(v);
  });
}

/**
 * Ask the browser to protect this origin from eviction under storage pressure.
 * Called on EVERY launch, not once: Safari grants heuristically (and favours
 * home-screen web apps), and the grant is not reliably sticky.
 */
export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return { supported: false, persisted: false };
    const already = await navigator.storage.persisted?.();
    const persisted = already || (await navigator.storage.persist());
    return { supported: true, persisted };
  } catch {
    return { supported: false, persisted: false };
  }
}

export async function storageEstimate() {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/** Nuclear option, exposed in Settings. Never called automatically. */
export async function wipeAll() {
  await Promise.all([clear(STORES.sessions), clear(STORES.meta), clear(STORES.backups)]);
}
