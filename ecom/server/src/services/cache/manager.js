// ---------------------------------------------------------------------------
// Cache manager — the single entry point services talk to.
//
// Every read/write is fanned out to ALL policies (adaptive + the GDSF shadow
// + the no-cache counter) so the dashboard can compare hit rates on
// identical traffic. The policy named by `config.mode` is the *active* one:
// its entry is what services receive on a hit, and only its hits count
// toward latency/₹ savings. The others run as shadow baselines.
//
// Switched to mode 'no-cache' the manager stops storing entirely (exact
// Phase 1 behaviour) but still counts every miss + its recompute cost in the
// rolling window, which feeds the auto-scaler advisor.
// ---------------------------------------------------------------------------

import { createAdaptiveCache } from './adaptiveCache.js';
import { createGdsfCache } from './gdsfCache.js';
import { createNoopCache } from './noopCache.js';
import { DEFAULT_CONFIG, MODES, applyConfig, envConfig } from './config.js';
import { advise } from './costAdvisor.js';

export const HIT_OVERHEAD_MS = 2; // modeled cost of serving from cache
const EVENT_LIMIT = 500;
const WINDOW_BUCKETS = 60; // one bucket per second

// Rolling one-second window used for hit/miss rates and the advisor.
class RollingWindow {
  constructor(size) {
    this.size = size;
    this.buckets = [];
    this.seq = 0;
  }

  bucket(nowMs) {
    const sec = Math.floor(nowMs / 1000);
    let b = this.buckets[this.buckets.length - 1];
    if (!b || b.sec !== sec) {
      b = { sec, hits: 0, misses: 0, savedLatencyMs: 0, savedUsd: 0, missCostUsd: 0 };
      this.buckets.push(b);
      if (this.buckets.length > this.size) this.buckets.shift();
    }
    return b;
  }

  sum(nowMs) {
    const cutoff = nowMs - this.size * 1000;
    let total = null;
    for (const b of this.buckets) {
      if (b.sec * 1000 < cutoff) continue;
      if (!total) total = { hits: 0, misses: 0, savedLatencyMs: 0, savedUsd: 0, missCostUsd: 0, startSec: b.sec };
      total.hits += b.hits;
      total.misses += b.misses;
      total.savedLatencyMs += b.savedLatencyMs;
      total.savedUsd += b.savedUsd;
      total.missCostUsd += b.missCostUsd;
    }
    return total;
  }
}

function buildPolicySet(io) {
  return {
    adaptive: createAdaptiveCache(io),
    gdsf: createGdsfCache(io),
    'no-cache': createNoopCache(io),
  };
}

class CacheManager {
  constructor() {
    this.config = envConfig();
    this.policies = null;
    this.events = []; // ring of lifecycle events (evict/expire/reject/invalidate)
    this.listeners = new Set(); // SSE subscribers
    this.timer = null;
    this.lastSimulation = null;
    this.window = new RollingWindow(WINDOW_BUCKETS);
    this.savedLatencyMs = 0;
    this.savedUsd = 0;
    this.missCostUsd = 0;
    this.requests = 0;

    const io = {
      onEvent: (e) => this.recordEvent(e),
      now: () => Date.now(),
      ageFactor: 1,
    };
    this.policies = buildPolicySet(io);
    this._applyConfig(this.config);
  }

  // --- lifecycle events ------------------------------------------------------

  recordEvent(event) {
    const evt = {
      seq: this.events.length + 1,
      at: new Date().toISOString(),
      ...event,
    };
    this.events.push(evt);
    if (this.events.length > EVENT_LIMIT) this.events.shift();
    this.publish({ type: 'event', event: evt });
  }

