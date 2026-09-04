// ---------------------------------------------------------------------------
// GDSF baseline (Greedy-Dual Size Frequency): each entry carries the value
//
//   priority = (normalized cost + log(1 + freq)) / sizeMB
//
// and the lowest-priority entry is evicted. It is cost aware but — unlike
// the adaptive engine — it has no recency decay (λ = 0) and no admission
// filter, so a flood of cheap newcomers can churn it and an old costly key
// can starve new arrivals forever.
// ---------------------------------------------------------------------------

import { computeUtility } from './utility.js';

export function createGdsfCache(io) {
  const name = 'gdsf';
  let cfg = { capacityMB: 15, wL: 1, wM: 1, lambda: 0 };
  const map = new Map();
  const stats = { hits: 0, misses: 0, evictions: 0, expirations: 0, invalidations: 0 };

  function sizeMB() {
    let s = 0;
    for (const e of map.values()) s += e.sizeMB;
    return s;
  }

  function agedSecs(entry, now) {
    return (now - entry.createdAt) / 1000;
  }

  function emit(reason, entry) {
    if (!io?.onEvent) return;
    io.onEvent({
      policy: name,
      reason,
      key: entry.key,
      type: entry.type,
      sizeMB: entry.sizeMB,
      costLatency: entry.costLatency,
      costMoney: entry.costMoney,
      freq: entry.freq,
      utility: entry.utility,
    });
  }

  function makeEntry(key, value, meta, now) {
    return {
      key,
      value,
      type: meta.type,
      sizeMB: meta.sizeMB,
      costLatency: meta.costLatency,
      costMoney: meta.costMoney,
      ttlSeconds: meta.ttlSeconds,
      freq: 1,
      lastAccess: now,
      createdAt: now,
      utility: 0,
    };
  }

  function recomputePriority(entry, now) {
    // GDSF uses the utility formula with λ = 0 (no recency decay).
    entry.utility = computeUtility(entry, { ...cfg, lambda: 0 }, now);
  }

  function evictOne(now) {
    let victim = null;
    for (const entry of map.values()) {
      if (agedSecs(entry, now) > entry.ttlSeconds) {
        map.delete(entry.key);
        stats.expirations += 1;
        emit('expire', entry);
        continue;
      }
      recomputePriority(entry, now);
      if (!victim || entry.utility < victim.utility) victim = entry;
    }
    if (!victim) return null;
    map.delete(victim.key);
    stats.evictions += 1;
    emit('evict', victim);
    return victim;
  }

  return {
    name,

    configure(next) {
      cfg = { ...cfg, ...next };
      const now = io.now();
      while (sizeMB() > cfg.capacityMB) {
        if (!evictOne(now)) break;
      }
    },

    get(key) {
      const now = io.now();
      const entry = map.get(key);
      if (!entry) {
        stats.misses += 1;
        return undefined;
      }
      if (agedSecs(entry, now) > entry.ttlSeconds) {
        map.delete(key);
        stats.expirations += 1;
        stats.misses += 1;
        emit('expire', entry);
        return undefined;
      }
      stats.hits += 1;
      entry.freq += 1;
      entry.lastAccess = now;
      recomputePriority(entry, now);
      return entry;
    },

    set(key, value, meta) {
      const now = io.now();
      const existing = map.get(key);
      if (existing) {
        Object.assign(existing, meta, { value, freq: existing.freq + 1, lastAccess: now });
      } else {
        const entry = makeEntry(key, value, meta, now);
        recomputePriority(entry, now);
        map.set(key, entry);
      }
      while (sizeMB() > cfg.capacityMB) {
        if (!evictOne(now)) break;
      }
      return true;
    },

    del(key) {
      const entry = map.get(key);
      if (!entry) return false;
      map.delete(key);
      stats.invalidations += 1;
      emit('invalidate', entry);
      return true;
    },

    delMatching(prefix) {
      for (const key of map.keys()) {
        if (key.startsWith(prefix)) this.del(key);
      }
    },

    clear() {
      map.clear();
    },

    info() {
      const { hits, misses } = stats;
      const requests = hits + misses;
      const used = sizeMB();
      return {
        name,
        hits,
        misses,
        requests,
        hitRate: requests ? hits / requests : 0,
        entries: map.size,
        sizeMB: Math.round(used * 1000) / 1000,
        capacityMB: cfg.capacityMB,
        utilization: cfg.capacityMB ? used / cfg.capacityMB : 0,
        evictions: stats.evictions,
        expirations: stats.expirations,
        invalidations: stats.invalidations,
        rejections: 0,
      };
    },
  };
}
