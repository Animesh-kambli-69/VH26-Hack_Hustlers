# ShopVerse Adaptive Cache — System Architecture

Architecture of the system as built in this repository. The implementation lives in
[`ecom/`](ecom/) (the ShopVerse full-stack app) — Phase 1 is the cache-less e-commerce app,
Phase 2 adds an **application-aware adaptive cache engine** plus its control plane.

Companion artifacts:

| File | What it is |
| --- | --- |
| `PRD.md` | Product requirement document (v2.0.0, ShopVerse-mapped) |
| `shopverse-adaptive-cache-architecture.svg` | Static architecture diagram (one picture of this doc) |
| `adaptive-cache-flowchart.html` | Interactive flowchart: read path, write path, observability loop |
| `ecom/README.md` | Base-project README (Phase 1 feature surface) |

---

## 1. System at a glance

```
React client (JSX, Vite)            Express API (server/src)
┌──────────────────────────┐        ┌────────────────────────────────────────────────┐
│ Home / Product / Cart /  │  /api/*│  routes/ → controllers/ (thin)                  │
│ Checkout / Orders        │──proxy─▶│        │                                       │
│                          │        │        ▼                                       │
│ Cache Dashboard (admin)  │◀─SSE───│  ┌───────────────────────────────────────┐     │
│ /admin/cache-dashboard   │        │  │  Adaptive Cache Engine                │     │
└──────────────────────────┘        │  │  U = ((Ĉ_lat·wL + Ĉ_$·wM)·log(1+F))   │     │
                                    │  │       / Size · e^(−λΔt)               │     │
                                    │  │  policies: adaptive · gdsf · no-cache │     │
                                    │  └───────────────────┬───────────────────┘     │
                                    │  wrapped services    ▼                         │
                                    │  productService · orderService                 │
                                    └──────────────────────┬─────────────────────────┘
                                                           ▼
                                      data/products.js (catalog) · db/fileDb.js (orders)
```

- **Request path:** browser → Vite dev proxy → Express routes → controllers → **cache-aware
  services** → data (only on a miss).
- **Observability path:** engine → SSE `/api/cache/stream` → cache dashboard; dashboard →
  `POST /api/cache/config | simulate | reset` back into the engine.
- **Control plane:** `/api/cache/*` endpoints expose stats, config, evictions, simulation and a
  live event stream. Everything in that column is additive — the Phase 1 API is untouched.

---

## 2. Layers and responsibilities

| Layer | Location | Responsibility |
| --- | --- | --- |
| Client | `ecom/client/` | React 18 pages; cart/wishlist in `localStorage`; talks only to `/api/*` |
| Web server | Express `app.js` | Mounts routers, JSON body parsing, `/api/health`, 404 + error handlers |
| Routes / controllers | `routes/*`, `controllers/*` | Thin: parse request → call one service → shape response |
| **Cache engine** | `server/src/services/cache/` | Utility scoring, eviction, admission, policies, metrics, SSE, advisor |
| Services | `productService.js`, `orderService.js` | Business rules; **now cache-first** (the insertion point) |
| Data | `data/products.js`, `db/fileDb.js` | In-memory catalog + demo JSON order store (read on miss only) |

---

## 3. Runtime flows

### 3.1 Read path (every GET through a cached service)

1. Service builds a **cache key**, e.g. `products:list:all:any:price-asc` or `product:detail:3`.
2. `cacheManager.get(key)` fans the lookup out to **every policy** (adaptive, gdsf, no-cache);
   only the mode-selected (active) policy's entry is returned to the caller.
   - **Hit** → entry returned; the manager records `costLatency − 2 ms` saved and `costMoney`
     avoided in a rolling window + lifetime totals.
   - **Miss** → returns `undefined`; service runs the unchanged Phase 1 computation.