  publish(payload) {
    for (const fn of this.listeners) {
      try {
        fn(payload);
      } catch {
        // A slow subscriber must not break cache operation.
      }
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    if (this.listeners.size === 1) {
      this.timer = setInterval(() => this.publish({ type: 'tick', ...this.snapshot() }), 1000);
      if (this.timer.unref) this.timer.unref();
    }
  }

  unsubscribe(fn) {
    this.listeners.delete(fn);
    if (this.listeners.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  // --- configuration ----------------------------------------------------------

  _applyConfig(next) {
    this.config = next;
    for (const policy of Object.values(this.policies)) {
      policy.configure({
        capacityMB: next.capacityMB,
        wL: next.wL,
        wM: next.wM,
        lambda: next.lambda,
        admission: next.admission,
      });
    }
    this.recordEvent({ policy: 'manager', reason: 'config', detail: { ...next } });
  }

  updateConfig(patch) {
    const next = applyConfig(this.config, patch);
    this._applyConfig(next);
    return this.config;
  }

  reset() {
    for (const policy of Object.values(this.policies)) policy.clear();
    this.events.length = 0;
    this.savedLatencyMs = 0;
    this.savedUsd = 0;
    this.missCostUsd = 0;
    this.requests = 0;
    this.window = new RollingWindow(WINDOW_BUCKETS);
    this.recordEvent({ policy: 'manager', reason: 'reset' });
  }

  // --- read / write path --------------------------------------------------------

  // Returns the cached value from the *active* policy, or undefined on a miss.
  get(key) {
    if (this.config.mode === 'no-cache') return undefined;

    const activeName = this.config.mode;
    let activeEntry = undefined;
    for (const policy of Object.values(this.policies)) {
      const entry = policy.get(key);
      if (policy.name === activeName && entry) activeEntry = entry;
    }
    if (!activeEntry) return undefined;

    const b = this.window.bucket(Date.now());
    b.hits += 1;
    const savedMs = Math.max(0, activeEntry.costLatency - HIT_OVERHEAD_MS);
    b.savedLatencyMs += savedMs;
    b.savedUsd += activeEntry.costMoney;
    this.savedLatencyMs += savedMs;
    this.savedUsd += activeEntry.costMoney;
    this.requests += 1;
    return activeEntry.value;
  }

  // Records the miss and stores the freshly computed value in every policy.
  set(key, value, meta) {
    const b = this.window.bucket(Date.now());
    this.requests += 1;

    if (this.config.mode === 'no-cache') {
      // Exact Phase 1 behaviour: no storage, but keep counting what caching
      // *would* have avoided so the advisor can price it.
      b.misses += 1;
      b.missCostUsd += meta.costMoney ?? 0;
      this.missCostUsd += meta.costMoney ?? 0;
      return false;
    }

    b.misses += 1;
    b.missCostUsd += meta.costMoney ?? 0;
    this.missCostUsd += meta.costMoney ?? 0;

    let stored = false;
    for (const policy of Object.values(this.policies)) {
      if (policy.name === 'no-cache') continue;
      if (policy.set(key, value, meta)) stored = true;
    }
    return stored;
  }

  invalidateKey(key) {
    for (const policy of Object.values(this.policies)) policy.del(key);
  }

  invalidatePattern(prefix) {
    for (const policy of Object.values(this.policies)) policy.delMatching(prefix);
  }

  // --- reporting ---------------------------------------------------------------

  snapshot() {
    const nowMs = Date.now();
    const window = this.window.sum(nowMs) || { hits: 0, misses: 0, savedLatencyMs: 0, savedUsd: 0, missCostUsd: 0, startSec: nowMs / 1000 };
    const spanSeconds = this.window.buckets.length ? nowMs / 1000 - this.window.buckets[0].sec : 0;
    const windowSeconds = spanSeconds > 0 ? spanSeconds : 0.5;
    const advisor = advise({
      windowMissCostUsd: window.missCostUsd,
      windowSeconds,
    });
    return {
      t: new Date().toISOString(),
      config: { ...this.config },
      activeMode: this.config.mode,
      policies: Object.values(this.policies).map((p) => p.info()),
      window: {
        ...window,
        windowSeconds,
        hitRate: window.hits + window.misses ? window.hits / (window.hits + window.misses) : 0,
        missesPerSec: windowSeconds ? window.misses / windowSeconds : 0,
        hitsPerSec: windowSeconds ? window.hits / windowSeconds : 0,
      },
      totals: {
        requests: this.requests,
        savedLatencyMs: this.savedLatencyMs,
        savedUsd: this.savedUsd,
        missCostUsd: this.missCostUsd,
      },
      advisor,
    };
  }
}

export const cacheManager = new CacheManager();
export { DEFAULT_CONFIG, MODES };
