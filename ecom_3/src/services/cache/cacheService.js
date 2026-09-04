const redis = require("../../config/redis");
const { cache } = require("../../config/env");
const { getMetric, touchMetric } = require("./metadataService");
const { evaluate, decideAdmission } = require("./caacEngine");
const prisma = require("../../config/prisma");

const dataKey = key => `cache:data:${key}`;
const metaKey = key => `cache:metadata:${key}`;

async function listKeys() {
  const keys = await redis.keys("cache:data:*");
  return keys.map(k => k.replace("cache:data:",""));
}
async function getCached(cacheKey) {
  const raw = await redis.get(dataKey(cacheKey));
  if (raw == null) return null;
  let value; try { value = JSON.parse(raw); } catch { value = raw; }
  await redis.hSet(metaKey(cacheKey), { lastAccessAt: new Date().toISOString() });
  await touchMetric(cacheKey, "hit");
  return value;
}
async function lowestScore() {
  const keys = await listKeys();
  if (!keys.length) return null;
  const rows = await Promise.all(keys.map(async key => {
    const metric = await getMetric(key);
    return { key, score: metric ? evaluate(metric).finalScore : 0 };
  }));
  return rows.sort((a,b)=>a.score-b.score)[0];
}
async function remove(cacheKey, reason="manual") {
  await redis.del(dataKey(cacheKey), metaKey(cacheKey));
  await prisma.cacheDecision.create({
    data:{ cacheKey, action:"EVICT", score:0, reason:[reason], retrievalCost:0, latencyMs:0, objectSizeBytes:0 }
  });
}
async function put(cacheKey, value, costInfo) {
  const serialized = JSON.stringify(value);
  const objectSizeBytes = Buffer.byteLength(serialized);
  let metric = await getMetric(cacheKey);
  if (!metric) {
    metric = await touchMetric(cacheKey, "miss", costInfo.latencyMs, costInfo.retrievalCost, objectSizeBytes, cache.defaultTtl);
  }
  const evaluated = evaluate(metric, { maxCost: Math.max(10, costInfo.retrievalCost), maxLatencyMs: Math.max(3000, costInfo.latencyMs) });
  const lowest = (await listKeys()).length >= cache.capacity ? await lowestScore() : null;
  await prisma.cacheMetric.update({ where:{cacheKey}, data:{ currentScore:evaluated.finalScore } });
  const decision = decideAdmission(evaluated.finalScore, lowest?.score ?? null);
  let evicted = null;
  if (decision.action === "ADMIT") {
    if (lowest) {
      evicted = lowest.key;
      await remove(lowest.key, `lower score (${lowest.score.toFixed(4)}) than new object (${evaluated.finalScore.toFixed(4)})`);
    }
    await redis.set(dataKey(cacheKey), serialized, { EX: cache.defaultTtl });
    await redis.hSet(metaKey(cacheKey), {
      cacheKey, currentScore:String(evaluated.finalScore), objectSizeBytes:String(objectSizeBytes),
      createdAt:new Date().toISOString(), expiresIn:String(cache.defaultTtl)
    });
  }
  await prisma.cacheDecision.create({
    data:{
      cacheKey, action:decision.action, score:evaluated.finalScore,
      reason:[...evaluated.reasons, ...decision.reason, ...(evicted ? [`evicted ${evicted}`] : [])],
      retrievalCost:costInfo.retrievalCost, latencyMs:costInfo.latencyMs, objectSizeBytes
    }
  });
  return { ...decision, score:evaluated.finalScore, evicted, objectSizeBytes };
}
async function flush() {
  const keys = await redis.keys("cache:*");
  if (keys.length) await redis.del(keys);
}
module.exports = { dataKey, metaKey, getCached, put, remove, flush, listKeys, lowestScore };
