# Product Requirement Document (PRD)
# ShopVerse Adaptive Redis Cache

**Project Name:** ShopVerse Adaptive, Application-Aware Redis Cache Management System  
**Base Project:** ShopVerse — Full-stack e-commerce (React JSX + Express)  
**Phase:** Phase 2 — Redis Caching, Adaptive Eviction & Observability  
**Version:** 3.0.0  
**Status:** Ready for Implementation  
**Target Build:** 30-hour hackathon implementation

---

## 1. Product Vision

ShopVerse currently operates without a production-style cache. Product lists, product details, search/filter operations, categories, and order history repeatedly execute their underlying service logic.

The goal of Phase 2 is to add a **real Redis-based caching system** with an **application-aware adaptive caching policy**.

The system must not simply enable Redis LRU/LFU. Instead:

> **Redis is the storage and execution layer; the Adaptive Cache Engine is the intelligence layer that decides what should enter, remain in, or leave Redis.**

The project must expose APIs so that the cache can be configured, monitored, simulated, benchmarked, and demonstrated from the ShopVerse application.

---

# 2. Problem Statement

Traditional Redis cache policies such as LRU and LFU mainly consider recency or frequency.

Consider:

```text
Query A
Latency: 10ms
Cost: $0.00005
Size: 0.2MB
Frequency: 100

Query B
Latency: 250ms
Cost: $0.001
Size: 1.2MB
Frequency: 10
```

A conventional frequency/recency policy may retain Query A because it is requested frequently.

However, Query B is significantly more expensive to recompute.

Therefore, ShopVerse needs an adaptive policy that considers:

- Computation latency
- Monetary/computation cost
- Request frequency
- Response size
- Recency
- Cache capacity
- Data type
- Time decay

---

# 3. Core Objective

Build a real Redis-backed adaptive cache system that:

1. Caches expensive ShopVerse API responses.
2. Uses Redis as the actual cache.
3. Calculates application-aware utility scores.
4. Uses utility for cache admission and eviction.
5. Provides LRU, LFU and GDSF baselines.
6. Provides a no-cache baseline.
7. Tracks real Redis commands and cache metrics.
8. Provides REST APIs for cache management.
9. Provides an SSE stream for live dashboard metrics.
10. Provides a workload simulator for Normal, BBD Spike, Shift and Cold Start scenarios.
11. Provides Redis monitoring through RedisInsight and `redis-cli`.
12. Preserves existing ShopVerse APIs when caching is disabled.

---

# 4. Required API Implementation

The Phase 2 project MUST create a complete cache API.

## 4.1 Cache Statistics

### GET `/api/cache/stats`

Returns current application cache and Redis metrics.

Example:

```json
{
  "mode": "adaptive",
  "hitRate": 91.4,
  "hits": 12482,
  "misses": 1171,
  "requests": 13653,
  "memory": {
    "usedMB": 47.2,
    "capacityMB": 100
  },
  "redis": {
    "connected": true,
    "usedMemoryMB": 47.2,
    "totalKeys": 1284,
    "evictedKeys": 843,
    "expiredKeys": 421,
    "keyspaceHits": 12482,
    "keyspaceMisses": 1171
  },
  "latency": {
    "avgRedisMs": 0.63,
    "p99RedisMs": 1.42,
    "p99ApplicationMs": 84
  },
  "savings": {
    "latencySeconds": 1824.5,
    "money": 87.23,
    "rupees": 7240.09
  }
}
```

---

# 5. Cache Configuration API

## POST `/api/cache/config`

Runtime configuration without restarting the server.

Request:

```json
{
  "mode": "adaptive",
  "wL": 0.6,
  "wM": 0.4,
  "lambda": 0.01,
  "capacityMB": 100
}
```

Supported modes:

```text
adaptive
lru
lfu
gdsf
no-cache
```

Response:

```json
{
  "success": true,
  "config": {
    "mode": "adaptive",
    "wL": 0.6,
    "wM": 0.4,
    "lambda": 0.01,
    "capacityMB": 100
  }
}
```

---

# 6. Cache Entries API

## GET `/api/cache/entries`

Returns cached entries and metadata.

Query parameters:

```text
?type=SEARCH
?sort=utility
?limit=50
```

Example:

```json
{
  "entries": [
    {
      "key": "shopverse:cache:product:detail:1",
      "type": "DETAIL",
      "sizeMB": 0.6,
      "costLatency": 120,
      "costMoney": 0.0005,
      "frequency": 43,
      "utility": 0.82,
      "ttl": 113,
      "lastAccess": 1725470000
    }
  ]
}
```

