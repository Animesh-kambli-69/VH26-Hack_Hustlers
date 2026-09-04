// ---------------------------------------------------------------------------
// Utility scoring engine (PRD §3.1).
//
//   U = ((Ĉ_lat · wL + Ĉ_$ · wM) · log(1 + F)) / S · e^(−λ·Δt)
//
// where:
//   Ĉ_lat, Ĉ_$  – normalized latency / money cost (heterogeneous costs are
//                 normalized onto fixed ShopVerse ranges before weighting)
//   F           – decayed access frequency (F = F·0.99 + 1 per hit, so a key
//                 that stops being requested stops growing and ages out)
//   S           – modeled response size in MB
//   λ           – recency-decay rate (per second of idle time)
// ---------------------------------------------------------------------------

// Fixed normalization ranges for the ShopVerse cost model.
export const LAT_MIN_MS = 5;
export const LAT_MAX_MS = 800; // checkout is the slowest recompute
export const COST_MIN_USD = 0.00002; // category list
export const COST_MAX_USD = 0.008; // checkout

export function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

export function normLatency(ms) {
  return clamp01((ms - LAT_MIN_MS) / (LAT_MAX_MS - LAT_MIN_MS));
}

export function normCost(usd) {
  return clamp01((usd - COST_MIN_USD) / (COST_MAX_USD - COST_MIN_USD));
}

// Recomputes an entry's utility from its current state, config and clock.
// `ageFactor` lets the workload simulator age entries faster than real time
// so decay/TTL behaviour is observable in short runs.
export function computeUtility(entry, cfg, now, ageFactor = 1) {
  const dT = Math.max(0, (now - entry.lastAccess) / 1000) * ageFactor;
  const costTerm =
    normLatency(entry.costLatency) * cfg.wL + normCost(entry.costMoney) * cfg.wM;
  const freqTerm = Math.log1p(entry.freq);
  const decay = Math.exp(-cfg.lambda * dT);
  // Floor at a tiny epsilon so entries never fully collapse to 0 while stored.
  return Math.max(1e-9, ((costTerm * freqTerm) / entry.sizeMB) * decay);
}
