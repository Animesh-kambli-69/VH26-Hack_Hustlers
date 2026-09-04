// ---------------------------------------------------------------------------
// Adaptive cache — the application-aware policy (PRD §3.1).
//
// Every entry is scored with
//
//   U = ((Ĉ_lat · wL + Ĉ_$ · wM) · log(1 + F)) / S · e^(−λ·Δt)
//
// and eviction always removes the lowest-utility entry. Expensive-to-rebuild
// entries (SEARCH / DETAIL) score high and survive; cheap CATALOG rows score
// low and leave first when memory pressure hits.
//
// Implementation notes:
//   - A binary min-heap keeps utility ordering at O(log N); entries carry a
//     stamp so superseded heap nodes are skipped lazily instead of rescanned.
//   - F decays per hit (F = 0.99·F + 1) and idle time ages utility via
//     e^(−λΔt), so a once-hot key cannot pollute the cache forever — a
//     Diwali-season best-seller ages into a low-value victim once Christmas
//     demand arrives.
//   - Admission is probation-style + value-gated (S3-FIFO / PRD §3.4):
//     every newcomer lands in a probation layer (freq < 2) and may cycle
//     through it freely — one-hit wonders and new demand alike get a trial
//     without ever displacing a proven entry. A proven entry (freq ≥ 2) is
//     only evicted for a newcomer that out-values the cheapest proven entry;
//     a one-off cheap catalog read can never dislodge an expensive,
//     popular detail/search result.
// ---------------------------------------------------------------------------

import { computeUtility } from './utility.js';

const MIN_UTILITY = 1e-9;

// --- binary min-heap over {key, stamp, u} -------------------------------------------------

function heapPush(heap, node) {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (heap[parent].u <= node.u) break;
    heap[i] = heap[parent];
    i = parent;
  }
  heap[i] = node;
}

function heapPop(heap) {
  const top = heap[0];
  const last = heap.pop();
  if (heap.length > 0 && last) {
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;
      if (left < heap.length && heap[left].u < heap[smallest].u) smallest = left;
      if (right < heap.length && heap[right].u < heap[smallest].u) smallest = right;
      if (smallest === i) break;
      heap[i] = heap[smallest];
      i = smallest;
    }
    heap[i] = last;
  }
  return top;
}