---

# 7. Eviction API

## GET `/api/cache/evictions`

Returns recent eviction events.

Example:

```json
{
  "evictions": [
    {
      "key": "shopverse:cache:products:list:all",
      "utility": 0.12,
      "type": "CATALOG",
      "sizeMB": 0.2,
      "reason": "LOW_UTILITY"
    }
  ]
}
```

---

# 8. Manual Cache Operations

## DELETE `/api/cache/clear`

Clears all application cache data.

## DELETE `/api/cache/key/:key`

Deletes a specific cached key.

## POST `/api/cache/invalidate`

Request:

```json
{
  "pattern": "product:*"
}
```

The implementation must avoid blocking production traffic with Redis `KEYS`. Use `SCAN` or maintained Redis indexes.

---

# 9. Redis Monitoring API

## GET `/api/cache/redis`

Returns real Redis server information.

Required information:

```text
connection status
Redis version
used memory
peak memory
memory fragmentation
total keys
keyspace hits
keyspace misses
evicted keys
expired keys
connected clients
commands processed
uptime
```

The values must be obtained from actual Redis commands such as:

```text
INFO
INFO memory
INFO stats
INFO clients
DBSIZE
```

Do not hard-code or simulate these values.

---

# 10. Redis Command Monitoring API

## GET `/api/cache/commands`

Returns recent Redis operations captured by the application.

Example:

```json
{
  "commands": [
    {
      "command": "GET",
      "key": "shopverse:cache:product:detail:1",
      "latencyMs": 0.42,
      "timestamp": 1725470012
    },
    {
      "command": "HINCRBY",
      "key": "shopverse:meta:product:detail:1",
      "latencyMs": 0.31,
      "timestamp": 1725470012
    },
    {
      "command": "ZADD",
      "key": "shopverse:utility",
      "latencyMs": 0.28,
      "timestamp": 1725470012
    }
  ]
}
```

The system should maintain a bounded in-memory recent-command buffer so command monitoring does not create unlimited memory usage.

For development, the project must also work with:

```bash
redis-cli MONITOR
```

---

# 11. Real-Time Metrics API

## GET `/api/cache/stream`

Implement Server-Sent Events (SSE).

The endpoint should continuously publish:

```json
{
  "type": "metrics",
  "timestamp": 1725470012,
  "hitRate": 91.4,
  "memoryMB": 47.2,
  "p99": 84,
  "redisLatency": 0.63,
  "rupeesSaved": 7240,
  "evictions": 843
}
```

Also support event types:

```text
metrics
cache-hit
cache-miss
cache-set
eviction
redis-error
scenario-change
```

---

# 12. Workload Simulation API

## POST `/api/cache/simulate`

Request:

```json
{
  "scenario": "BBD_SPIKE",
  "requestsPerSecond": 500,
  "durationSeconds": 30
}
```

Supported scenarios:

### NORMAL

```text
60% browsing
20% search
15% product detail
5% checkout
Zipf alpha = 1.2
```

### BBD_SPIKE

```text
10x traffic
70% expensive requests
iPhone/product-detail hot key
search=iphone becomes extremely popular
```

### SHIFT

Hot products/categories change over time.

Example:

```text
Phase 1:
Diwali products are hot.

Phase 2:
Christmas products become hot.
```

The purpose is to test frequency pollution and recency decay.

### COLD_START

Most requests are unique.

The purpose is to verify that one-hit wonders are not blindly admitted into cache.

---

# 13. Benchmark API

## POST `/api/cache/benchmark`

Runs the same workload against:

```text
No Cache
LRU
LFU
GDSF
Adaptive
```

Request:

```json
{
  "scenario": "BBD_SPIKE",
  "requests": 10000,
  "capacityMB": 100
}
```

Response:

```json
{
  "results": {
    "adaptive": {
      "hitRate": 91.2,
      "p99Ms": 85,
      "moneySaved": 12.4
    },
    "lru": {
      "hitRate": 74.1,
      "p99Ms": 212,
      "moneySaved": 5.1
    },
    "lfu": {
      "hitRate": 70.2,
      "p99Ms": 231,
      "moneySaved": 4.2
    },
    "gdsf": {
      "hitRate": 82.4,
      "p99Ms": 124,
      "moneySaved": 8.7
    },
    "no-cache": {
      "hitRate": 0,
      "p99Ms": 800,
      "moneySaved": 0
    }
  }
}
```

