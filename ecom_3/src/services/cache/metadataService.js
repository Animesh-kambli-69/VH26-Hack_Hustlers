const prisma = require("../../config/prisma");
const { calculateRecency, calculateTrend } = require("./scoreCalculator");

const keySafe = key => key;
async function getMetric(cacheKey) {
  return prisma.cacheMetric.findUnique({ where: { cacheKey: keySafe(cacheKey) } });
}
async function touchMetric(cacheKey, type, latencyMs=0, retrievalCost=0, objectSizeBytes=0, ttlSeconds=60) {
  // Concurrent requests touch the same metric row (read-modify-write). Without
  // serialization, parallel reads race and increments are lost — undercounted
  // hits/misses in telemetry.
  //
  // Fast path (hits): a single atomic increment update — no lock needed, and
  // cheaper than the read-then-write. trendScore is display-only (the score
  // engine recomputes trend from recentAccessCount/accessCount), so it is left
  // as-is on hits.
  if (type === "hit") {
    try {
      return await prisma.cacheMetric.update({
        where: { cacheKey },
        data: {
          accessCount: { increment: 1 },
          hitCount: { increment: 1 },
          recentAccessCount: { increment: 1 },
          lastAccessAt: new Date()
        }
      });
    } catch (err) {
      if (err.code !== "P2025") throw err;
      // Row missing (unusual) — fall through to the transactional create/update path.
    }
  }

  // Miss/create path: needs the previous accessCount for avgLatencyMs, so lock
  // the row for the duration of the read-modify-write; concurrent touches then
  // serialize. The upsert fallback covers the race where two first-touches both
  // see no row yet.
  // Note: the default interactive-transaction timeout is 5s, which remote/slow
  // databases can exceed under load — raise it explicitly.
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "CacheMetric" WHERE "cacheKey" = ${cacheKey} FOR UPDATE`;
    const existing = await tx.cacheMetric.findUnique({ where: { cacheKey } });
    const now = new Date();
    if (!existing) {
      return tx.cacheMetric.upsert({
        where: { cacheKey },
        create: {
          cacheKey, accessCount:1, hitCount:type==="hit"?1:0, missCount:type==="miss"?1:0,
          lastAccessAt:now, firstAccessAt:now, recentAccessCount:1,
          avgLatencyMs:latencyMs, retrievalCost, objectSizeBytes, ttlSeconds
        },
        update: {}
      });
    }
    const accessCount = existing.accessCount + 1;
    const avgLatencyMs = ((existing.avgLatencyMs * existing.accessCount) + latencyMs) / accessCount;
    const recentAccessCount = Math.min(100, existing.recentAccessCount + 1);
    const trendScore = calculateTrend(recentAccessCount, Math.max(1, accessCount));
    return tx.cacheMetric.update({
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
  }, { timeout: 20000 });
}
module.exports = { getMetric, touchMetric };
