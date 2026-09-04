# Agent Prompt — ShopVerse Cost-Aware Adaptive Cache

You are a senior backend engineer, system architect, Redis/cache researcher, and test engineer.

Build the complete **ShopVerse — Cost-Aware Adaptive Cache API** project from the attached PRD. Treat the PRD as the source of truth and implement the requirements through the final implementation/positioning sections. Do not add a frontend.

## Objective

Create a runnable API-only e-commerce backend using:

- Node.js
- Express.js
- JavaScript
- PostgreSQL
- Prisma
- Redis
- JWT + bcrypt
- Helmet, CORS, rate limiting
- Zod or Joi validation
- Jest + Supertest
- Swagger/OpenAPI
- Docker + Docker Compose

The central innovation is a **Cost-Aware Adaptive Cache (CAAC)**. Redis is only the storage layer; the application must own admission, retention, refresh, bypass and eviction decisions.

## Mandatory business scenario

Use a cache capacity of 10 objects.

Warm ten cheap/high-frequency product keys:

`product:P001` through `product:P010`

Then issue a low-frequency but expensive:

`recommendation:U100`

Products should be cheap/low-latency. Recommendations should be configurable at roughly 1–3 seconds with high simulated compute/database/external cost.

The recommendation must NOT win because its endpoint/key is special-cased. Its calculated score must exceed the lowest cached object's score. When it does:

1. EVICT the lowest-value object.
2. ADMIT the recommendation.
3. Record an explainable decision.
4. Make the next recommendation request a Redis HIT.
5. Expose avoided backend work/cost.

## CAAC model

Normalize signals to `[0,1]`.

```text
BaseScore =
    wF * Frequency
  + wR * Recency
  + wC * RetrievalCost
  + wL * Latency
  + wT * Trend

FinalScore =
    BaseScore / (1 + SizePenalty)
```

Default weights:

- frequency = 0.25
- recency = 0.15
- retrieval cost = 0.30
- latency = 0.15
- trend = 0.15

Make weights configurable through environment variables.

Recency:

```text
exp(-lambda * secondsSinceLastAccess)
```

Trend:

```text
recentFrequency / (historicalFrequency + epsilon)
```

Track object size and penalize large objects.

## Decision actions

Support:

- ADMIT
- RETAIN
- EVICT
- REFRESH
- BYPASS

On a miss:

```text
backend request
→ measure latency/cost
→ update metadata
→ calculate score
→ admission decision
→ capacity check
→ compare with lowest score
→ evict if new score is more valuable
→ store or bypass
```

Do not automatically cache every miss.

For maintenance, periodically recompute scores and support:

- low-value eviction
- high-value TTL-near-expiry refresh
- retention

Do not scan the entire Redis cache on every API request.

## API

Implement:

