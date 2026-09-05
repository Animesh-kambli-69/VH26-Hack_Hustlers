"use strict";

/** ASCII test report — every number comes from real measurements/telemetry. */

const BAR = "=".repeat(44);
const LINE = "-".repeat(40);
const PAD = (s, w) => String(s).padStart(w, " ");

function fmtPct(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return `${(x * 100).toFixed(2)}%`;
}

function fmtInt(x) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "n/a";
  return Number(x).toLocaleString("en-US");
}

function fmtBytes(b) {
  if (b === null || b === undefined || !Number.isFinite(b) || b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let v = b, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
}

function buildReport({ pattern, cfg, plan, run, diff, weights, catalog, stoppedEarly }) {
  const latency = run.latencies;
  const sorted = [...latency].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1))];
  const ok = latency.length
    ? {
        avg: latency.reduce((a, b) => a + b, 0) / latency.length,
        min: Math.min(...latency),
        max: Math.max(...latency),
        p95: pct(0.95),
        p99: pct(0.99),
      }
    : { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };

  const observedHits = run.cacheHits;
  const observedTotal = run.cacheHitSeen; // responses that carried a cache.hit flag
  const observedRate = observedTotal > 0 ? observedHits / observedTotal : null;

  const lines = [];
  const out = (s = "") => lines.push(s);

  out(BAR);
  out("ShopVerse CAAC Traffic Test");
  out(BAR);
  out("");
  out(`Test Pattern: ${pattern}${stoppedEarly ? "  (STOPPED EARLY — Ctrl+C)" : ""}`);
  out(`Duration:     ${(run.durationMs / 1000).toFixed(1)} seconds`);
  out(`Requests Generated: ${fmtInt(run.requests)}`);
  out(`Average Requests/sec: ${run.durationMs > 0 ? (run.requests / (run.durationMs / 1000)).toFixed(2) : "n/a"}`);
  out(`Concurrency:  ${cfg.concurrency}`);
  out(`Backend:      ${cfg.baseUrl}`);
  out("");
  if (catalog.codes.length) out(`Discovered products: ${catalog.codes.join(", ")}`);

  out("");
  out("CACHE PERFORMANCE  (backend telemetry delta)");
  out(LINE);
  out(`Initial Requests: ${fmtInt(run.beforeTotal)}`);
  out(`Final Requests:   ${fmtInt(run.afterTotal)}`);
  out(`Requests Generated: ${fmtInt(diff.requests)}`);
  out(`Hits:       ${fmtInt(diff.hits)}`);
  out(`Misses:     ${fmtInt(diff.misses)}`);
  out(`Hit Rate:   ${fmtPct(diff.hitRateBefore)} -> ${fmtPct(diff.hitRateAfter)}`);
  if (diff.hitRateTest !== null) out(`Hit Rate (test-only): ${fmtPct(diff.hitRateTest)}`);

  out("");
  out("CLIENT-OBSERVED  (cache.hit flag in API responses)");
  out(LINE);
  out(`Hits:       ${fmtInt(observedHits)}`);
  out(`Misses:     ${fmtInt(observedTotal - observedHits)}`);
  out(`Hit Rate:   ${fmtPct(observedRate)}`);
  out(`(of ${fmtInt(observedTotal)} responses carrying the backend cache.hit flag)`);

  out("");
  out("CAAC DECISIONS  (backend decision-log delta)");
  out(LINE);
  out(`ADMIT:      +${fmtInt(diff.admit)}`);
  out(`REJECT:     +${fmtInt(diff.reject)}   (action BYPASS — below admission threshold)`);
  out(`EVICT:      +${fmtInt(diff.evict)}`);
  if (diff.retain || diff.refresh || diff.other) {
    out(`retain/refresh/other: +${fmtInt(diff.retain)}/+${fmtInt(diff.refresh)}/+${fmtInt(diff.other)}`);
  }

  out("");
  out("LATENCY  (measured per request)");
  out(LINE);
  out(`Average: ${ok.avg.toFixed(1)} ms`);
  out(`Minimum: ${ok.min.toFixed(1)} ms`);
  out(`Maximum: ${ok.max.toFixed(1)} ms`);
  out(`p95:     ${ok.p95.toFixed(1)} ms`);
  out(`p99:     ${ok.p99.toFixed(1)} ms`);

  out("");
  out("STATUS BREAKDOWN");
  out(LINE);
  const statuses = run.statusCounts;
  out(`2xx: ${fmtInt(statuses.ok)}  404: ${fmtInt(statuses.notFound)}  429 (rate-limited): ${fmtInt(statuses.rateLimited)}`);
  out(`HTTP errors: ${fmtInt(statuses.httpError)}  network/timeout: ${fmtInt(statuses.network + statuses.timeout)}`);

  if (weights) {
    out("");
    out("CAAC WEIGHTS  (live from /api/analytics/weights)");
    out(LINE);
    const w = weights.weights || {};
    out(`Frequency ${w.frequency}   Recency ${w.recency}   Retrieval Cost ${w.retrievalCost}`);
    out(`Latency ${w.latency}   Trend ${w.trend}`);
    out(`Admission threshold: ${weights.admissionThreshold}   Capacity: ${weights.capacityObjects} objects   TTL: ${weights.defaultTtlSeconds}s`);
  }

  out("");
  out("REDIS / CACHE STATE");
  out(LINE);
  out(`Cached objects in Redis: ${fmtInt(diff.cachedObjectsBefore)} -> ${fmtInt(diff.cachedObjectsAfter)}`);
  out(`Redis memory used: ${fmtBytes(diff.redisMemoryBefore)} -> ${fmtBytes(diff.redisMemoryAfter)}`);

  if (plan && plan.notes && plan.notes.length) {
    out("");
    out("PATTERN NOTES");
    out(LINE);
    for (const note of plan.notes) out(`- ${note}`);
  }
  out("");
  out(BAR);
  out("All metrics above are real: backend telemetry deltas, response cache.hit");
  out("flags, and locally measured latencies. Nothing is fabricated.");
  out(BAR);
  out("");

  return lines.join("\n");
}

module.exports = { buildReport, fmtPct, fmtInt, fmtBytes };