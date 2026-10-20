'use strict';
// Transaction serialization in this test adapter models Firestore's retry-on-conflict behavior.
class Database {
  constructor() { this.rows = new Map(); this.tail = Promise.resolve(); }
  doc(path) { return new Ref(this, path); }
  collection(path) { return new Query(this, path); }
  async runTransaction(fn) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    const writes = [];
    const tx = { get: target => target.get(), set: (ref, value, options) => writes.push(() => ref.set(value, options)),
      update: (ref, value) => writes.push(() => ref.set(value, { merge: true })),
      create: (ref, value) => writes.push(() => { if (this.rows.has(ref.path)) throw new Error('ALREADY_EXISTS'); return ref.set(value); }) };
    try { const result = await fn(tx); for (const write of writes) await write(); return result; }
    finally { release(); }
  }
}
class Ref {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split('/').at(-1); }
  async get() {
    const value = this.db.rows.get(this.path);
    return { id: this.id, exists: value !== undefined, data: () => value };
  }
  async set(value, options) { this.db.rows.set(this.path, options?.merge ? { ...this.db.rows.get(this.path), ...value } : value); }
}
class Query {
  constructor(db, path, filters = [], max = Infinity, after = null) { Object.assign(this, { db, path, filters, max, after }); }
  doc(id) { return new Ref(this.db, `${this.path}/${id}`); }
  where(field, op, value) { return new Query(this.db, this.path, [...this.filters, [field, op, value]], this.max, this.after); }
  orderBy() { return this; }
  limit(max) { return new Query(this.db, this.path, this.filters, max, this.after); }
  startAfter(after) { return new Query(this.db, this.path, this.filters, this.max, after.id || after); }
  async get() {
    const docs = [];
    for (const [path, value] of [...this.db.rows].sort()) {
      if (!path.startsWith(this.path + '/') || path.split('/').length !== this.path.split('/').length + 1) continue;
      const id = path.split('/').at(-1);
      if (this.after && id <= this.after) continue;
      if (!this.filters.every(([f, op, v]) => op === '==' ? value[f] === v : value[f] >= v)) continue;
      docs.push({ id, exists: true, data: () => value });
    }
    const result = docs.slice(0, this.max);
    return { docs: result, size: result.length, empty: !result.length };
  }
}
module.exports = { Database };
