# Architecture

```text
Client / Postman
      |
      v
Express API
  |       |
Auth   Validation
      |
      v
Cache-aware service
  |          |
 HIT        MISS
  |          |
Redis       PostgreSQL / expensive service
             |
             v
        Cost measurement
             |
             v
        CAAC score engine
        /      |       \
     ADMIT   BYPASS   EVICT/REFRESH
        |
        v
      Redis
```

The score engine is isolated under `src/services/cache` and the benchmark policies are isolated under `src/benchmarks`.
