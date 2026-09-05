"use strict";

/**
 * ShopVerse CAAC API Traffic Generator
 *
 * Generates real HTTP traffic against the running ShopVerse backend to
 * exercise the Cost-Aware Adaptive Cache (CAAC) engine, then reports the
 * before/after analytics deltas from the backend's own telemetry endpoints.
 *
 * Run:  node traffic-generator.js --pattern <name> [options]
 * Docs: tests/api-traffic/README.md
 */

const { parseArgs, DEFAULTS } = require("./config");
const { buildPatterns } = require("./lib/patterns");
const { sendRequest, pingHealth } = require("./lib/request");
const { fetchStats, fetchWeights, fetchWithRetry, diffStats } = require("./lib/analytics");
const { buildReport } = require("./lib/report");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- discovery

/** Discover real products/terms/categories from the backend (no assumptions). */
async function discover(baseUrl, timeoutMs) {
  const fetchJson = async (path) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(baseUrl + path, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  };

  const catalog = { codes: [], terms: [], categoryIds: [], capacity: null };

  try {
    const list = await fetchJson("/api/products?page=1&limit=50");
    const items = list.items || [];
    catalog.codes = items.map((i) => i.code).filter(Boolean);
    const seen = new Set();
    for (const it of items) {
      for (const w of String(it.name || "").toLowerCase().split(/\s+/)) {
        if (w.length >= 3 && !seen.has(w)) { seen.add(w); catalog.terms.push(w); }
      }
    }
  } catch (err) {
    console.warn(`[warn] product discovery failed (${err.message}) — using fallback codes`);
  }

  try {
    const cats = await fetchJson("/api/products/categories");
    catalog.categoryIds = (cats || []).map((c) => c.id).filter(Boolean);
  } catch { /* optional */ }

  try {
    const w = await fetchWeights(baseUrl);
    catalog.capacity = w.capacityObjects ?? null;
  } catch { /* optional */ }

  return catalog;
}

// ---------------------------------------------------------------- token

/**
 * Obtain a JWT and a real user id: explicit --token (with --user-id), or
 * register a throwaway user behind --write-test. The recommendation endpoint
 * joins on the users table, so a REAL user UUID is required (integers fail).
 */
async function acquireToken(cfg) {
  let token = cfg.token;
  let userId = null;

  if (!token && cfg.writeTest && cfg.includeExpensive) {
    const email = `traffic-${Date.now()}@traffic.local`;
    const password = "Traffic@12345!";
    console.log(`[*] --write-test: registering throwaway user ${email}`);
    const res = await sendRequest(
      cfg.baseUrl,
      {
        url: "/api/auth/register",
        method: "POST",
        label: "auth:register",
        body: { name: "Traffic Bot", email, password },
      },
      { timeoutMs: cfg.timeoutMs }
    );
    if (res.status === 201 && res.body && res.body.accessToken) {
      token = res.body.accessToken;
      console.log("[*] token acquired (USER role) — expensive endpoints enabled");
    } else {
      console.warn(`[warn] register failed (HTTP ${res.status}) — continuing without protected endpoints`);
      return { token: null, userId: null };
    }
  }

  if (token) {
    // Resolve the token owner's real UUID for the recommendation endpoint.
    const me = await sendRequest(
      cfg.baseUrl,
      { url: "/api/auth/me", label: "auth:me", auth: true },
      { timeoutMs: cfg.timeoutMs, token }
    ).catch(() => null);
    if (me && me.body && me.body.id) userId = me.body.id;
  }
  return { token, userId };
}

// ---------------------------------------------------------------- execution

function makeTally() {
  return {
    requests: 0,
    cacheHits: 0,
    cacheHitSeen: 0,
    latencies: [],
    statusCounts: { ok: 0, notFound: 0, rateLimited: 0, httpError: 0, network: 0, timeout: 0, other: 0 },
    hitTestRows: [],
    errors: [],
  };
}

function tallyResult(tally, result) {
  tally.requests++;
  tally.latencies.push(result.latencyMs);
  tally.statusCounts[result.kind] = (tally.statusCounts[result.kind] || 0) + 1;
  if (result.cacheHit !== null) {
    tally.cacheHitSeen++;
    if (result.cacheHit) tally.cacheHits++;
  }
  if (result.error) {
    tally.errors.push(`${result.label || result.url}: ${result.error}`);
    if (tally.errors.length > 10) tally.errors.length = 10;
  }
  if (result.seq) tally.hitTestRows.push(result);
  return result;
}

