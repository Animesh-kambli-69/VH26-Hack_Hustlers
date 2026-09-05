# ShopVerse CAAC Monitoring Dashboard

A dark, futuristic observability dashboard for the **ShopVerse Cost-Aware Adaptive Cache (CAAC)** engine.
Built with React + Vite, TailwindCSS, Recharts and lucide-react. Every metric shown is real backend
telemetry — nothing is fabricated.

## Quick start

The ShopVerse backend must be running on `http://localhost:3000` (see the project root README:
`docker compose up --build` or `npm run dev`).

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the dashboard polls both telemetry endpoints every 5 seconds.

Production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serves the production build (with the same API proxy)
```

## How it connects to the backend

The dashboard consumes two read-only endpoints added to the backend for this purpose:

| Endpoint | What it returns |
| --- | --- |
| `GET /api/analytics/stats` | Cumulative hit/miss totals, decision counts (ADMIT/REJECT/EVICT), Redis memory usage, per-object metrics + live Redis TTL, latest 25 decision events |
| `GET /api/analytics/weights` | CAAC signal weights, admission threshold, recency lambda, size penalty, capacity and default TTL |

These are read-only aggregations of data the backend already tracks (Prisma `CacheMetric` /
`CacheDecision` rows, Redis `memoryUsage`/`TTL`, env config) — no business logic was changed.

### API base URL

`frontend/src/services/analyticsApi.js` resolves the base URL from `VITE_API_BASE_URL`:

1. If set (e.g. `VITE_API_BASE_URL=http://localhost:3000/api`), requests go straight to the backend.
2. Otherwise it defaults to same-origin `/api`, which the Vite dev/preview server proxies to
   `http://localhost:3000/api` (`vite.config.js`).

The proxy default is recommended: the backend's default CORS config only allows
`http://localhost:3000`, so direct browser calls from the Vite origin are blocked. If you use a
direct URL in production, make sure the backend `CORS_ORIGIN` allows your dashboard's origin.

## What's real, what's calculated, what's unavailable

**Real backend data** (fetched every poll):
- Hit / miss counts and hit rate (computed as `hits / total` by the backend)
- ADMIT / REJECT (BYPASS) / EVICT decision counts and the full decision log (time, key, event,
  score, latency, reason, status)
- Per-object stats: CAAC score, hits/misses, retrieval cost, object size, configured TTL,
  live Redis TTL, average latency, last access
- Redis memory used (sum of live key sizes), Redis maxmemory when configured, cached object count
- CAAC weights, admission threshold, recency lambda, size penalty, capacity, default TTL

**Frontend-calculated** (labeled in the UI):
- Hit rate %, admission rate %, requests/second, and trend deltas are derived from the real values
  fetched by the poller
- Chart history is kept in browser memory for the current session only — it is snapshot data from
  real fetches, never synthetic

**Unavailable telemetry** (shown honestly, never invented):
- **DB vs Redis latency split** — the backend tracks only aggregate average backend latency, so the
  dual-line latency chart displays `Latency telemetry unavailable`. The component is written so a
  future `series.db` / `series.redis` payload activates it automatically.
- **Redis memory limit** — shown only when Redis actually reports a `maxmemory` configuration;
  otherwise `Memory limit unavailable`.
- If an endpoint is unreachable or missing, the dashboard shows `Backend Offline` /
  `Endpoint unavailable` states with a retry button instead of placeholder metrics.

## Features

- **Polling**: fetches `/api/analytics/stats` + `/api/analytics/weights` every 5s (2s/5s/10s/30s or
  paused, configurable in Settings). Pause/resume and manual refresh live in the header.
- **KPI cards**: cache hit rate (color-coded green >75% / amber 50–75% / red <50%), total requests,
  admission efficiency with progress bar, Redis memory, cost saved.
- **Charts**: hit rate area chart over session snapshots, cumulative decision bar chart
  (HIT/MISS/ADMIT/REJECT/EVICT), CAAC weight radar, admission-threshold gauge.
- **Pages**: Dashboard, Cache Performance (top cached objects), CAAC Weights, Memory & TTL
  (per-object live TTL), Activity Logs, Settings.
- **Responsive**: sidebar becomes a drawer on smaller screens, KPI cards stack, tables scroll
  horizontally.
- **Resilience**: skeleton loaders, offline/error/degraded banners, per-endpoint unavailable states,
  and an error boundary so no data shape can blank the page.

## Project structure

```
frontend/
├── src/
│   ├── components/     Sidebar, Header, KPICard, MemoryCard, charts, ActivityTable,
│   │                   Skeletons, StatePanel, ErrorBoundary, Card, CaacExplanation
│   ├── pages/          Dashboard, CachePerformance, WeightsPage, MemoryTtlPage,
│   │                   ActivityLogsPage, SettingsPage
│   ├── services/       analyticsApi.js (fetch + error classification)
│   ├── hooks/          useAnalytics.js (polling, session history, status)
│   ├── utils/          formatters.js
│   ├── App.jsx         shell, sidebar nav, page switching, global states
│   └── main.jsx
├── .env.example
├── vite.config.js      dev proxy → http://localhost:3000
├── tailwind.config.js
└── package.json
```