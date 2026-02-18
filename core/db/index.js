// core/db/index.js — DAL wrapper (adapter pattern)
import { IndexedDBAdapter } from "./indexeddbAdapter.js";
import { ensureSeed } from "./seed.js";

export class DB {
  constructor() {
    this.adapter = new IndexedDBAdapter("farmapp_core_v1_1", 1);
  }

  async init() {
    await this.adapter.init();
    await ensureSeed(this);
    return true;
  }

  get(key) { return this.adapter.get(key); }
  set(key, value) { return this.adapter.set(key, value); }

  async transaction(fn) {
    const db = await this.get("db");
    const draft = structuredClone(db || {});
    const out = await fn(draft);
    draft.updatedAt = new Date().toISOString();
    await this.set("db", draft);
    return out;
  }
}