Benchmark values must be calculated from the workload, not hard-coded.

---

# 14. Redis Architecture

Redis must be a real service.

Use:

```text
Redis 7+
Node.js Redis client
Docker Compose
RedisInsight
```

Recommended architecture:

```text
React
  ↓
Express
  ↓
Adaptive Redis Cache
  ↓
Redis
  ↓
ShopVerse Services
  ↓
Database / fileDb
```

---

# 15. Redis Project Structure

Required structure:

```text
server/
└── src/
    ├── config/
    │   ├── env.js
    │   └── redis.js
    │
    ├── redis/
    │   ├── redisClient.js
    │   ├── redisKeys.js
    │   ├── redisSerializer.js
    │   ├── redisHealth.js
    │   │
    │   ├── cache/
    │   │   ├── baseCache.js
    │   │   ├── redisCache.js
    │   │   ├── adaptiveRedisCache.js
    │   │   ├── utilityEngine.js
    │   │   ├── admissionController.js
    │   │   ├── evictionController.js
    │   │   ├── lruCache.js
    │   │   ├── lfuCache.js
    │   │   └── gdsfCache.js
    │   │
    │   ├── metrics/
    │   │   ├── redisMetrics.js
    │   │   ├── queryMonitor.js
    │   │   └── metricsStore.js
    │   │
    │   └── locks/
    │       └── singleFlight.js
    │
    ├── controllers/
    │   └── cacheController.js
    │
    ├── routes/
    │   └── cacheRoutes.js
    │
    └── services/
        ├── productService.js
        ├── orderService.js
        └── categoryService.js

redis/
├── redis.conf
├── README.md
└── scripts/
    ├── resetRedis.js
    └── inspectRedis.js

docker-compose.yml
.env.example
```

---

# 16. Redis Key Design

All keys must use the `shopverse:` namespace.

```text
shopverse:cache:product:list:{hash}
shopverse:cache:product:detail:{id}
shopverse:cache:category:list
shopverse:cache:orders:customer:{customerId}

shopverse:meta:{cacheKey}

shopverse:utility

shopverse:metrics:hits
shopverse:metrics:misses
shopverse:metrics:evictions

shopverse:lock:checkout:{cartId}

shopverse:idempotency:{requestId}

shopverse:config
```

Search/filter query parameters should be hashed instead of producing excessively long Redis keys.

---

# 17. Redis Data Structures

Use Redis data structures correctly.

## String

Cached API response:

```redis
SET shopverse:cache:product:detail:1 "<json>" EX 120
```

## Hash

Metadata:

```redis
HSET shopverse:meta:<key>
  type DETAIL
  sizeMB 0.6
  costLatency 120
  costMoney 0.0005
  frequency 43
  lastAccess 1725470012
  utility 0.82
```

## Sorted Set

Utility index:

```redis
ZADD shopverse:utility 0.82 "<cache-key>"
```

The lowest score represents the least useful candidate for eviction.

## Counters

Use:

```redis
INCR
HINCRBY
```

for hits, misses and operation counts.

## Locks

Use Redis atomic operations for checkout/single-flight coordination.

Example concept:

```redis
SET shopverse:lock:checkout:<id> <token> NX EX 5
```

---

# 18. Adaptive Utility Formula

Implement:

```text
U_i(t) =
(
  (Ĉ_lat × wL + Ĉ_$ × wM)
  × log(1 + F_i)
) / S_i
× e^(-λΔt)
```

Where:

```text
Ĉ_lat = normalized latency
Ĉ_$   = normalized monetary cost
F_i   = decayed frequency
S_i   = response size in MB
λ     = recency decay parameter
Δt    = time since last access
```

Latency normalization:

```text
Ĉ_lat = clamp((latency - 5) / (800 - 5), 0, 1)
```

Cost normalization:

```text
Ĉ_$ = clamp(
  (cost - 0.00005) / (0.008 - 0.00005),
  0,
  1
)
```

Frequency:

```text
F_new = F_old × 0.99 + 1
```

The normalization constants must be configurable.

---

# 19. Admission Policy

A request should not automatically enter Redis.

When a new object arrives:

```text
calculate utility
        ↓
check available capacity
        ↓
if enough capacity
    admit
else
    find lowest utility entry
        ↓
compare new utility vs victim utility
        ↓
new utility > victim
    evict victim
    admit new entry
else
    reject admission
```