/** Run `count` requests at `paceMs` spacing, bounded by `concurrency`. */
async function runPaced({ count, paceMs, source, config, tally, token, before, onProgress }) {
  let active = 0;
  let resolveSlot = null;
  let slotPromise = null;
  const pending = new Set();
  let nextMonitor = config.monitorInterval;
  let monitoring = false;

  const getSlot = async () => {
    while (active >= config.concurrency) {
      if (!slotPromise) slotPromise = new Promise((r) => (resolveSlot = r));
      await slotPromise;
    }
    active++;
  };
  const releaseSlot = () => {
    active--;
    if (resolveSlot && active < config.concurrency) {
      const r = resolveSlot;
      resolveSlot = null;
      slotPromise = null;
      r();
    }
  };

  const handler = async (spec) => {
    const result = await sendRequest(config.baseUrl, spec, { timeoutMs: config.timeoutMs, token });
    if (spec.seq) result.seq = spec.seq;
    tallyResult(tally, result);

    if (onProgress && tally.requests >= nextMonitor) {
      nextMonitor += config.monitorInterval;
      if (!monitoring) {
        monitoring = true;
        fetchStats(config.baseUrl, config.timeoutMs)
          .then((mid) => {
            if (!config.quiet) {
              const d = diffStats(before, mid);
              console.log(
                `[live] ${tally.requests}/${count}  hit-rate ${((d.hitRateAfter ?? 0) * 100).toFixed(1)}%  ` +
                  `delta: +${d.hits} hits +${d.misses} misses  +ADMIT ${d.admit} +REJECT ${d.reject} +EVICT ${d.evict}`
              );
            }
          })
          .catch(() => {})
          .finally(() => (monitoring = false));
      }
    }
    return result;
  };

  const startOne = (i) => {
    const p = (async () => {
      await getSlot();
      try {
        const spec = typeof source === "function" ? source(i) : source[i];
        if (spec) await handler(spec);
      } finally {
        releaseSlot();
      }
    })();
    pending.add(p);
    p.finally(() => pending.delete(p));
  };

  const producer = (async () => {
    for (let i = 0; i < count; i++) {
      if (global.__trafficStopped) break;
      startOne(i);
      if (paceMs > 0) await sleep(paceMs);
    }
  })();

  await producer;
  await Promise.all([...pending]);
}

// ---------------------------------------------------------------- main

