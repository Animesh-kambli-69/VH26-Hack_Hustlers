"use strict";

/**
 * Request plan generators for the 8 traffic patterns (A–H).
 *
 * A plan is `{ build(n) -> spec[] | factory(i) -> spec, defaultRequests, notes, overrides }`.
 * `spec` = { url, label, auth? } — auth:true requests need a JWT.
 *
 * All URLs are relative to the backend base URL and reference ONLY endpoints
 * that exist in the ShopVerse backend (verified against src/routes/*).
 */

const GIBBERISH = ["qzkx", "zmp", "krw", "jtxq", "wfl", "pzn", "dkg", "lmv", "rbc", "sxq"];

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function weighted(rng, entries) {
  // entries: [[weight, value], ...] — returns a value
  const total = entries.reduce((s, [w]) => s + w, 0);
  let r = rng() * total;
  for (const [w, v] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][1];
}

/** Hot product codes, weighted 40/30/20/…/rest. */
function hotCode(rng, codes) {
  const top = codes.slice(0, 3);
  const entries = top.map((c, i) => [[0.4, 0.3, 0.2][i], c]);
  if (codes.length > 3) {
    const rest = codes.slice(3);
    entries.push([0.1, () => pick(rng, rest)]);
  }
  return weighted(rng, entries);
}

function realTerm(rng, terms) {
  return pick(rng, terms);
}

function gibberishTerm(rng) {
  return pick(rng, GIBBERISH) + Math.floor(rng() * 90 + 10);
}

function listUrl(rng, pageMax = 40) {
  const page = Math.floor(rng() * pageMax) + 1;
  const limit = pick(rng, [5, 10, 20]);
  return { url: `/api/products?page=${page}&limit=${limit}`, label: `products:list:page=${page}:limit=${limit}` };
}

function mediumListUrl(rng) {
  const page = Math.floor(rng() * 3) + 1;
  const limit = pick(rng, [10, 20]);
  return { url: `/api/products?page=${page}&limit=${limit}`, label: `products:list:page=${page}:limit=${limit}` };
}

function searchUrl(rng, terms) {
  const q = rng() < 0.5 ? realTerm(rng, terms) : gibberishTerm(rng);
  const page = Math.floor(rng() * 3) + 1;
  return { url: `/api/products/search?q=${encodeURIComponent(q)}&page=${page}&limit=10`, label: `products:search:q=${q}:page=${page}:limit=10` };
}

function productUrl(code) {
  return { url: `/api/products/${code}`, label: `product:${code}` };
}

/** Expensive JWT-protected endpoints (only used when a token is available). */
function expensiveSpec(rng, codes, userId) {
  // userId must be a REAL user UUID (the endpoint joins on the users table).
  const uid = userId || "100"; // falls back only if discovery of the user failed
  if (rng() < 0.25) {
    const code = pick(rng, codes);
    return { url: `/api/products/${code}/analytics`, label: `product-analytics:${code}`, auth: true };
  }
  return { url: `/api/recommendations/${uid}`, label: `recommendation:${uid.slice(0, 8)}`, auth: true };
}

/**
 * All patterns. `catalog` is discovered live from the backend:
 * { codes: string[], terms: string[], categoryIds: string[] }
 */
