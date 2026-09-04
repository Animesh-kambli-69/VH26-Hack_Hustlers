// Micro-benchmark: 90% expensive DETAIL traffic + 10% cheap CATALOG traffic
// against a capacity that fits the DETAIL alone (0.6MB). The adaptive engine
// should hold the expensive entry and let cheap reads pass through, while
// GDSF (no admission filter) churns its probation-equivalent cheap entries.
// Run: node scripts/microbench.mjs
import { createAdaptiveCache } from '../src/services/cache/adaptiveCache.js';
import { createGdsfCache } from '../src/services/cache/gdsfCache.js';
import { metaFor } from '../src/services/cache/costModel.js';

const cfg = { capacityMB: 0.6, wL: 1, wM: 1, lambda: 0.01, admission: true };
const catalogMeta = metaFor('CATALOG');
const detailMeta = metaFor('DETAIL');
const io = { now: () => Date.now(), ageFactor: 1, onEvent: () => {} };

function drive(createPolicy) {
  const policy = createPolicy(io);
  policy.configure(cfg);
  let hits = 0;
  let misses = 0;
  for (let i = 0; i < 500; i++) {
    const key = i % 10 === 0 ? 'catalog' : 'detail';
    const meta = key === 'catalog' ? catalogMeta : detailMeta;
    if (policy.get(key)) hits += 1;
    else {
      misses += 1;
      policy.set(key, { v: key }, meta);
    }
  }
  const info = policy.info();
  return `hits=${hits} misses=${misses} hitRate=${((hits / 500) * 100).toFixed(1)}% evictions=${info.evictions}`;
}

console.log('adaptive'.padEnd(9), drive(createAdaptiveCache));
console.log('gdsf'.padEnd(9), drive(createGdsfCache));