This is especially important for the COLD_START scenario.

One-hit queries should not automatically pollute Redis.

---

# 20. Eviction Policy

Adaptive eviction:

```text
victim = lowest utility score
```

Use:

```redis
ZRANGE shopverse:utility 0 0 WITHSCORES
```

Then:

```text
remove Redis value
remove metadata
remove utility entry
record eviction
```

Do not perform a full scan of every cached object for every request.

---

# 21. Baseline Policies

Implement separate policy classes:

```text
lruCache.js
lfuCache.js
gdsfCache.js
adaptiveRedisCache.js
```

All policies should implement the same interface:

```javascript
get(key)
set(key, value, metadata)
delete(key)
clear()
stats()
```

This makes benchmarking fair.

---

# 22. ShopVerse Service Integration

## Products

Modify:

```text
server/src/services/productService.js
```

For:

```http
GET /api/products
```

Cache key:

```text
shopverse:cache:product:list:<hash>
```

For:

```http
GET /api/products/:id
```

Cache key:

```text
shopverse:cache:product:detail:<id>
```

---

# 23. Category Integration

Modify:

```text
categoryService.js
```

Cache:

```text
shopverse:cache:category:list
```

TTL:

```text
600 seconds
```

---

# 24. Order History Integration

Modify:

```text
orderService.js
```

Cache:

```text
shopverse:cache:orders:customer:<customerId>
```

TTL:

```text
30 seconds
```

Invalidate after successful order creation.

---

# 25. Checkout Handling

Do NOT treat `POST /api/orders` as a normal cacheable response.

Instead Redis should support:

- Idempotency
- Single-flight locking
- Temporary coordination
- Cache invalidation
- Stock-related coordination where appropriate

Example:

```text
POST /api/orders
      ↓
Acquire Redis lock
      ↓
Validate order
      ↓
Check stock
      ↓
Create order
      ↓
Invalidate affected cache
      ↓
Release lock
```

---

# 26. Cache Invalidation

After successful order creation:

```text
invalidate product lists
invalidate affected product detail
invalidate customer order history
invalidate categories if stock reaches zero
```

Use `SCAN` or explicit indexes rather than:

```redis
KEYS *
```

in request handlers.

---

# 27. TTL Policy

| Data | TTL |
|---|---:|
| Product list | 300 sec |
| Product detail | 120 sec |
| Categories | 600 sec |
| Order history | 30 sec |
| Checkout lock | 5 sec |
| Idempotency key | 60–300 sec |

TTL is independent from adaptive utility.

An entry can have high utility but must still expire when its data becomes stale.

---

# 28. Redis Configuration

Provide:

```text
redis/redis.conf
```

Recommended development configuration:

```conf
maxmemory 150mb
maxmemory-policy noeviction
appendonly yes
```

The application-level adaptive controller manages admission and eviction.

For baseline experiments, separate Redis instances/configurations may use:

```text
allkeys-lru
allkeys-lfu
```

---

# 29. Environment Variables

Create:

```text
.env.example
```

with:

```env
PORT=5000

REDIS_URL=redis://localhost:6379

CACHE_MODE=adaptive

CACHE_CAPACITY_MB=100

CACHE_WEIGHT_LATENCY=0.6
CACHE_WEIGHT_MONEY=0.4
CACHE_LAMBDA=0.01

CACHE_DEFAULT_TTL=300

CACHE_METRICS_ENABLED=true

FRONTEND_URL=http://localhost:5173
```

---

# 30. Docker Requirements

Provide:

```text
docker-compose.yml
```

Services:

```text
server
client
redis
redisinsight
```

RedisInsight should be accessible during development.

The project must support:

```bash
docker compose up -d
```

and:

```bash
npm run dev
```

according to the existing ShopVerse workflow.

---

# 31. Redis Monitoring

The project must support real monitoring.

Developers should be able to use:

```bash
redis-cli
```

and:

```bash
redis-cli INFO
```

```bash
redis-cli DBSIZE
```

```bash
redis-cli --stat
```

```bash
redis-cli MONITOR
```

RedisInsight must be able to inspect:

```text
shopverse:cache:*
shopverse:meta:*
shopverse:utility
shopverse:metrics:*
shopverse:lock:*
```

---

# 32. Dashboard Requirements

Create:

```text
client/src/pages/CacheDashboard.jsx
```

