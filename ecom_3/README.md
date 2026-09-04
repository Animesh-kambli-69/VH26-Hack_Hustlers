# ShopVerse — Cost-Aware Adaptive Cache

API-only e-commerce backend demonstrating an **Application-Aware, Cost-Aware Adaptive Cache (CAAC)**.

> Cache what saves the most backend cost for the memory it consumes — not simply what is accessed most.

## Stack

Node.js, Express.js, JavaScript, PostgreSQL, Prisma, Redis, JWT, bcrypt, Helmet, CORS, rate limiting, Zod, Jest, Supertest, Swagger/OpenAPI, Docker Compose.

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

Swagger: `http://localhost:3000/api/docs`

Health: `http://localhost:3000/health`

## Seed accounts

Created by `prisma/seed.js` for local/demo use:

- Admin: `admin@shopverse.local` / `Admin@12345`
- Demo user: `demo@shopverse.local` / `Demo@12345`

Change these credentials for any non-demo deployment. They are demo-only seed credentials, not production secrets.

## API

Public:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/products`
- `GET /api/products/:code`
- `GET /api/products/search?q=running&page=1&limit=20`
- `GET /api/products/categories`

Protected:
- `GET /api/auth/me`
- `GET /api/recommendations/:userId`
- `GET /api/products/:code/analytics`

Admin:
- `GET /api/admin/cache/metrics`
- `GET /api/admin/cache/decisions?limit=50`
- `POST /api/admin/cache/flush`
- `POST /api/admin/benchmark/run`
- `GET /api/admin/benchmark/:id`

## CAAC scoring

Signals are normalized to `[0,1]`:

```text
BaseScore =
    wF * Frequency
  + wR * Recency
  + wC * RetrievalCost
  + wL * Latency
  + wT * Trend

FinalScore = BaseScore / (1 + SizePenalty)
```

Default weights:

```text
Frequency      0.25
Recency        0.15
Retrieval Cost 0.30
Latency        0.15
Trend          0.15
```

Weights and thresholds are environment-configurable.

Recency uses exponential decay:

```text
recency = exp(-lambda * secondsSinceLastAccess)
```

Trend uses recent versus historical access frequency.

## Admission and eviction

A miss executes the backend operation, measures latency/cost, updates metadata, calculates a score, and then either:

- `ADMIT` when score clears the threshold and capacity permits
- `ADMIT + EVICT` when the new score is higher than the lowest cached score
- `BYPASS` otherwise

The implementation does **not** special-case recommendation endpoint names. The result comes from the score.

## Critical demo

1. Warm `P001`–`P010` with repeated product requests.
2. Make the products frequent.
3. Request an expensive recommendation.
4. Inspect `/api/admin/cache/decisions`.
5. Repeat the recommendation request.
6. The second request should be a Redis hit if its calculated score justified admission.

The prototype's default recommendation delay is 2 seconds and its configured retrieval cost is substantially higher than product retrieval cost.

## Workloads

```bash
npm run workload:steady
npm run workload:spike
npm run workload:expensive
npm run workload:gradual
npm run workload:cold
```

These commands print deterministic request streams for controlled experiments.

## Benchmark

```bash
npm run benchmark
```

or:

```bash
node scripts/run-benchmark.js expensive-rare 500
```

The benchmark runs the same generated workload against:

- LRU
- LFU
- GDS-style (`cost / size`)
- CAAC

It reports actual simulation-derived hit/miss counts, latency model, backend calls, estimated cost, and cost saved. It does not fabricate results.

## GDS note

This 30-hour prototype uses a documented GDS-style approximation based on `cost / size`, as permitted by the PRD. It is not a full Greedy-Dual-Size implementation.

## Database

Prisma models:

- User
- Category
- Product
- UserActivity
- CacheMetric
- CacheDecision
- BenchmarkRun

Run migrations locally with:

```bash
npx prisma migrate dev --name init
npm run db:seed
```

For Docker, the API runs `prisma migrate deploy` and seed on startup.

## Security

- Helmet
- CORS
- Rate limiting
- Zod-ready validation layer
- JWT authentication
- RBAC for admin APIs
- bcrypt password hashing
- Prisma parameterized database access
- environment-based secrets
- centralized error handling
- no password hashes/secrets in API responses

## Important prototype limitation

Cache metadata is intentionally split between Redis cache keys and PostgreSQL aggregate metrics so the demo is observable. A production version would likely move hot metadata counters fully into Redis and periodically aggregate them into PostgreSQL.

## Acceptance checklist

- Express starts
- PostgreSQL + Prisma connect
- Redis connects
- seed works
- JWT auth works
- product/search/recommendation/analytics APIs exist
- cache hit/miss works
- TTL works
- admission/eviction/bypass work
- CAAC uses frequency, recency, cost, latency, trend and size
- decisions are explainable
- workload scenarios exist
- LRU/LFU/GDS-style/CAAC benchmark exists
- metrics and decisions endpoints exist
- Docker Compose and Swagger are included
- automated CAAC scenario tests exist
