"use strict";

/**
 * Reads the backend's real analytics telemetry:
 *   GET /api/analytics/stats   (cumulative cache metrics + decision log)
 *   GET /api/analytics/weights (CAAC weights + admission threshold)
 */

async function fetchJson(baseUrl, path, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(baseUrl + path, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStats(baseUrl, timeoutMs = 8000) {
  return fetchJson(baseUrl, "/api/analytics/stats", timeoutMs);
}

async function fetchWeights(baseUrl, timeoutMs = 8000) {
  return fetchJson(baseUrl, "/api/analytics/weights", timeoutMs);
}

/**
 * Fetch with retry/backoff. Needed because the backend rate-limits per IP
 * (~120 req/min): a heavy traffic run can 429 the post-test snapshot. 429s are
 * retried; other HTTP errors fail fast.
 */
async function fetchWithRetry(baseUrl, path, { timeoutMs = 8000, attempts = 5, label = "analytics" } = {}) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchJson(baseUrl, path, timeoutMs);
    } catch (err) {
      lastErr = err;
      if (!/HTTP 429/.test(err.message)) throw err; // only rate-limit waits are retried
      const wait = Math.min(20000, 2000 * 2 ** i);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

/** Deltas between two cumulative snapshots — what THIS test contributed. */
function diffStats(before, after) {
  const b = before.summary, a = after.summary;
  const bd = before.decisionLog, ad = after.decisionLog;
  const requests = a.totalRequests - b.totalRequests;
  const hits = a.hits - b.hits;
  const misses = a.misses - b.misses;
  return {
    requests, hits, misses,
    hitRateTest: requests > 0 ? hits / requests : null, // test-only hit rate
    hitRateBefore: b.hitRate ?? null,
    hitRateAfter: a.hitRate ?? null,
    admit: (ad.admit || 0) - (bd.admit || 0),
    reject: (ad.bypass || 0) - (bd.bypass || 0),
    evict: (ad.evict || 0) - (bd.evict || 0),
    retain: (ad.retain || 0) - (bd.retain || 0),
    refresh: (ad.refresh || 0) - (bd.refresh || 0),
    other: (ad.other || 0) - (bd.other || 0),
    cachedObjectsBefore: before.redis?.cachedObjectCount ?? 0,
    cachedObjectsAfter: after.redis?.cachedObjectCount ?? 0,
    redisMemoryBefore: before.redis?.memoryUsedBytes ?? 0,
    redisMemoryAfter: after.redis?.memoryUsedBytes ?? 0,
  };
}

module.exports = { fetchStats, fetchWeights, fetchWithRetry, diffStats };