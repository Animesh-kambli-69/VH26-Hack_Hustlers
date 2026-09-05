const prisma = require("../../config/prisma");
const redis = require("../../config/redis");
const { cache, weights, recencyLambda, sizePenaltyFactor } = require("../../config/env");
const { dataKey, listKeys } = require("../cache/cacheService");

const sum = (rows, fn) => rows.reduce((s, r) => s + fn(r), 0);

// Decision reasons are a Json column — older rows can store a bare string or an
// object instead of an array. Normalize to a string array so the dashboard can
// render any row safely.
function normalizeReason(reason) {
  if (Array.isArray(reason)) return reason.map(r => (typeof r === "string" ? r : String(r)));
  if (typeof reason === "string") return [reason];
  if (reason && typeof reason === "object") {
    const strings = Object.values(reason).filter(v => typeof v === "string");
    if (strings.length) return strings;
    try { return [JSON.stringify(reason)]; } catch { return []; }
  }
  return [];
}

async function getStats() {
  const [metricRows, decisionRows, actionGroups] = await Promise.all([
    prisma.cacheMetric.findMany(),
    prisma.cacheDecision.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.cacheDecision.groupBy({ by: ["action"], _count: { _all: true } }),
  ]);
  const metrics = metricRows;
  const recentDecisions = decisionRows.map(d => ({ ...d, reason: normalizeReason(d.reason) }));

  const totalRequests = sum(metrics, r => r.accessCount);
  const hits = sum(metrics, r => r.hitCount);
  const misses = sum(metrics, r => r.missCount);
  const safeTotal = totalRequests || 1;

  const decisionLog = { admit: 0, bypass: 0, evict: 0, retain: 0, refresh: 0, other: 0 };
  const actionKey = { ADMIT: "admit", BYPASS: "bypass", EVICT: "evict", RETAIN: "retain", REFRESH: "refresh" };
  actionGroups.forEach(g => {
    const key = actionKey[g.action];
    decisionLog[key || "other"] += g._count._all;
  });

  // Redis telemetry is best-effort: the dashboard must keep working (with DB
  // stats) even when Redis is unreachable.
  let redisTelemetry = { connected: false, error: null };
  let memoryUsedBytes = 0;
  let maxMemoryBytes = null;
  let cachedObjectCount = 0;
  const ttlByKey = {};
  try {
    const keys = await listKeys();
    cachedObjectCount = keys.length;
    const ttlValues = await Promise.all(keys.map(k => redis.ttl(dataKey(k)).catch(() => null)));
    const memValues = await Promise.all(keys.map(k => redis.memoryUsage(dataKey(k)).catch(() => 0)));
    keys.forEach((k, i) => { ttlByKey[k] = ttlValues[i]; });
    memoryUsedBytes = memValues.reduce((a, b) => a + (b || 0), 0);
    const cfg = await redis.configGet("maxmemory");
    maxMemoryBytes = Number(cfg?.maxmemory) > 0 ? Number(cfg.maxmemory) : null;
    redisTelemetry = { connected: true, error: null };
  } catch (err) {
    redisTelemetry = { connected: false, error: err.message };
  }

  const objects = metrics
    .map(m => ({
      cacheKey: m.cacheKey,
      hitCount: m.hitCount,
      missCount: m.missCount,
      accessCount: m.accessCount,
      avgLatencyMs: m.avgLatencyMs,
      retrievalCost: m.retrievalCost,
      objectSizeBytes: m.objectSizeBytes,
      currentScore: m.currentScore,
      trendScore: m.trendScore,
      ttlSeconds: m.ttlSeconds,
      redisTtlSeconds: ttlByKey[m.cacheKey] ?? null,
      lastAccessAt: m.lastAccessAt,
    }))
    .sort((a, b) => b.currentScore - a.currentScore);

  return {
    generatedAt: new Date().toISOString(),
    period: "cumulative",
    summary: {
      totalRequests,
      hits,
      misses,
      hitRate: hits / safeTotal,
      missRate: misses / safeTotal,
      avgLatencyMs: metrics.length ? sum(metrics, r => r.avgLatencyMs) / metrics.length : 0,
      backendCalls: misses,
      estimatedBackendCost: sum(metrics, r => r.retrievalCost * r.missCount),
      estimatedCostSaved: sum(metrics, r => r.retrievalCost * r.hitCount),
      capacityObjects: cache.capacity,
      defaultTtlSeconds: cache.defaultTtl,
    },
    decisionLog,
    redis: {
      connected: redisTelemetry.connected,
      error: redisTelemetry.error,
      memoryUsedBytes,
      maxMemoryBytes,
      capacityObjects: cache.capacity,
      cachedObjectCount,
    },
    objects,
    recentDecisions,
  };
}

function getWeights() {
  return {
    generatedAt: new Date().toISOString(),
    weights: {
      frequency: weights.frequency,
      recency: weights.recency,
      retrievalCost: weights.cost,
      latency: weights.latency,
      trend: weights.trend,
    },
    admissionThreshold: cache.admissionThreshold,
    recencyLambda,
    sizePenaltyFactor,
    capacityObjects: cache.capacity,
    defaultTtlSeconds: cache.defaultTtl,
  };
}

module.exports = { getStats, getWeights };