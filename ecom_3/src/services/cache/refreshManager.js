const redis = require("../../config/redis");
const { dataKey } = require("./cacheService");
async function shouldRefresh(cacheKey, thresholdSeconds=10) {
  const ttl = await redis.ttl(dataKey(cacheKey));
  return ttl >= 0 && ttl <= thresholdSeconds;
}
module.exports = { shouldRefresh };
