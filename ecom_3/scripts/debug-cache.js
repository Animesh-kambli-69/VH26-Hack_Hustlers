/**
 * Debug script: traces exactly which step throws on /api/products
 * Run with: node scripts/debug-cache.js
 */
require('dotenv').config();
const redis = require('../src/config/redis');
const prisma = require('../src/config/prisma');
const { list } = require('../src/services/products/productService');
const { getCached, put } = require('../src/services/cache/cacheService');
const { touchMetric } = require('../src/services/cache/metadataService');

async function run() {
  console.log('[DEBUG] Connecting Redis...');
  await redis.connect();
  console.log('[DEBUG] Redis connected');

  const key = 'products:list:page=1:limit=20';

  // Step 1: getCached
  console.log('[DEBUG] Step 1: getCached...');
  try {
    const hit = await getCached(key);
    console.log('[DEBUG] getCached result:', hit === null ? 'MISS (null)' : 'HIT');
  } catch (e) {
    console.error('[DEBUG] getCached THREW:', e.message, e.stack);
    process.exit(1);
  }

  // Step 2: list products
  console.log('[DEBUG] Step 2: list products from DB...');
  let result;
  try {
    const start = Date.now();
    result = await list({ page: 1, limit: 5 }); // limit 5 to be faster
    const latencyMs = Date.now() - start;
    console.log('[DEBUG] list() OK, items:', result.items.length, 'latencyMs:', latencyMs);

    // Step 3: touchMetric
    console.log('[DEBUG] Step 3: touchMetric...');
    const size = Buffer.byteLength(JSON.stringify(result));
    console.log('[DEBUG] JSON.stringify size:', size);
    try {
      const metric = await touchMetric(key, 'miss', latencyMs, 0.1, size);
      console.log('[DEBUG] touchMetric OK, accessCount:', metric.accessCount);
    } catch (e) {
      console.error('[DEBUG] touchMetric THREW:', e.message, e.stack);
      process.exit(1);
    }

    // Step 4: put
    console.log('[DEBUG] Step 4: put...');
    try {
      const decision = await put(key, result, { latencyMs, retrievalCost: 0.1 });
      console.log('[DEBUG] put() OK, decision:', JSON.stringify(decision));
    } catch (e) {
      console.error('[DEBUG] put() THREW:', e.message, e.stack);
      process.exit(1);
    }
  } catch (e) {
    console.error('[DEBUG] list() THREW:', e.message, e.stack);
    process.exit(1);
  }

  // Step 5: Verify Redis has the data key
  console.log('[DEBUG] Step 5: Verifying Redis key...');
  try {
    const dataKey = `cache:data:${key}`;
    const val = await redis.get(dataKey);
    if (val) {
      console.log('[DEBUG] ✓ Redis key found:', dataKey);
      console.log('[DEBUG] ✓ TTL:', await redis.ttl(dataKey));
      console.log('[DEBUG] ✓ Value preview:', val.substring(0, 100) + '...');
    } else {
      console.log('[DEBUG] ✗ Redis key NOT found - decision was BYPASS');
    }
  } catch (e) {
    console.error('[DEBUG] Redis check THREW:', e.message);
  }

  // Step 6: Second getCached - should HIT
  console.log('[DEBUG] Step 6: Second getCached (should HIT)...');
  try {
    const hit = await getCached(key);
    if (hit) {
      console.log('[DEBUG] ✓ CACHE HIT! Keys:', Object.keys(hit).join(', '));
    } else {
      console.log('[DEBUG] ✗ CACHE MISS on second call - item was BYPASSED by CAAC');
    }
  } catch (e) {
    console.error('[DEBUG] Second getCached THREW:', e.message);
  }

  await redis.quit();
  await prisma.$disconnect();
  console.log('[DEBUG] Done.');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
