require("dotenv").config();

const num = (key, fallback) => Number(process.env[key] ?? fallback);

module.exports = {
  port: num("PORT", 3000),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET || "dev-access-secret",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  cache: {
    capacity: num("CACHE_CAPACITY", 10),
    defaultTtl: num("CACHE_DEFAULT_TTL", 60),
    admissionThreshold: num("CACHE_ADMISSION_THRESHOLD", 0.2)
  },
  weights: {
    frequency: num("CAAC_W_FREQUENCY", 0.25),
    recency: num("CAAC_W_RECENCY", 0.15),
    cost: num("CAAC_W_COST", 0.30),
    latency: num("CAAC_W_LATENCY", 0.15),
    trend: num("CAAC_W_TREND", 0.15)
  },
  recencyLambda: num("CAAC_RECENCY_LAMBDA", 0.001),
  sizePenaltyFactor: num("CAAC_SIZE_PENALTY_FACTOR", 0.000001),
  recommendationDelayMs: num("RECOMMENDATION_DELAY_MS", 2000),
  recommendationComputeCost: num("RECOMMENDATION_COMPUTE_COST", 5),
  recommendationDbCost: num("RECOMMENDATION_DB_COST", 3),
  recommendationExternalCost: num("RECOMMENDATION_EXTERNAL_COST", 1),
  analyticsDelayMs: num("ANALYTICS_DELAY_MS", 1000)
};