Public:
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/products`
- GET `/api/products/:code`
- GET `/api/products/search`
- GET `/api/products/categories`

Protected:
- GET `/api/auth/me`
- GET `/api/recommendations/:userId`
- GET `/api/products/:code/analytics`

Admin:
- GET `/api/admin/cache/metrics`
- GET `/api/admin/cache/decisions`
- POST `/api/admin/cache/flush`
- POST `/api/admin/benchmark/run`
- GET `/api/admin/benchmark/:id`

Swagger should be available at `/api/docs`.

## Redis

Use:

```text
cache:data:<cache_key>
cache:metadata:<cache_key>
```

Cache responses, metadata, TTLs and optional counters. Keep key generation deterministic and include parameters that affect responses.

## PostgreSQL / Prisma

Implement:

- User
- Category
- Product
- UserActivity
- CacheMetric
- CacheDecision
- BenchmarkRun

Use UUIDs where appropriate, indexes, unique email/code constraints, and Prisma queries.

## Authentication/security

Use JWT access tokens and bcrypt password hashing.

Roles:

- USER
- ADMIN

Admin endpoints require ADMIN.

Use:

- Helmet
- CORS
- rate limiting
- input validation
- JWT signature/expiry validation
- RBAC
- Prisma parameterized access
- environment variables
- centralized errors

Never return passwords, hashes, JWT secrets, database credentials or production stack traces.

## Workload generator

Support:

- steady
- spike
- expensive-rare
- gradual-shift
- cold-start

Provide CLI commands such as:

```bash
npm run workload:steady
npm run workload:spike
npm run workload:expensive
npm run workload:gradual
npm run workload:cold
```

## Benchmark engine

Run the same workload against:

- LRU
- LFU
- GDS-style
- CAAC

Measure:

- hit rate
- miss rate
- average latency
- P95 latency
- backend calls
- estimated backend cost
- cost saved
- cache utilization
- cost saved per MB where practical

Do not fabricate benchmark results.

If full GDS is too large, implement and document a GDS-style `cost / size` approximation.

## Explainability

Every significant decision must contain:

```json
{
  "action": "ADMIT",
  "key": "recommendation:U100",
  "score": 0.91,
  "reason": [
    "high regeneration cost",
    "high latency",
    "better expected savings than lowest cached object"
  ]
}
```

Reasons must be generated from actual signals/comparisons.

## Tests

Unit test:

- normalization
- recency
- trend
- cost score
- size penalty
- score calculation
- admission
- eviction

Integration test:

- Redis hit
- Redis miss
- DB fallback
- admission
- eviction
- auth
- authorization

Mandatory automated scenario:

10 cheap/high-frequency objects + 1 expensive/low-frequency object must demonstrate a score-driven decision where the expensive object can replace a lower-value object.

Do NOT assert a hardcoded recommendation key as the winner. Assert the score comparison and policy decision.

## Docker

Provide:

- Dockerfile
- docker-compose.yml

Services:

- api
- postgres
- redis

The project must start with:

```bash
docker compose up --build
```

Provide Prisma migration and seed commands.

## Seed

Seed realistic categories/products/user activity and a demo admin account through a documented seed process. Never put real production secrets into source.

## Architecture

Use modular separation:

```text
src/
  config/
  controllers/
  routes/
  middleware/
  services/
    cache/
    products/
    recommendations/
    analytics/
  repositories/
  utils/
  workload/
  benchmarks/
  app.js
  server.js
prisma/
tests/
scripts/
docs/
```

The CAAC engine must not depend on Express route handlers.

## README

Include:

1. project overview
2. problem statement
3. why LRU/LFU are insufficient
4. CAAC explanation
5. architecture
6. formula
7. APIs
8. environment variables
9. local setup
10. Docker setup
11. migrations
12. seed
13. workload commands
14. benchmark commands
15. example requests
16. expected expensive-query behavior
17. benchmark interpretation
18. limitations
19. future improvements

## Quality constraints

- async/await
- clear naming
- modular architecture
- no duplicated cache logic
- no hardcoded secrets
- no hardcoded "recommendation wins" rule
- no fake hits
- no fake savings
- no fake benchmark numbers
- no endpoint-name special cases
- comments only for non-obvious logic

## Final acceptance

Before declaring completion, verify:

1. API starts.
2. PostgreSQL and Redis connect.
3. Prisma migration works.
4. Seed works.
5. Auth works.
6. Product APIs work.
7. Recommendation API works.
8. Analytics API works.
9. Redis HIT/MISS works.
10. TTL works.
11. Metadata updates.
12. CAAC score uses all required signals.
13. Admission, bypass and eviction work.
14. Explainable decisions are persisted.
15. Workload scenarios execute.
16. LRU/LFU/GDS-style/CAAC benchmark executes.
17. Metrics endpoints work.
18. Docker Compose starts the system.
19. Swagger is available.
20. The mandatory cheap-vs-expensive scenario is proven by an automated test.

Return the finished source tree, setup instructions, test results, and a concise explanation of how the mandatory scenario is demonstrated.