3. Service stores via `cacheManager.set(key, value, meta)` — `meta` is the cost-model record
   `{ type, sizeMB, costLatency, costMoney, ttlSeconds }`. The manager counts the miss cost,
   then hands the entry to every policy. The engine may **reject** it (admission filter) or
   evict another entry to make room.
4. Return value to the controller. Cached values are plain JSON — byte-identical to fresh ones
   (verified in testing).

### 3.2 Write path (`POST /api/orders` and friends)

Writes are **never cached** — checkout is the most expensive operation and must always run.
Writes are instead the *invalidation triggers*:

| Write | Invalidations fired |
| --- | --- |
| `createOrder` (stock decrement) | `product:detail:{id}` per purchased item + `products:list:*` (from `decrementStock`), `orders:customer:{customerId}` |
| `cancelOrder` (restock) | `product:detail:{id}` + `products:list:*` (from `restock`), `orders:customer:*`, `orders:detail:{id}` |
| `advanceOrderStatus` | `orders:customer:*`, `orders:detail:{id}` |

Invalidation runs against **all policies** so the shadow comparison never serves stale data
either.

### 3.3 `no-cache` mode

`CACHE_MODE=no-cache` is an exact Phase 1 passthrough: nothing is stored, every read is a miss.
The manager still counts each miss and its recompute cost — that "what it costs today" baseline
is what the cost advisor and the hit-rate comparison chart against.

---

## 4. The adaptive cache engine

Lives in `server/src/services/cache/`. The **manager singleton** (`manager.js`) is the single
entry point services talk to; it owns config, all policy instances, the rolling window, the
event ring, and SSE subscribers.

### 4.1 Utility score (as specced — matches the formula image)

```
U = ((Normalized Latency · w_L + Normalized Cost · w_M) · log(1 + F)) / Size · e^(−λΔt)
```

Implemented in `utility.js` as `computeUtility(entry, cfg, now, ageFactor)`:

| Term | Meaning | ShopVerse ranges |
| --- | --- | --- |
| `Normalized Latency` | `(costLatency − 5) / (800 − 5)`, clamped 0–1 | catalog 12 ms ≈ 0.009 … checkout 800 ms = 1.0 |
| `Normalized Cost` | `(costMoney − 0.00002) / (0.008 − 0.00002)`, clamped 0–1 | category $0.00002 = 0.0 … checkout $0.008 = 1.0 |
| `w_L`, `w_M` | live-tunable weights (default 1, 1) | clamped 0–10 via config |
| `F` | decayed frequency, `F = 0.99·F + 1` per hit | asymptotes ≈ 100 for a hot key |
| `S` | modeled response size in MB | 0.05 (categories) … 1.5 (long search) |
| `e^(−λΔt)` | recency decay over idle seconds since `lastAccess`; λ default 0.01, tunable 0–0.1 | the *SHIFT* scenario's aging mechanism |

Result: cheap-to-recompute CATALOG rows score low (~0.29 at F=100) and are evicted first;
expensive SEARCH/DETAIL score high (~1.5) and survive. Normalization matters because ShopVerse
costs span ~800× latency and ~400× money heterogeneity.

### 4.2 Data structures: `Map` + binary min-heap with lazy deletion

- The `Map` (key → entry) is the source of truth; the heap holds `{key, stamp, u}` nodes.
- Every mutation re-pushes the entry's node with a fresh **stamp**; superseded heap nodes are
  skipped lazily when popped — no O(N) rescans, eviction is O(log N).
- Utility order can drift (weights/λ changed, freq bumped, idle decay) — when a popped node's
  stored `u` no longer matches a fresh `computeUtility`, the node is re-scored and restored
  instead of evicted.
- Expired entries encountered during the sweep are dropped and reported as `expire` events.

### 4.3 Entry metadata

```js
{ key, value, type,            // CATALOG | SEARCH | DETAIL | ORDER | CATEGORY
  sizeMB, costLatency, costMoney, ttlSeconds,   // cost-model record
  freq, lastAccess, createdAt, utility, stamp }
```