export function createAdaptiveCache(io) {
  const name = 'adaptive';
  let cfg = { capacityMB: 15, wL: 1, wM: 1, lambda: 0.01, admission: true };
  const map = new Map(); // key -> entry (source of truth)
  const heap = []; // min-heap nodes; stale ones are skipped by stamp
  let stamp = 0;
  const stats = { hits: 0, misses: 0, evictions: 0, expirations: 0, invalidations: 0, rejections: 0, sets: 0 };

  function at() {
    return io.now();
  }

  function ageFactor() {
    return io.ageFactor || 1;
  }

  function isExpired(entry, now) {
    return ((now - entry.createdAt) / 1000) * ageFactor() > entry.ttlSeconds;
  }

  function utilityOf(entry, now) {
    return computeUtility(entry, cfg, now, ageFactor());
  }

  function sizeMB() {
    let s = 0;
    for (const e of map.values()) s += e.sizeMB;
    return s;
  }

  function emit(reason, entry, detail) {
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
      detail,
    });
  }

  function pushHeap(entry, now) {
    entry.stamp = ++stamp;
    entry.utility = utilityOf(entry, now);
    heapPush(heap, { key: entry.key, stamp: entry.stamp, u: entry.utility });
  }

  // Returns the live entry with the lowest *current* utility without removing
  // it: walks the heap in utility order, lazily skipping stale nodes and
  // dropping expired entries it meets; the node it stops on is restored
  // before returning (O(log N) when the heap top is current).
  // `probationOnly` restricts the search to newcomers (freq < 2).
  function findVictim(now, probationOnly = false) {
    const skipped = [];
    while (heap.length > 0) {
      const node = heapPop(heap);
      const entry = map.get(node.key);
      if (!entry || entry.stamp !== node.stamp) continue; // stale node — drop
      const uNow = utilityOf(entry, now);
      if (Math.abs(uNow - node.u) > 1e-12) {
        // Order drifted (weights/λ/freq/age changed) — refresh and restore.
        entry.stamp = ++stamp;
        entry.utility = uNow;
        skipped.push({ key: entry.key, stamp: entry.stamp, u: uNow });
        continue;
      }
      if (isExpired(entry, now)) {
        map.delete(entry.key);
        stats.expirations += 1;
        emit('expire', entry);
        continue;
      }
      if (probationOnly && entry.freq >= 2) {
        skipped.push(node); // proven — keep scanning for a newcomer
        continue;
      }
      // The first valid entry in ascending order is the one to evict.
      for (const n of skipped) heapPush(heap, n);
      heapPush(heap, node);
      return entry;
    }
    for (const n of skipped) heapPush(heap, n);
    return null;
  }

  // Removes and returns the current victim (used to shrink after configure /
  // capacity drains).
  function evictOne(now) {
    const victim = findVictim(now, false);
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
      // Re-score every live entry under the new weights/λ so the heap order
      // matches the active configuration (weights change live via the API).
      heap.length = 0;
      for (const entry of map.values()) pushHeap(entry, at());
      const now = at();
      while (sizeMB() > cfg.capacityMB) {
        if (!evictOne(now)) break;
      }
    },

    get(key) {
      const now = at();
      const entry = map.get(key);
      if (!entry) {
        stats.misses += 1;
        return undefined;
      }
      if (isExpired(entry, now)) {
        map.delete(key);
        stats.expirations += 1;
        stats.misses += 1;
        emit('expire', entry);
        return undefined;
      }
      stats.hits += 1;
      entry.freq = entry.freq * 0.99 + 1; // decayed frequency — prevents pollution
      entry.lastAccess = now;
      pushHeap(entry, now);
      return entry;
    },

    set(key, value, meta) {
      const now = at();
      const existing = map.get(key);

      if (existing) {
        // Refresh in place (rare: callers set only after a miss).
        Object.assign(existing, meta, { value, lastAccess: now });
        existing.freq = existing.freq * 0.99 + 1;
        pushHeap(existing, now);
        stats.sets += 1;
        return true;
      }

      const entry = {
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
        utility: MIN_UTILITY,
        stamp: 0,
      };

      // Admission. (get() already counted this lookup as a miss.)
      const needRoom = sizeMB() + meta.sizeMB > cfg.capacityMB;
      if (needRoom) {
        const candidateU = utilityOf(entry, now);
        // 1) Prefer a probation victim — newcomers may cycle through the
        //    trial layer freely without touching proven entries.
        let victim = findVictim(now, true);
        // 2) Probation empty: the newcomer must out-value the cheapest
        //    proven entry or it is rejected (value gate), so a cheap read
        //    never dislodges an expensive, popular entry.
        if (!victim && cfg.admission) {
          const mainVictim = findVictim(now, false);
          if (mainVictim && candidateU < mainVictim.utility) {
            stats.rejections += 1;
            entry.utility = candidateU;
            emit('reject', entry, {
              reason: 'cheaper than lowest-utility proven entry',
              victimKey: mainVictim.key,
              victimUtility: mainVictim.utility,
              candidateUtility: candidateU,
            });
            return false;
          }
          victim = mainVictim;
        } else if (!victim) {
          // Admission disabled: make room unconditionally.
          victim = findVictim(now, false);
        }
        if (victim) {
          map.delete(victim.key);
          stats.evictions += 1;
          emit('evict', victim);
        }
      }

      map.set(key, entry);
      pushHeap(entry, now);
      stats.sets += 1;

      // Drain residual overflow (e.g. the entry itself exceeds capacity).
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
      heap.length = 0;
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
        rejections: stats.rejections,
        sets: stats.sets,
      };
    },
  };
}
