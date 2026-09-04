// ---------------------------------------------------------------------------
// ShopVerse cost model (PRD §3.1/§3.2): endpoint → cache type mapping.
//
// Every cacheable response carries a small metadata record describing how
// expensive it is to recompute (latency ms, money $) and how large it is
// (modeled MB). These are the numbers the utility engine and the cost
// advisor work from, not real wall-clock timings.
// ---------------------------------------------------------------------------

export const USD_TO_INR = 83;

// Cache types shown on the dashboard memory chart (cyan catalog first to be
// evicted, purple/amber expensive entries retained).
export const TYPE_COSTS = {
  // GET /api/products without search — cheap scan of the in-memory catalog.
  CATALOG: { sizeMB: 0.2, costLatency: 12, costMoney: 0.00005, ttlSeconds: 300 },
  // GET /api/products?search=…&sort=… — filter + text scan + sort.
  SEARCH: { sizeMB: 1.0, costLatency: 180, costMoney: 0.001, ttlSeconds: 300 },
  // GET /api/products/:id (+ related products) — lookup + similarity calc.
  DETAIL: { sizeMB: 0.6, costLatency: 110, costMoney: 0.0005, ttlSeconds: 120 },
  // GET /api/orders?customerId= — fileDb read + sort + defaults.
  ORDER: { sizeMB: 0.5, costLatency: 60, costMoney: 0.0003, ttlSeconds: 30 },
  // GET /api/categories — tiny, near-free; longest TTL.
  CATEGORY: { sizeMB: 0.05, costLatency: 5, costMoney: 0.00002, ttlSeconds: 600 },
};

// Deep-copies TYPE_COSTS[type] merged with caller overrides so callers can
// scale size/cost by query parameters (longer search → bigger response).
export function metaFor(type, overrides = {}) {
  const base = TYPE_COSTS[type];
  if (!base) throw new Error(`Unknown cache type "${type}"`);
  return { type, ...base, ...overrides };
}

export function inr(usd) {
  return usd * USD_TO_INR;
}

export function fmtINR(usd) {
  const v = inr(usd);
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(2)}L`;
  return `₹${v.toFixed(2)}`;
}
