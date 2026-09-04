// ---------------------------------------------------------------------------
// Workload simulator (PRD §3.3–3.4) — synthetic traffic, not real users.
//
// Generates requests with Zipfian key popularity + Poisson (exponential
// inter-arrival) timing, then replays the same stream through every cache
// policy side by side so hit rate / latency / ₹ savings are comparable.
//
// Scenarios:
//   NORMAL     — steady Tuesday mix (60/20/15/5-ish catalogue/searches/detail/orders)
//   BBD_SPIKE  — Big Billion Day 10× burst aimed at expensive keys (iPhone-style)
//   SHIFT      — Diwali → Christmas: the hot set moves mid-run; `timeScale`
//                ages entries faster so decay/TTL visibly retire the old set.
//   COLD_START — flood of one-hit-wonder searches; exercises the admission filter.
// ---------------------------------------------------------------------------

import { createAdaptiveCache } from './adaptiveCache.js';
import { createGdsfCache } from './gdsfCache.js';
import { createNoopCache } from './noopCache.js';
import { metaFor, TYPE_COSTS } from './costModel.js';

// ---------------------------------------------------------------- catalog shape

const CATEGORIES = ['Electronics', 'Fashion', 'Home & Living', 'Books', 'Sports'];
const SORTS = ['none', 'price-asc', 'rating'];
const PRODUCT_IDS = Array.from({ length: 15 }, (_, i) => i + 1);

const listPool = [];
for (const cat of ['all', ...CATEGORIES]) {
  for (const sort of SORTS) {
    listPool.push(`products:list:${cat.toLowerCase()}:any:${sort}`);
  }
}

// ---------------------------------------------------------------- term pools

const TERMS = {
  normal: ['headphones', 'smartwatch', 'speaker', 'camera', 'sneakers', 'jacket',
    'lamp', 'novel', 'backpack', 'laptop', 'phone', 'watch'],
  bbd: ['iphone', 'headphones', 'smartwatch', 'speaker', 'camera', 'power bank',
    'action camera', 'earbuds'],
  diwali: ['diya', 'lights', 'sweets', 'ethnic wear', 'saree', 'gift', 'decor',
    'rangoli', 'puja', 'snacks'],
  christmas: ['gift', 'cake', 'winter', 'tree', 'stocking', 'sweater', 'cookies',
    'toys', 'lights', 'jacket'],
};

// ---------------------------------------------------------------- sampling helpers

function expInterarrival(rate) {
  return -Math.log(1 - Math.random()) / rate;
}

// Zipfian sampler over a pool: rank r (0-based) has weight 1/(r+1)^alpha.
function makeZipf(pool, alpha) {
  const weights = pool.map((_, i) => 1 / Math.pow(i + 1, alpha));
  const cdf = [];
  let sum = 0;
  for (const w of weights) {
    sum += w;
    cdf.push(sum);
  }
  return () => {
    const u = Math.random() * sum;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return pool[lo];
  };
}