Route:

```text
/admin/cache-dashboard
```

Dashboard sections:

### Redis Health

```text
Connected
Redis version
Memory
Keys
Clients
Uptime
```

### Cache Performance

```text
Hit Rate
Miss Rate
P50
P95
P99
Average Redis latency
```

### Policy Comparison

```text
Adaptive
LRU
LFU
GDSF
No Cache
```

### Cost Savings

Display:

```text
Cost saved
₹ saved
Latency saved
Estimated hourly savings
Estimated monthly savings
```

### Memory Allocation

By:

```text
CATALOG
SEARCH
DETAIL
ORDER
```

### Eviction Feed

Show:

```text
key
utility
size
type
cost
reason
timestamp
```

### Redis Operations

Show live:

```text
GET
SET
DEL
HGET
HSET
HINCRBY
ZADD
ZRANGE
ZREM
```

---

# 33. Dashboard Controls

Provide:

```text
Scenario:
[ Normal ]
[ BBD Spike ]
[ Shift ]
[ Cold Start ]

Cache Mode:
[ Adaptive ]
[ LRU ]
[ LFU ]
[ GDSF ]
[ No Cache ]

Capacity:
10MB ───────── 150MB

Requests/sec:
50 ───────── 1000

wL:
0 ───────── 1

wM:
0 ───────── 1

λ:
0 ───────── configurable maximum
```

Changing configuration must call:

```http
POST /api/cache/config
```

without restarting the backend.

---

# 34. Real-Time Dashboard Flow

```text
Redis
  ↓
Metrics Collector
  ↓
Express
  ↓
/api/cache/stream
  ↓ SSE
React Dashboard
  ↓
Recharts
```

The dashboard must not fabricate metrics.

---

# 35. Cost Advisor

Implement:

```text
server/src/redis/cache/costAdvisor.js
```

Logic:

```text
preventable misses × average recomputation cost
```

Compare against simulated infrastructure cost.

Example:

```text
Additional capacity:
+100MB

Estimated additional savings:
$12/hour

Estimated Redis node cost:
$0.15/hour

ROI:
80x

Recommendation:
SCALE_UP
```

This is an advisory simulation only.

Do not automatically scale cloud infrastructure.

---

# 36. Metrics to Collect

Every request should be capable of producing:

```text
requestId
endpoint
cacheKey
cacheType
cacheHit
latency
redisLatency
computationLatency
responseSize
estimatedCost
utility
frequency
timestamp
```

Aggregate:

```text
hits
misses
hitRate
evictions
admissionRejects
expiredEntries
redisErrors
averageLatency
P99
costSaved
latencySaved
```

---

# 37. Error Handling

Redis failure must not crash ShopVerse.

If Redis is unavailable:

```text
Redis GET fails
      ↓
log error
      ↓
execute original service
      ↓
return response
```

The application should degrade gracefully to no-cache behavior.

---

# 38. Backward Compatibility

When:

```env
CACHE_MODE=no-cache
```

the original ShopVerse behavior must remain functional.

Existing endpoints must not require Redis to operate.

---

# 39. Security

Do not expose unrestricted Redis commands through the public API.

The cache API should be protected as an admin API in the application.

Never expose:

```text
EVAL
CONFIG
SHUTDOWN
FLUSHALL
```

directly to clients.

Never accept arbitrary Redis commands from frontend users.

---

# 40. Testing Requirements

Create tests for:

### Cache

```text
GET hit
GET miss
SET
DELETE
TTL
```

### Adaptive policy

```text
utility calculation
admission
eviction
frequency decay
recency decay
```

### Redis

```text
connection
reconnection
Redis unavailable
serialization
deserialization
```

### Invalidation

```text
order creation
product stock update
customer order history
```

### API

```text
/api/cache/stats
/api/cache/config
/api/cache/entries
/api/cache/evictions
/api/cache/redis
/api/cache/commands
/api/cache/stream
/api/cache/simulate
/api/cache/benchmark
```

---

# 41. Expected Demonstration

The final demo should follow:

```text
1. Start Docker
2. Start Redis + RedisInsight
3. Start ShopVerse
4. Open RedisInsight
5. Open Cache Dashboard
6. Run Normal scenario
7. Show Redis GET/SET operations
8. Run BBD Spike
9. Show expensive search/detail keys becoming hot
10. Show adaptive utility scores
11. Show low-utility catalog eviction
12. Compare Adaptive vs LRU/LFU/GDSF
13. Show P99 improvement
14. Show actual Redis memory
15. Show ₹ savings
16. Switch CACHE_MODE=no-cache
17. Demonstrate original application still works
```

