/**
 * RunTracker IndexedDB Storage Layer
 * Provides unlimited-capacity client storage for full-fidelity GPS paths and offline backups.
 */

const DB_NAME = 'runtracker_idb_v1';
const DB_VERSION = 1;
const STORE_RUNS = 'runs';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_RUNS)) {
        db.createObjectStore(STORE_RUNS, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export const IDBService = {
  async saveRun(record) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RUNS, 'readwrite');
        const store = tx.objectStore(STORE_RUNS);
        const req = store.put(record);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB saveRun fallback:', e);
      return false;
    }
  },

  async getAllRuns() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RUNS, 'readonly');
        const store = tx.objectStore(STORE_RUNS);
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB getAllRuns fallback:', e);
      return [];
    }
  },

  async deleteRun(id) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_RUNS, 'readwrite');
        const store = tx.objectStore(STORE_RUNS);
        const req = store.delete(id);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('IndexedDB deleteRun fallback:', e);
      return false;
    }
  }
};