function pickWeighted(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let u = Math.random() * total;
  for (const [key, w] of entries) {
    u -= w;
    if (u <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------- scenario defs

const SCENARIOS = {
  NORMAL: {
    label: 'Normal Tuesday — steady Zipf',
    reqPerSec: 200,
    durationSec: 5,
    timeScale: 1,
    phases: [
      {
        start: 0, end: 1,
        classes: [['LIST', 0.4], ['DETAIL', 0.25], ['SEARCH', 0.2], ['ORDERS', 0.15]],
        detailAlpha: 1.2,
        termPool: TERMS.normal,
      },
    ],
  },
  BBD_SPIKE: {
    label: 'Big Billion Day spike — iPhone launch (10×)',
    reqPerSec: 1200,
    durationSec: 4,
    timeScale: 1,
    phases: [
      {
        start: 0, end: 1,
        // 80% of traffic aimed at expensive keys (detail + search on the launch set).
        classes: [['LIST', 0.1], ['DETAIL', 0.45], ['SEARCH', 0.35], ['ORDERS', 0.1]],
        detailPool: [1, 2, 3, 4, 5, 6], // "launch window" — the hot products
        detailAlpha: 2.2,
        termPool: TERMS.bbd,
        searchAlpha: 2.2,
      },
    ],
  },
  SHIFT: {
    label: 'Diwali → Christmas — hot set moves',
    reqPerSec: 250,
    durationSec: 12,
    timeScale: 60, // each simulated second ages entries a full minute
    phases: [
      {
        start: 0, end: 0.5,
        label: 'diwali',
        classes: [['LIST', 0.3], ['DETAIL', 0.25], ['SEARCH', 0.35], ['ORDERS', 0.1]],
        termPool: TERMS.diwali,
      },
      {
        start: 0.5, end: 1,
        label: 'christmas',
        classes: [['LIST', 0.3], ['DETAIL', 0.25], ['SEARCH', 0.35], ['ORDERS', 0.1]],
        termPool: TERMS.christmas,
      },
    ],
  },
  COLD_START: {
    label: 'Cold start — new category launch (unique searches)',
    reqPerSec: 400,
    durationSec: 5,
    timeScale: 1,
    phases: [
      {
        start: 0, end: 0.85,
        classes: [['UNIQUE', 0.85], ['DETAIL', 0.1], ['ORDERS', 0.05]],
        termPool: TERMS.normal,
      },
      {
        start: 0.85, end: 1,
        classes: [['LIST', 0.4], ['DETAIL', 0.3], ['SEARCH', 0.2], ['ORDERS', 0.1]],
        termPool: TERMS.normal,
      },
    ],
  },
};

// ---------------------------------------------------------------- op construction

function makeOp(phase, counters) {
  const cls = pickWeighted(phase.classes);
  if (cls === 'LIST') {
    const key = listPool[Math.floor(Math.random() * listPool.length)];
    return { key, meta: metaFor('CATALOG') };
  }
  if (cls === 'DETAIL') {
    const pool = phase.detailPool || PRODUCT_IDS;
    const id = makeZipf(pool, phase.detailAlpha ?? 1.2)();
    return { key: `product:detail:${id}`, meta: metaFor('DETAIL') };
  }
  if (cls === 'SEARCH') {
    const term = makeZipf(phase.termPool, phase.searchAlpha ?? 1.4)();
    const sort = SORTS[Math.floor(Math.random() * SORTS.length)];
    const sizeMB = Math.min(1.5, TYPE_COSTS.SEARCH.sizeMB + term.length * 0.02);
    return {
      key: `products:list:all:${term}:${sort}`,
      meta: metaFor('SEARCH', { sizeMB }),
    };
  }
  if (cls === 'ORDERS') {
    const customer = 1 + Math.floor(Math.random() * 5);
    return { key: `orders:customer:u${customer}`, meta: metaFor('ORDER') };
  }
  // UNIQUE — a one-hit-wonder search nobody repeats.
  counters.unique += 1;
  return {
    key: `products:list:all:uniq-${counters.unique}:none`,
    meta: metaFor('SEARCH', { sizeMB: 0.9 }),
  };
}

// ---------------------------------------------------------------- percentile

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------- run

export const SCENARIO_IDS = Object.keys(SCENARIOS);

export function runSimulation({ scenario = 'NORMAL', reqPerSec, durationSec, config } = {}) {
  const id = String(scenario).toUpperCase().replace(/[\s-]+/g, '_');
  const def = SCENARIOS[id];
  if (!def) {
    throw new Error(`scenario must be one of: ${SCENARIO_IDS.join(', ')}`);
  }
  const rate = Math.min(2000, Math.max(10, reqPerSec ?? def.reqPerSec));
  const duration = Math.min(30, Math.max(1, durationSec ?? def.durationSec));

  const cfg = {
    capacityMB: config?.capacityMB ?? 15,
    wL: config?.wL ?? 1,
    wM: config?.wM ?? 1,
    lambda: config?.lambda ?? 0.01,
    admission: config?.admission ?? true,
  };

  // Fresh policy instances for a clean, comparable run (io.now reads the sim
  // clock so decay/TTL follow the scenario's simulated time).
  let simNowMs = 0;
  const builders = {
    adaptive: createAdaptiveCache,
    gdsf: createGdsfCache,
    'no-cache': createNoopCache,
  };
  const instances = {};
  const eventLogs = {};
  for (const name of Object.keys(builders)) {
    const events = [];
    eventLogs[name] = events;
    instances[name] = builders[name]({
      now: () => simNowMs,
      ageFactor: def.timeScale,
      onEvent: (e) => {
        if (events.length < 2000) events.push(e);
      },
    });
    instances[name].configure(cfg);
  }

  const startedAt = Date.now();
  let requests = 0;
  let t = 0;
  let guard = 0;
  const counters = { unique: 0 };
  const latencies = Object.fromEntries(Object.keys(builders).map((n) => [n, []]));
  const consumedCost = Object.fromEntries(Object.keys(builders).map((n) => [n, 0]));
  const consumedLatency = Object.fromEntries(Object.keys(builders).map((n) => [n, 0]));
  const opCosts = []; // baseline cost of every op if uncached
  const baselineLatency = [];

  while (t < duration && guard < 200000) {
    guard += 1;
    t += expInterarrival(rate);
    if (t > duration) break;
    requests += 1;
    simNowMs = t * 1000;

    const frac = t / duration;
    const phase = def.phases.find((p) => frac >= p.start && frac < p.end) || def.phases[def.phases.length - 1];
    const { key, meta } = makeOp(phase, counters);

    for (const name of Object.keys(builders)) {
      const policy = instances[name];
      const entry = policy.get(key);
      const isHit = Boolean(entry);
      const ms = isHit ? 2 : meta.costLatency;
      latencies[name].push(ms);
      consumedLatency[name] += ms;
      if (!isHit) consumedCost[name] += meta.costMoney;
      if (!isHit) policy.set(key, { sim: true, key }, meta);
    }
    opCosts.push(meta.costMoney);
    baselineLatency.push(meta.costLatency);
  }

  const baselineCostUsd = opCosts.reduce((a, b) => a + b, 0);
  const baselineLatencyMs = baselineLatency.reduce((a, b) => a + b, 0);
  const msElapsed = Date.now() - startedAt;

  const policies = Object.keys(builders).map((name) => {
    const policy = instances[name];
    const info = policy.info();
    const lat = latencies[name].slice().sort((a, b) => a - b);
    const evictedTypes = {};
    for (const ev of eventLogs[name]) {
      if (ev.reason === 'evict' || ev.reason === 'expire') {
        evictedTypes[ev.type] = (evictedTypes[ev.type] || 0) + 1;
      }
    }
    const moneySavedUsd = Math.max(0, baselineCostUsd - consumedCost[name]);
    const latencySavedMs = Math.max(0, baselineLatencyMs - consumedLatency[name]);
    return {
      policy: name,
      label: name === 'no-cache' ? 'no-cache (Phase 1)' : name,
      hits: info.hits,
      misses: info.misses,
      requests: info.requests,
      hitRate: info.requests ? info.hits / info.requests : 0,
      avgMs: requests ? consumedLatency[name] / requests : 0,
      p50Ms: percentile(lat, 0.5),
      p95Ms: percentile(lat, 0.95),
      p99Ms: percentile(lat, 0.99),
      latencySavedMs,
      moneySavedUsd,
      moneySavedInr: moneySavedUsd * 83,
      entries: info.entries,
      sizeMB: info.sizeMB,
      evictions: info.evictions,
      expirations: info.expirations,
      rejections: info.rejections,
      evictedTypes,
    };
  });

  const report = {
    scenario: id,
    label: def.label,
    timeScale: def.timeScale,
    reqPerSec: rate,
    durationSec: duration,
    requests,
    msElapsed,
    startedAt: new Date().toISOString(),
    baseline: {
      requests,
      costUsd: baselineCostUsd,
      latencyMs: baselineLatencyMs,
    },
    config: cfg,
    policies,
  };
  return report;
}
