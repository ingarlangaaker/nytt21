// core/db/indexeddbAdapter.js — tiny adapter, no deps
export class IndexedDBAdapter {
  constructor(dbName, version) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      };
      req.onsuccess = () => { this.db = req.result; resolve(true); };
      req.onerror = () => reject(req.error);
    });
  }

  get(key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("kv", "readonly");
      const store = tx.objectStore("kv");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  set(key, value) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("kv", "readwrite");
      const store = tx.objectStore("kv");
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }
}