### 4.4 Admission filter (probation + value gate, S3-FIFO flavor)

A brand-new entry never directly displaces a proven one:

1. Newcomers (freq < 2) live in a **probation layer** and may cycle through it freely —
   one-hit wonders and new demand alike get a trial.
2. If probation is empty and the cache is full, a newcomer must **out-value the cheapest
   proven entry** or it is rejected (`reject` event) — a one-off cheap catalog read can never
   dislodge an expensive, popular detail/search result.
3. `admission: false` disables the value gate (evict unconditionally) for comparison runs.

This is the mechanism that made BBD_SPIKE behave: adaptive saved the most money with a tiny
number of evictions while GDSF churned.

### 4.5 Frequency, decay, TTL

- `F = 0.99·F + 1` per hit prevents one viral key from exploding log(1+F) into a blocker.
- Idle time ages utility via `e^(−λΔt)` — recency matters only on access, so a key that stops
  being requested stops growing and ages toward victim status (LFU-style pollution is avoided).
- TTLs (per type) bound absolute staleness independently of scoring.
- The workload simulator feeds the engine a fake clock + `ageFactor` so decay/TTL behavior is
  observable in short runs (SHIFT runs at 60× time).

### 4.6 Policy set: adaptive (active) · gdsf (shadow) · no-cache

The manager **fans every read and write out to all three policies simultaneously**, so the
dashboard compares hit rate / ₹ saved / evictions on *identical traffic*:

| Policy | Role | Notes |
| --- | --- | --- |
| `adaptive` | active default | the utility engine above |
| `gdsf` | shadow baseline | Greedy-Dual Size Frequency — cost-aware, but λ = 0, no admission filter, linear-scan eviction |
| `no-cache` | counter | 0% hit rate baseline; what Phase 1 costs |

Only the active policy's hits count toward latency/₹ savings; `mode` switches the active policy
live (`adaptive` → `gdsf` → `no-cache` → back) and no-cache stops storage entirely. LRU and LFU
baselines were removed from the build after earlier benchmarking.

### 4.7 Live configuration

`POST /api/cache/config` merges a patch with clamping/validation (`config.js`): mode enum,
`capacityMB` 1–150, `wL`/`wM` 0–10, `lambda` 0–0.1, `admission` bool. On a weights/λ change
every live entry is re-scored and the heap rebuilt; capacity drains evict lowest-utility
entries first.

---

## 5. Cost model and cache keys (where services were wrapped)

`costModel.js` maps endpoint → type. `productService.listProducts` refines the record by query
(a text search is filter + scan + sort, priced as SEARCH; a bare sort as a heavier CATALOG).

