import fs from 'node:fs';
import path from 'node:path';
import { ORDERS_FILE } from '../config.js';

// ---------------------------------------------------------------------------
// Tiny JSON-file store, for demo purposes only.
//
// This is the single point that gets replaced by a real database in phase 2
// (a scaling prerequisite). Nothing else in the app knows orders are stored
// in a file — they flow through orderService only.
// ---------------------------------------------------------------------------

function readAll() {
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeAll(orders) {
  fs.mkdirSync(path.dirname(ORDERS_FILE), { recursive: true });
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export const fileDb = {
  all: readAll,
  get: (id) => readAll().find((o) => o.id === id) || null,
  push: (order) => {
    const orders = readAll();
    orders.push(order);
    writeAll(orders);
    return order;
  },
  // Applies `mutate(order)` to the stored order with `id` and persists it.
  // Returns the updated order, or null when no such order exists.
  update: (id, mutate) => {
    const orders = readAll();
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return null;
    const updated = mutate(orders[index]);
    orders[index] = updated;
    writeAll(orders);
    return updated;
  },
};