function buildPatterns(catalog) {
  const codes = catalog.codes.length ? catalog.codes : ["ELEC-001", "CLOTH-001", "HOME-001"];
  const terms = catalog.terms.length ? catalog.terms : ["wireless", "headphones", "air"];

  return {
    // A — repeated: same resource, many times
    repeated: {
      defaultRequests: 50,
      build: (n) =>
        Array.from({ length: n }, () => ({
          url: "/api/products?page=1&limit=20",
          label: "products:list:page=1:limit=20",
        })),
      notes: [
        "Single cache key requested N times.",
        "Expected: first request MISS -> ADMIT, then HITs -> rising hit rate.",
      ],
    },

    // B — hot products with skew
    "hot-products": {
      defaultRequests: 100,
      overrides: { rate: 10, concurrency: 4 },
      build: (n, rng, cfg) =>
        Array.from({ length: n }, () => {
          if (cfg.includeExpensive && rng() < 0.15) return expensiveSpec(rng, codes, catalog.userId);
          return productUrl(hotCode(rng, codes));
        }),
      notes: [
        `Hot skew over ${codes.join(", ")} (40/30/20%).`,
        "Expected: hot keys get high frequency scores and stay admitted.",
      ],
    },

    // C — cold / random: many distinct keys
    cold: {
      defaultRequests: 100,
      overrides: { rate: 8 },
      build: (n, rng) =>
        Array.from({ length: n }, () => {
          const r = rng();
          if (r < 0.4) return listUrl(rng, 60);
          if (r < 0.75) return searchUrl(rng, terms);
          return productUrl(pick(rng, codes));
        }),
      notes: [
        "Distinct list pages, searches and product codes — few repeats.",
        "Expected: misses dominate; low frequency -> low scores -> BYPASS/REJECT.",
      ],
    },

    // D — mixed realistic blend
    mixed: {
      defaultRequests: 300,
      overrides: { rate: 10, concurrency: 5 },
      build: (n, rng, cfg) =>
        Array.from({ length: n }, () => {
          if (cfg.includeExpensive && rng() < 0.15) return expensiveSpec(rng, codes, catalog.userId);
          const r = rng();
          if (r < 0.5) return productUrl(hotCode(rng, codes));          // 50% hot
          if (r < 0.75) {                                                // 25% medium
            return rng() < 0.5 ? mediumListUrl(rng) : searchUrl(rng, terms);
          }
          if (r < 0.9) return listUrl(rng, 40);                          // 15% cold
          return rng() < 0.5 ? searchUrl(rng, terms) : productUrl(pick(rng, codes)); // 10% random
        }),
      notes: [
        "50% hot products / 25% medium lists+searches / 15% cold / 10% random.",
      ],
    },

    // E — hit test: sequential repeats with per-request latency + cache.hit
    "hit-test": {
      defaultRequests: 10,
      overrides: { rate: 0, concurrency: 1 },
      build: (n) =>
        Array.from({ length: n }, (_, i) => ({
          url: `/api/products/${codes[0]}`,
          label: `product:${codes[0]}`,
          seq: i + 1,
        })),
      notes: [
        `Sequential GET /api/products/${codes[0]} — table shows status, latency and`,
        "the backend's own cache.hit flag (authoritative; latency alone is NOT proof of a hit).",
      ],
    },

    // F — query variation
    "query-variation": {
      defaultRequests: 40,
      overrides: { rate: 6 },
      build: (n, rng, cfg) => {
        const specs = [];
        const queries = [];
        // Counts are computed so they sum to exactly n.
        const realCount = Math.floor(n * 0.6);
        const categoryCount = cfg.testCategoryId && catalog.categoryIds.length ? Math.ceil(n * 0.15) : 0;
        const gibCount = Math.max(0, n - realCount - categoryCount);
        // Repeat real terms heavily to build frequency per query key
        for (let i = 0; i < realCount; i++) queries.push(realTerm(rng, terms));
        // categoryId variants — CAUTION: see README note (categoryId is NOT in the cache key)
        if (categoryCount) {
          for (let i = 0; i < categoryCount; i++) {
            const id = pick(rng, catalog.categoryIds);
            queries.push(`__category__:${id}`);
          }
        }
        for (let i = 0; i < gibCount; i++) queries.push(gibberishTerm(rng));
        for (const q of queries) {
          if (q.startsWith("__category__:")) {
            const id = q.split(":")[1];
            specs.push({
              url: `/api/products?categoryId=${id}&page=1&limit=10`,
              label: `products:list:page=1:limit=10 (categoryId=${id})`,
            });
          } else {
            specs.push({
              url: `/api/products/search?q=${encodeURIComponent(q)}&page=1&limit=10`,
              label: `products:search:q=${q}:page=1:limit=10`,
            });
          }
        }
        return specs.slice(0, n);
      },
      notes: (cfg) => [
        "Repeated + varied search queries to observe per-key admission.",
        cfg.testCategoryId && catalog.categoryIds.length
          ? "NOTE: ?categoryId= variants share ONE cache key with the plain list " +
            "(categoryId is missing from the backend cache key) — see README."
          : "Use --test-category-id to also exercise ?categoryId= variants.",
      ].filter(Boolean),
    },

    // G — burst: timed baseline/peak cycles
    burst: {
      defaultRequests: 0, // derived from schedule
      schedule: (cfg) => {
        const cycles = [];
        for (let i = 0; i < cfg.burstCycles; i++) {
          cycles.push({ rate: cfg.rate || 5, seconds: 10 });        // normal
          cycles.push({ rate: cfg.burstPeakRate, seconds: 10 });    // burst
          cycles.push({ rate: cfg.rate || 5, seconds: 10 });        // cooldown
        }
        return cycles;
      },
      build: (n, rng) =>
        (function factory(i) {
          const r = rng();
          if (r < 0.5) return productUrl(hotCode(rng, codes));
          if (r < 0.8) return listUrl(rng, 10);
          return searchUrl(rng, terms);
        }),
      notes: (cfg) => [
        `Baseline ${cfg.rate || 5} rps -> peak ${cfg.burstPeakRate} rps -> cooldown, ${cfg.burstCycles} cycle(s).`,
        "Backend rate-limits at ~120 req/min per IP — peak phases will produce 429s",
        "(counted separately, they do NOT reach the CAAC engine).",
      ],
    },

    // H — memory pressure: many distinct keys
    "memory-pressure": {
      defaultRequests: 200,
      overrides: { rate: 15, concurrency: 6 },
      build: (n, rng, cfg) =>
        Array.from({ length: n }, () => {
          const r = rng();
          if (r < 0.45) return listUrl(rng, 60);
          if (r < 0.75) return searchUrl(rng, terms);
          if (r < 0.9) return productUrl(pick(rng, codes));
          if (cfg.includeExpensive) return expensiveSpec(rng, codes, catalog.userId);
          return listUrl(rng, 60);
        }),
      notes: [
        `Cache capacity is ${catalog.capacity ?? 10} objects — many distinct keys force`,
        "ADMIT + EVICT churn once capacity is reached.",
      ],
    },
  };
}

module.exports = { buildPatterns, weighted, pick };