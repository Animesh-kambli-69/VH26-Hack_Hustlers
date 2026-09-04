// ---------------------------------------------------------------------------
// 'no-cache' baseline — the Phase 1 behaviour. Stores nothing, so every read
// is a miss; used as the flat 0%-hit-rate line in policy comparisons and by
// the workload simulator as the "what it costs today" baseline.
// ---------------------------------------------------------------------------

export function createNoopCache() {
  const stats = { hits: 0, misses: 0 };

  return {
    name: 'no-cache',

    configure() {},

    get() {
      stats.misses += 1;
      return undefined;
    },

    set() {
      return false;
    },

    del() {},
    delMatching() {},
    clear() {},

    info() {
      const { hits, misses } = stats;
      const requests = hits + misses;
      return {
        name: 'no-cache',
        hits,
        misses,
        requests,
        hitRate: 0,
        entries: 0,
        sizeMB: 0,
        capacityMB: 0,
        utilization: 0,
        evictions: 0,
        expirations: 0,
        invalidations: 0,
        rejections: 0,
      };
    },
  };
}
