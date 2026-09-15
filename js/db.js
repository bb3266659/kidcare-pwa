const DB_NAME = 'kidcare-db';
const DB_VERSION = 1;
export const STORES = ['profile', 'episodes', 'logs', 'growth'];

let _db = null;

export function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('profile'))
        db.createObjectStore('profile', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('episodes')) {
        const s = db.createObjectStore('episodes', { keyPath: 'id', autoIncrement: true });
        s.createIndex('status', 'status');
        s.createIndex('startDate', 'startDate');
      }
      if (!db.objectStoreNames.contains('logs')) {
        const s = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
        s.createIndex('episodeId', 'episodeId');
        s.createIndex('at', 'at');
      }
      if (!db.objectStoreNames.contains('growth')) {
        const s = db.createObjectStore('growth', { keyPath: 'id', autoIncrement: true });
        s.createIndex('type', 'type');
        s.createIndex('date', 'date');
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode = 'readonly') {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}
const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const put    = (store, value) => tx(store, 'readwrite').then((s) => wrap(s.put(value)));
export const get    = (store, key)   => tx(store).then((s) => wrap(s.get(key)));
export const all    = (store)        => tx(store).then((s) => wrap(s.getAll()));
export const remove = (store, key)   => tx(store, 'readwrite').then((s) => wrap(s.delete(key)));
export const clear  = (store)        => tx(store, 'readwrite').then((s) => wrap(s.clear()));

export const byIndex = (store, index, value) =>
  tx(store).then((s) => wrap(s.index(index).getAll(value)));

/* ---------- Backup / Restore ---------- */
export async function exportAll() {
  const data = { app: 'kidcare', version: DB_VERSION, exportedAt: new Date().toISOString(), stores: {} };
  for (const s of STORES) data.stores[s] = await all(s);
  return data;
}

export async function importAll(data, { replace = true } = {}) {
  if (!data || data.app !== 'kidcare') throw new Error('ไฟล์สำรองไม่ถูกต้อง');
  for (const s of STORES) {
    if (replace) await clear(s);
    for (const row of data.stores[s] || []) {
      if (replace) await put(s, row);
      else { const { id, ...rest } = row; await put(s, s === 'profile' ? row : rest); }
    }
  }
}