---

# 42. Example Hackathon Story

The presentation should explain:

> "Redis normally gives us mechanisms like LRU and LFU, but those policies don't understand the business cost of a query. ShopVerse adds an application-aware intelligence layer on top of Redis. Every cache entry receives a utility score based on latency, monetary cost, frequency, size and recency. During a traffic spike, the system can evict a cheap, frequently accessed catalog response to preserve a less frequent but expensive search or recommendation response."

---

# 43. Success Criteria

The project is complete when:

- [ ] Redis is running as a real service.
- [ ] ShopVerse connects to Redis.
- [ ] Product list is cached.
- [ ] Product details are cached.
- [ ] Categories are cached.
- [ ] Order history is cached.
- [ ] Checkout uses Redis locks/idempotency where required.
- [ ] Cache invalidation works.
- [ ] Adaptive utility is implemented.
- [ ] Admission control is implemented.
- [ ] Adaptive eviction is implemented.
- [ ] LRU baseline works.
- [ ] LFU baseline works.
- [ ] GDSF baseline works.
- [ ] No-cache baseline works.
- [ ] Real Redis metrics are displayed.
- [ ] Redis command monitoring works.
- [ ] SSE stream works.
- [ ] Dashboard works.
- [ ] Workload simulator works.
- [ ] Benchmark API works.
- [ ] RedisInsight can inspect the project.
- [ ] Redis failure gracefully falls back to service execution.
- [ ] Existing ShopVerse APIs continue working.
- [ ] Docker Compose starts Redis.
- [ ] Documentation explains the architecture.

---

# 44. Final Required Repository Structure

```text
ShopVerse/
│
├── client/
│   └── src/
│       ├── pages/
│       │   └── CacheDashboard.jsx
│       └── ...
│
├── server/
│   └── src/
│       ├── config/
│       ├── redis/
│       │   ├── cache/
│       │   ├── metrics/
│       │   └── locks/
│       ├── controllers/
│       ├── routes/
│       ├── services/
│       └── app.js
│
├── redis/
│   ├── redis.conf
│   ├── README.md
│   └── scripts/
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 45. Implementation Priority

Implement in this order:

```text
PHASE 1
Redis connection
    ↓
Redis cache wrapper
    ↓
Product service integration

PHASE 2
Metadata
    ↓
Utility engine
    ↓
Admission controller
    ↓
Adaptive eviction

PHASE 3
LRU / LFU / GDSF
    ↓
Benchmarking

PHASE 4
Metrics
    ↓
Redis monitoring
    ↓
SSE

PHASE 5
Simulation
    ↓
Dashboard

PHASE 6
Invalidation
    ↓
Single-flight
    ↓
Idempotency
    ↓
Testing
```

---

# 46. Non-Goals

This phase does NOT require:

- Kubernetes autoscaling
- Production cloud autoscaling
- Distributed Redis Cluster
- Redis Sentinel
- Real payment processing changes
- Replacing the existing database
- Automatic infrastructure scaling
- Caching unsafe state-changing operations

These can be future phases.

---

# 47. Future Production Architecture

For production scale:

```text
                 Load Balancer
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Express 1     Express 2     Express 3
        │             │             │
        └─────────────┼─────────────┘
                      ▼
               Redis Cluster
                      │
                      ▼
                PostgreSQL
```

The current hackathon implementation should remain Redis-first and production-architecture-ready without requiring this infrastructure.

---

# 48. Final Requirement

The implementation must produce a **working API-driven Redis cache system**, not merely a frontend simulation.

The following must be real:

```text
Redis connection
Redis storage
Redis TTL
Redis metadata
Redis sorted sets
Redis counters
Redis locks
Redis memory statistics
Redis hit/miss statistics
Redis command monitoring
Cache invalidation
Cache admission
Cache eviction
API endpoints
SSE stream
```

The adaptive algorithm must be the custom contribution:

```text
Redis
   +
Application-Aware Utility
   +
Admission Control
   +
Cost-Aware Eviction
   +
Real-Time Observability
```

**Final product statement:**

> **ShopVerse Adaptive Redis Cache is an application-aware caching system built on real Redis that optimizes cache memory according to computational cost rather than relying solely on traditional LRU/LFU behavior.**
