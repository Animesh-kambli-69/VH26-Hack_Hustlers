const prisma = require("../../config/prisma");
const { calculateRecency, calculateTrend } = require("./scoreCalculator");

const keySafe = key => key;
async function getMetric(cacheKey) {
  return prisma.cacheMetric.findUnique({ where: { cacheKey: keySafe(cacheKey) } });
}
async function touchMetric(cacheKey, type, latencyMs=0, retrievalCost=0, objectSizeBytes=0, ttlSeconds=60) {
  const existing = await getMetric(cacheKey);
  const now = new Date();
  if (!existing) {
    return prisma.cacheMetric.create({
      data: {
        cacheKey, accessCount:1, hitCount:type==="hit"?1:0, missCount:type==="miss"?1:0,
        lastAccessAt:now, firstAccessAt:now, recentAccessCount:1,
        avgLatencyMs:latencyMs, retrievalCost, objectSizeBytes, ttlSeconds
      }
    });
  }
  const accessCount = existing.accessCount + 1;
  const avgLatencyMs = ((existing.avgLatencyMs * existing.accessCount) + latencyMs) / accessCount;
  const recentAccessCount = Math.min(100, existing.recentAccessCount + 1);
  const trendScore = calculateTrend(recentAccessCount, Math.max(1, accessCount));
  return prisma.cacheMetric.update({
    where:{cacheKey},
    data:{
      accessCount,
      hitCount: existing.hitCount + (type==="hit"?1:0),
      missCount: existing.missCount + (type==="miss"?1:0),
      lastAccessAt:now, recentAccessCount, avgLatencyMs,
      retrievalCost: retrievalCost || existing.retrievalCost,
      objectSizeBytes: objectSizeBytes || existing.objectSizeBytes,
      trendScore, ttlSeconds
    }
  });
}
module.exports = { getMetric, touchMetric };