| Endpoint | Cache key | Type | Size | Latency | Cost | TTL |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/products` (plain) | `products:list:{cat}:{q}:{sort}` | CATALOG | 0.2 MB | 12 ms | $0.00005 | 300 s |
| `GET /api/products?search=` | same key | SEARCH | 0.8–1.5 MB | 150–300 ms | $0.001 | 300 s |
| `GET /api/products?sort=` only | same key | CATALOG | 0.3 MB | 25 ms | $0.00005 | 300 s |
| `GET /api/products/:id` | `product:detail:{id}` | DETAIL | 0.6 MB | 110 ms | $0.0005 | 120 s |
| `GET /api/categories` | `categories:list` | CATEGORY | 0.05 MB | 5 ms | $0.00002 | 600 s |
| `GET /api/orders?customerId=` | `orders:customer:{customerId}` | ORDER | 0.3–1.5 MB | 60 ms | $0.0003 | 30 s |
| `GET /api/orders/:id` | `orders:detail:{id}` | ORDER | 0.15 MB | 25 ms | $0.0003 | 30 s |
| `POST /api/orders` | — (never cached) | — | 400–800 ms, $0.008 | | | invalidates instead |

Notes from the real code:

- Categories live in **`productService.listCategories`** (no separate `categoryService.js`),
  served by `routes/categories.js`.
- `getProduct` only caches when the product exists; nulls are not cached.
- Cache keys normalize their parameters (`all`/`any` fallbacks, lowercased, trimmed) so
  equivalent requests collide on one key.
- All rows are invalidated by the write paths in §3.2. TTLs: catalog 5 min, detail 2 min,
  categories 10 min, order history 30 s.

---

## 6. Control plane — `/api/cache/*`

Mounted in `app.js`; thin controllers in `cacheController.js`:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/cache/stats` | Full snapshot: config, active mode, per-policy stats, rolling window, totals, advisor |
| `GET /api/cache/config` | Current config |
| `POST /api/cache/config` | Live update (`wL`, `wM`, `λ`, capacity, mode, admission) — 400 on invalid input |
| `POST /api/cache/reset` | Clear all policies, events, totals and window |
| `GET /api/cache/evictions` | Last N evict/expire/reject/invalidate events (ring buffer, cap 500) |
| `GET /api/cache/stream` | **SSE**: `hello` + snapshot on connect, 1 s `tick` snapshots, `event` lifecycle records, `simulation` reports |
| `POST /api/cache/simulate` | Run a synthetic workload through every policy; publishes + returns the report |

The snapshot shape the dashboard will consume: `{ t, config, activeMode, policies[],
window{…}, totals{requests, savedLatencyMs, savedUsd, missCostUsd}, advisor }`.

---

## 7. Workload simulator (`workload.js`)

Synthetic traffic — not real users. Generates Zipfian key popularity (rank r weighted
`1/(r+1)^α`) with Poisson (exponential inter-arrival) timing, and replays the **same stream**
through every policy on fresh instances with a simulated clock so results are comparable.

| Scenario | What it tests |
| --- | --- |
| `NORMAL` | Steady Tuesday mix — catalog 40 / detail 25 / search 20 / orders 15 |
| `BBD_SPIKE` | Big Billion Day 10× burst aimed at expensive keys (detail 45 / search 35, hot-product Zipf α=2.2) |
| `SHIFT` | Diwali → Christmas — the hot set moves mid-run at 60× time-scale (exercises λ decay + TTL) |
| `COLD_START` | Flood of unique one-hit-wonder searches (85% unique) — exercises the admission filter |

Report per policy: hits/misses/hit rate, p50/p95/p99 latency (hit = 2 ms, miss = modeled
`costLatency`), latency saved, $ saved (×83 = ₹), entries/size, evictions/expirations/
rejections, and evicted-by-type — plus a no-cache baseline cost.

---

## 8. Metrics, savings, and the cost advisor

- **Hit rate** = active-policy hits / requests over the rolling 60 × 1 s window and lifetime.
- **Latency saved** = `costLatency − 2 ms` (2 ms = modeled cache-serve overhead) per hit.
- **Money saved** = the entry's `costMoney` per hit — i.e. the recompute cost a hit avoided.
- **Eviction feed** = every evict / expire / reject / invalidate with key, type, size, cost,
  freq, utility — the "keeps purple DETAIL/SEARCH, evicts cheap cyan CATALOG" story.
- **Cost advisor** (`costAdvisor.js`, simulated only — no real scaling): extrapolates the
  window's miss cost to $/hr, assumes +100 MB turns half of those misses into hits
  (`ASSUMED_HIT_GAIN = 0.5`), compares against a modeled node price ($0.15/hr) and returns
  `COLD | OK | SCALE_UP` with an ROI multiple, e.g. "If +100MB → save ~$X/hr, node $0.15/hr →
  ROI n×".

Verified numbers from this workspace (post LRU/LFU removal): micro-benchmark (90% DETAIL +
10% CATALOG against a 0.6 MB cache) — **adaptive 89.8% hit rate with 1 eviction** vs GDSF's 50;
a 2 s NORMAL sim shows all three policies within a point of hit rate while adaptive displaced
far fewer entries than GDSF at equal cost savings. (Earlier full BBD_SPIKE benchmarks that
included LRU/LFU baselines — adaptive saved the most $ with the fewest evictions — are
historical; those baselines are removed from the build.)

---

## 9. File map

```
ecom/server/src/services/cache/      # Phase 2 engine (new)
├── manager.js                       # singleton hub: config, fan-out, window, events, SSE
├── adaptiveCache.js                 # utility policy: heap, admission, probation, value gate
├── gdsfCache.js                     # GDSF shadow baseline
├── noopCache.js                     # no-cache counter baseline
├── utility.js                       # U = ((Ĉ_lat·wL + Ĉ_$·wM)·log(1+F))/S·e^(−λΔt)
├── config.js                        # env defaults + live-config validation/clamping
├── costModel.js                     # type table, TTLs, ₹ conversion
├── costAdvisor.js                   # simulated auto-scaler
└── workload.js                      # Zipf + Poisson simulator, 4 scenarios

ecom/server/src/
├── services/productService.js       # wrapped: listProducts / getProduct / listCategories
├── services/orderService.js         # wrapped: listOrders / getOrder / create / cancel / advance
├── routes/cache.js                  # /api/cache/* router
├── controllers/cacheController.js   # stats/config/reset/evictions/stream/simulate
├── app.js                           # mounts /api/cache (+ existing routers)
└── .env.example                     # CACHE_MODE / capacity / weights / λ documented

ecom/server/scripts/microbench.mjs   # adaptive-vs-GDSF retention micro-benchmark
```

---

## 10. Operations

```bash
cd ecom && npm run install:all && npm run dev   # API :3001 + web :5173 (concurrently)
curl localhost:3001/api/cache/stats             # engine live
curl -X POST localhost:3001/api/cache/simulate \
     -H 'Content-Type: application/json' -d '{"scenario":"BBD_SPIKE"}'
```

Environment (`server/.env`, real env vars win): `PORT`, `HOST`, `NODE_ENV`, and cache overrides
`CACHE_MODE=adaptive|gdsf|no-cache`, `CACHE_CAPACITY_MB`, `CACHE_W_LAT`, `CACHE_W_MONEY`,
`CACHE_LAMBDA`. Docker: `ecom/server/Dockerfile` builds the API alone (`npm ci --omit=dev`,
runs as unprivileged `node`, `VOLUME /app/data` for `orders.json`, `HEALTHCHECK` on
`/api/health`); build from `ecom/server/` with `.dockerignore` keeping secrets/state out.

---

## 11. Deliberate boundaries (honest gaps)

| Gap | Why / plan |
| --- | --- |
| Cost, latency and size are **modeled metadata**, not wall-clock measurements | Required for the demo story; the advisor/savings math is simulator truth, not production billing |
| Store is **in-memory per instance** | Hackathon scope — fine for one process; multi-instance needs shared Redis (interface is Redis-ready, `REDIS_URL` placeholder exists) + a real DB in place of `fileDb.js` |
| No **single-flight** lock or **stale-while-revalidate** (PRD §3.6) | Would be dead code while the sim is synchronous; natural next phase |
| Dashboard UI (`/admin/cache-dashboard`) not built yet | The SSE contract (§6) is finalized so the React/Recharts page is a pure client build |
| Only GDSF + no-cache remain as comparison baselines | LRU/LFU removed from the build after earlier benchmarking (per project decision) |
| Frequency/λ aging is per-process and event-driven | Consistent with the per-instance store |

Everything else in the PRD's functional requirements — utility scoring with normalized ranges,
heap-based O(log N) eviction, live weight/λ tuning, the four cache modes (as adaptive /
gdsf / no-cache), service-layer insertion with invalidation, the workload generator with four
scenarios, and the SSE observability contract — is implemented and verified in `ecom/`.