async function main() {
  let cfg;
  try {
    cfg = parseArgs(process.argv);
  } catch (err) {
    console.error(`[error] ${err.message}`);
    console.error(`Run with --help for usage.`);
    process.exit(1);
  }

  console.log("========================================");
  console.log("ShopVerse CAAC API Traffic Generator");
  console.log("========================================");
  console.log(`Pattern:    ${cfg.pattern}`);
  console.log(`Backend:    ${cfg.baseUrl}`);
  console.log(`Rate:       ${cfg.rate} req/s   Concurrency: ${cfg.concurrency}`);
  console.log("");

  // 1. Reachability — retry a few times: the backend runs under nodemon and can
  //    be mid-restart (e.g. after repo file edits). Fail with a clear message.
  let reachable = false;
  for (let attempt = 1; attempt <= 4; attempt++) {
    if (await pingHealth(cfg.baseUrl, 3000)) { reachable = true; break; }
    if (attempt < 4) await sleep(1000 * attempt);
  }
  if (!reachable) {
    console.error(`[error] Cannot reach ${cfg.baseUrl}/health (4 attempts).`);
    console.error("        Is the ShopVerse backend running? (npm run dev, port 3000)");
    console.error("        Is Redis + PostgreSQL up? Check src/config/redis.js / prisma.");
    process.exit(1);
  }
  try {
    await fetchWithRetry(cfg.baseUrl, "/api/analytics/stats", { timeoutMs: cfg.timeoutMs });
    await fetchWithRetry(cfg.baseUrl, "/api/analytics/weights", { timeoutMs: cfg.timeoutMs });
  } catch (err) {
    console.error(`[error] Analytics endpoints unreachable: ${err.message}`);
    console.error("        Need GET /api/analytics/stats and GET /api/analytics/weights.");
    process.exit(1);
  }

  // 2. Discover real catalog (product codes, search terms, category IDs).
  const catalog = await discover(cfg.baseUrl, cfg.timeoutMs);
  console.log(`[*] discovered ${catalog.codes.length} product(s): ${catalog.codes.join(", ") || "none"}`);

  // 3. Optional JWT for expensive endpoints (+ real user UUID for recommendations).
  const { token, userId } = await acquireToken(cfg);
  catalog.userId = userId;

  // 4. Baseline snapshot.
  const before = await fetchStats(cfg.baseUrl, cfg.timeoutMs);
  console.log(
    `[*] baseline: ${before.summary.totalRequests} total requests, ` +
      `hit rate ${(before.summary.hitRate * 100).toFixed(1)}%, ` +
      `cached objects ${before.redis.cachedObjectCount}`
  );
  console.log("");

  // 5. Build the plan.
  const patterns = buildPatterns(catalog);
  const pattern = patterns[cfg.pattern];
  if (!pattern) { console.error(`[error] unknown pattern ${cfg.pattern}`); process.exit(1); }

  // Pattern defaults (rate/concurrency) apply only when the user didn't set them explicitly.
  if (pattern.overrides) {
    for (const [key, value] of Object.entries(pattern.overrides)) {
      if (!(cfg.__explicit && cfg.__explicit.has(key))) cfg[key] = value;
    }
  }

  const totalRequests =
    cfg.requests ?? (cfg.duration ? Math.round((cfg.rate || 1) * cfg.duration) : pattern.defaultRequests);

  const tally = makeTally();
  const startedAt = Date.now();

  global.__trafficStopped = false;
  let sigintHandled = false;
  process.on("SIGINT", () => {
    if (sigintHandled) return;
    sigintHandled = true;
    global.__trafficStopped = true;
    console.log("\n[!] Ctrl+C received — finishing in-flight requests, then reporting partial results...");
  });

  const schedule = typeof pattern.schedule === "function" ? pattern.schedule(cfg) : null;
  if (schedule) {
    console.log(`[*] burst schedule: ${schedule.map((p) => `${p.rate} rps x ${p.seconds}s`).join(" -> ")}`);
    console.log("    NOTE: backend rate-limiter (~120 req/min per IP) will return 429s during peaks.");
    console.log("");
    // burst's build() returns a per-request factory: build(n, rng) -> (i) => spec
    const burstFactory = pattern.build(0, Math.random);
    for (const phase of schedule) {
      if (global.__trafficStopped) break;
      const n = Math.round(phase.rate * phase.seconds);
      const paceMs = phase.rate > 0 ? 1000 / phase.rate : 0;
      await runPaced({
        count: n, paceMs, source: burstFactory, config: cfg, tally, token, before,
        onProgress: !cfg.quiet,
      });
      if (!cfg.quiet) {
        console.log(`[phase] done ${phase.rate} rps phase — ${tally.requests} requests so far`);
      }
    }
  } else {
    const paceMs = cfg.rate > 0 ? 1000 / cfg.rate : 0;
    const source = pattern.build(totalRequests, Math.random, cfg);
    await runPaced({ count: totalRequests, paceMs, source, config: cfg, tally, token, before, onProgress: !cfg.quiet });
  }

  const durationMs = Date.now() - startedAt;

  // 6. Final snapshot + diff. Heavy runs can exhaust the backend rate limiter,
  //    so the snapshot retries 429s with backoff.
  const after = await fetchWithRetry(cfg.baseUrl, "/api/analytics/stats", { timeoutMs: cfg.timeoutMs, label: "final stats" })
    .catch((err) => {
      console.error(`[error] final stats fetch failed: ${err.message}`);
      return null;
    });

  const diff = after ? diffStats(before, after) : null;
  const weights = await fetchWithRetry(cfg.baseUrl, "/api/analytics/weights", { timeoutMs: cfg.timeoutMs, label: "weights" })
    .catch(() => null);

  // 7. Report.
  const report = buildReport({
    pattern: cfg.pattern,
    cfg,
    plan: { notes: typeof pattern.notes === "function" ? pattern.notes(cfg) : pattern.notes },
    run: {
      requests: tally.requests,
      durationMs,
      latencies: tally.latencies,
      cacheHits: tally.cacheHits,
      cacheHitSeen: tally.cacheHitSeen,
      statusCounts: tally.statusCounts,
      beforeTotal: before.summary.totalRequests,
      afterTotal: after ? after.summary.totalRequests : before.summary.totalRequests,
      errors: tally.errors,
    },
    diff: diff ?? {
      requests: 0, hits: 0, misses: 0, hitRateBefore: null, hitRateAfter: null, hitRateTest: null,
      admit: 0, reject: 0, evict: 0, retain: 0, refresh: 0, other: 0,
      cachedObjectsBefore: 0, cachedObjectsAfter: 0, redisMemoryBefore: 0, redisMemoryAfter: 0,
    },
    weights,
    catalog,
    stoppedEarly: global.__trafficStopped,
  });

  console.log(report);

  // Hit-test table (Pattern E) — per-request latency + authoritative cache.hit flag.
  if (cfg.pattern === "hit-test" && tally.hitTestRows.length) {
    console.log("HIT TEST  (per-request, sequential)");
    console.log("-".repeat(40));
    console.log("Req  Status  Latency  cache.hit (backend flag)");
    for (const r of tally.hitTestRows) {
      const hit = r.cacheHit === null ? "-" : r.cacheHit ? "HIT" : "MISS";
      console.log(`${String(r.seq).padStart(3)}  ${String(r.status).padStart(6)}  ${r.latencyMs.toFixed(1).padStart(7)}ms  ${hit}`);
    }
    const served = tally.cacheHits;
    console.log("-".repeat(40));
    console.log(`Requests served from Redis (cache.hit=true): ${served}/${tally.hitTestRows.length}`);
    console.log("");
  }

  if (tally.errors.length) {
    console.log("REQUEST ERRORS (first 10):");
    for (const e of tally.errors) console.log(`  - ${e}`);
    console.log("");
  }

  if (sigintHandled) {
    console.log("Partial results reported after Ctrl+C.");
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});