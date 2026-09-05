# ShopVerse CAAC API Traffic Generator

A real HTTP traffic generator that exercises the **Cost-Aware Adaptive Cache (CAAC)**
engine of the ShopVerse backend and reports how the cache behaved — using only the
backend's real telemetry. Nothing here fabricates metrics.

```
tests/api-traffic/
├── traffic-generator.js   # CLI entry point
├── config.js              # CLI parsing, defaults, help
├── lib/
│   ├── request.js         # fetch wrapper (timeouts, status, cache.hit extraction)
│   ├── patterns.js        # request-plan generators for patterns A–H
│   ├── analytics.js       # /api/analytics/stats + /api/analytics/weights, diffs
│   └── report.js          # ASCII test report
└── README.md
```

---

## 1. Prerequisites

1. **PostgreSQL** reachable (the backend's `DATABASE_URL`, possibly remote).
2. **Redis** reachable (the backend's `REDIS_URL`).
3. **Backend running** on port 3000:

   ```bash
   npm run dev        # nodemon (auto-restarts on file changes)
   # or, for a stable process that never auto-restarts:
   PORT=3000 node src/server.js
   ```

   > The generator talks only to the backend over HTTP — start it first, then run
   > the generator in a second terminal.

4. **Analytics endpoints** must exist (they are read-only aggregations over the
   cache metric/decision tables):

   ```bash
   curl http://localhost:3000/api/analytics/stats
   curl http://localhost:3000/api/analytics/weights
   ```

## 2. Running the generator

```bash
cd tests/api-traffic
node traffic-generator.js --pattern repeated --requests 40
node traffic-generator.js --pattern mixed --duration 120 --rate 10 --concurrency 5
node traffic-generator.js --pattern burst
```

### CLI arguments

| Flag | Default | Meaning |
| --- | --- | --- |
| `--pattern <name>` | `mixed` | One of the patterns below |
| `--requests <n>` | per pattern | Total requests to send |
| `--duration <sec>` | – | Run `rate × duration` requests |
| `--rate <rps>` | 5 | Request **start** rate (0 = as fast as possible) |
| `--concurrency <n>` | 3 | Max in-flight requests |
| `--base-url <url>` | `http://localhost:3000` | Backend base URL (or `SHOPVERSE_BASE_URL`) |
| `--timeout <ms>` | 20000 | Per-request timeout |
| `--monitor-interval <n>` | 20 | Print live analytics every N requests |
| `--token <jwt>` | – | Bearer token (enables expensive endpoints) |
| `--include-expensive` | off | Mix in `/recommendations` + `/products/:code/analytics` (needs a token) |
| `--write-test` | off | Allow safe writes: register a throwaway user to obtain a token |
| `--burst-cycles <n>` | 2 | Burst: number of peak cycles |
| `--burst-peak-rate <rps>` | 50 | Burst: peak rate |
| `--test-category-id` | off | Pattern F: also send `?categoryId=` variants |
| `--quiet` | off | Hide live progress lines |
| `--help` | – | Usage |

Examples:

```bash
node traffic-generator.js --pattern hot-products --requests 100 --rate 10 --concurrency 4
node traffic-generator.js --pattern mixed --duration 120 --rate 10 --concurrency 5
node traffic-generator.js --pattern memory-pressure --requests 200 --rate 15 --concurrency 6
node traffic-generator.js --pattern hit-test --requests 12
node traffic-generator.js --pattern mixed --write-test --include-expensive
```

## 3. Traffic patterns (A–H)

| Pattern | What it does | What to observe |
| --- | --- | --- |
| `repeated` (A) | Same list URL many times | 1 miss → ADMIT → hits; hit rate rises |
| `hot-products` (B) | 3 products skewed 40/30/20% | Hot keys keep high scores, stay cached |
| `cold` (C) | ~40 distinct list pages, ~35% searches, ~25% products | Misses dominate; low-frequency keys BYPASS (REJECT) |
| `mixed` (D) | 50% hot / 25% medium / 15% cold / 10% random | Realistic blend; ADMIT/REJECT/EVICT mix |
| `hit-test` (E) | Same product 10× sequentially | Per-request latency + the backend's own `cache.hit` flag |
| `query-variation` (F) | Repeated + varied search queries | Per-query-key admission behavior |
| `burst` (G) | Baseline 5 rps → peak (default 50) → cooldown, N cycles | 429s from the rate limiter, hit-rate swings, evictions |
| `memory-pressure` (H) | Many distinct list/search keys | ADMIT + EVICT churn at capacity (10 objects) |

### Pattern E note — what counts as a cache hit

Every ShopVerse response carries `cache.hit: true|false` set by the cache layer
itself. The report's **CLIENT-OBSERVED** section counts those flags — that is the
authoritative signal, not low latency. Latency is shown side by side: a Redis hit
is typically much faster than a backend regeneration, but only the flag proves it.

## 4. What the report shows

Every run prints a before/after report:

- **CACHE PERFORMANCE** — backend telemetry delta (`/api/analytics/stats` before vs after):
  requests, hits, misses, hit rate.
- **CLIENT-OBSERVED** — hits/misses counted from `cache.hit` flags in responses
  (cross-check against the telemetry delta).
- **CAAC DECISIONS** — ADMIT / REJECT (BYPASS) / EVICT deltas from the decision log.
- **LATENCY** — locally measured avg / min / max / p95 / p99.
- **STATUS BREAKDOWN** — 2xx, 404, 429 (rate-limited), HTTP errors, network/timeouts.
- **CAAC WEIGHTS** — live values from `/api/analytics/weights`.
- **REDIS / CACHE STATE** — cached object count and memory usage before → after.

Live progress lines (`[live] req N/M hit-rate X% delta: +hits +misses +ADMIT ...`)
print every `--monitor-interval` requests unless `--quiet`.

## 5. Expected CAAC behavior

- Fresh objects score ≈ 0.30–0.35 (recency + trend dominate), above the 0.20
  admission threshold → **ADMIT** on first access.
- Cached capacity is 10 objects (`CACHE_CAPACITY` in `.env`); when the 11th
  object is admitted, the lowest-scoring object is evicted → **EVICT** rows.
- Repeated access raises frequency/trend → hot keys stay cached, hit rate climbs.
- One-off cold keys decay below the threshold on re-evaluation → **REJECT/BYPASS**.
- TTL is 60s (`CACHE_DEFAULT_TTL`) — keys expire and re-miss after a minute.

## 6. Observing results in the frontend dashboard

The dashboard (`frontend/`) polls the same analytics endpoints every few seconds.

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173  (proxies /api -> localhost:3000)
```

Run a pattern, then watch the dashboard:

- **KPI cards** — Total Requests, Hits, Misses, Hit Rate climb.
- **Cumulative Cache Decisions** — ADMIT/EVICT bars grow; REJECT appears when
  cold keys are bypassed.
- **Hit Rate chart** — each poll appends a snapshot; a hot pattern bends it up.
- **Memory & TTL** — the object list shows scores, TTLs, and live Redis state;
  evicted keys disappear.
- **Activity Logs** — new ADMIT/EVICT rows with scores, latencies, reasons.

## 7. Safety & limits (read before running big tests)

- **Only GETs** are generated by default. The only write is registering a throwaway
  user, and that requires the explicit `--write-test` flag. Nothing deletes data,
  nothing touches Redis directly, no production endpoints are called.
- **Backend rate limiter**: `express-rate-limit` allows ~120 requests/min per IP.
  Long or bursty runs produce `429 Too Many Requests` — the generator counts them
  separately and keeps going. Back-to-back runs inside the same minute share the
  window; wait ~60s between runs or lower `--rate`.
- **Latency**: the backend's DB/Redis are remote in this environment, so requests
  are slow (hits ~0.2–0.5 s, misses ~0.5–4 s, recommendations ~2–8 s). Set
  `--concurrency` modestly (3–6) and use the default 20 s timeout. To speed up
  expensive-endpoint tests, lower `RECOMMENDATION_DELAY_MS` (default 2000) and
  `ANALYTICS_DELAY_MS` (default 1000) in the backend `.env`.
- **Ctrl+C** stops cleanly: in-flight requests finish, then a partial report prints.
- The `--token`/`--write-test` user needs no admin role — recommendations and
  product-analytics only require a valid JWT.

## 8. Known backend quirks surfaced by this tool

- **`?categoryId=` is not part of the list cache key** — the backend builds the key
  as `products:list:page=…:limit=…` without `categoryId`, so different category
  queries share one cache entry (and can serve a category-filtered list to a plain
  list request until the TTL expires). Pattern F's `--test-category-id` exercises
  this deliberately; the fix belongs in `productController.cacheKeyFor`/`listProducts`.
- **First-access double count**: the recommendation and product-analytics controllers
  call both `put()` and `touchMetric()` on a miss, so the very first access of those
  keys counts one extra miss in telemetry (report may show telemetry ≈ client-observed + 1).
- **Telemetry race (fixed)**: concurrent requests used to lose hit/miss increments
  because `touchMetric` did a read-modify-write on the metric row. It now uses an
  atomic increment for hits and a row-locked transaction (with an extended
  interactive-transaction timeout for slow remote DBs) for misses.

## 9. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Cannot reach http://localhost:3000/health` | Backend not running; or nodemon is mid-restart (the generator retries 4×). Start the backend first. |
| `Analytics endpoints unreachable` | `/api/analytics/stats` + `/api/analytics/weights` missing (older backend). |
| Many `429 (rate-limited)` | Over 120 req/min per IP. Lower `--rate`/`--concurrency`, or wait ~60 s. |
| Report shows telemetry 0 but requests ran | Final snapshot was 429'd/restarted; the generator now retries 429s with backoff. Re-run with `--rate 5`. |
| `network/timeout` on expensive patterns | Remote DB slowness; raise `--timeout` or lower `RECOMMENDATION_DELAY_MS`. |
| EVICT rows never appear | Capacity is 10; run `memory-pressure` with `--requests 200` (evictions start once >10 keys are admitted). |