import type { StateStorage } from 'zustand/middleware';

const DB = 'escape-studio';
const STORE = 'kv';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  return dbp;
}

const timers = new Map<string, number>();

/** Autosave storage: large projects (images) don't fit localStorage's 5MB limit. */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    try {
      const db = await open();
      return await new Promise<string | null>((res) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(name);
        r.onsuccess = () => res(typeof r.result === 'string' ? r.result : null);
        r.onerror = () => res(null);
      });
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    window.clearTimeout(timers.get(name));
    timers.set(
      name,
      window.setTimeout(async () => {
        try {
          const db = await open();
          db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, name);
        } catch (e) {
          console.warn('Autosave failed', e);
        }
      }, 300)
    );
  },
  removeItem: async (name) => {
    try {
      const db = await open();
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(name);
    } catch {
      /* ignore */
    }
  },
};
