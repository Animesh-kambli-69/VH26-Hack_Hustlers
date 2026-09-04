-- Generated baseline migration. Prisma will manage subsequent migrations.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

CREATE TABLE "User" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

CREATE TABLE "Category" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

CREATE TABLE "Product" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "categoryId" TEXT NOT NULL,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_name_idx" ON "Product"("name");

CREATE TABLE "UserActivity" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "activityType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "UserActivity_userId_createdAt_idx" ON "UserActivity"("userId","createdAt");
CREATE INDEX "UserActivity_productId_createdAt_idx" ON "UserActivity"("productId","createdAt");

CREATE TABLE "CacheMetric" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cacheKey" TEXT NOT NULL,
  "hitCount" INTEGER NOT NULL DEFAULT 0,
  "missCount" INTEGER NOT NULL DEFAULT 0,
  "accessCount" INTEGER NOT NULL DEFAULT 0,
  "lastAccessAt" TIMESTAMP(3),
  "firstAccessAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "recentAccessCount" INTEGER NOT NULL DEFAULT 0,
  "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "retrievalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "objectSizeBytes" INTEGER NOT NULL DEFAULT 0,
  "trendScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currentScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "ttlSeconds" INTEGER NOT NULL DEFAULT 60,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CacheMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CacheMetric_cacheKey_key" ON "CacheMetric"("cacheKey");

CREATE TABLE "CacheDecision" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "cacheKey" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "reason" JSONB NOT NULL,
  "retrievalCost" DOUBLE PRECISION NOT NULL,
  "latencyMs" DOUBLE PRECISION NOT NULL,
  "objectSizeBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CacheDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CacheDecision_cacheKey_idx" ON "CacheDecision"("cacheKey");
CREATE INDEX "CacheDecision_createdAt_idx" ON "CacheDecision"("createdAt");

CREATE TABLE "BenchmarkRun" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "policy" TEXT NOT NULL,
  "scenario" TEXT NOT NULL,
  "totalRequests" INTEGER NOT NULL DEFAULT 0,
  "hits" INTEGER NOT NULL DEFAULT 0,
  "misses" INTEGER NOT NULL DEFAULT 0,
  "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "p95LatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "backendCalls" INTEGER NOT NULL DEFAULT 0,
  "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "costSaved" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "memoryUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserActivity" ADD CONSTRAINT "UserActivity_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
