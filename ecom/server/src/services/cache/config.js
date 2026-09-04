// ---------------------------------------------------------------------------
// Runtime-tunable cache configuration.
//
// Defaults come from environment variables and can be changed live via
// POST /api/cache/config — no restart required (the dashboard weight
// sliders call this endpoint).
// ---------------------------------------------------------------------------

export const MODES = ['adaptive', 'gdsf', 'no-cache'];

export const DEFAULT_CONFIG = {
  mode: 'adaptive', // active policy serving real traffic
  capacityMB: 15, // modelled footprint cap (entries carry sizeMB metadata)
  wL: 1, // weight for normalized latency in the utility score
  wM: 1, // weight for normalized money cost
  lambda: 0.01, // recency-decay rate per second of idle time
  admission: true, // adaptive admission filter (blocks one-hit-wonder floods)
};

export const CONFIG_LIMITS = {
  capacityMB: [1, 150],
  wL: [0, 10],
  wM: [0, 10],
  lambda: [0, 0.1],
};

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function envConfig() {
  const mode = (process.env.CACHE_MODE || DEFAULT_CONFIG.mode).toLowerCase();
  return {
    mode: MODES.includes(mode) ? mode : DEFAULT_CONFIG.mode,
    capacityMB: num(process.env.CACHE_CAPACITY_MB, DEFAULT_CONFIG.capacityMB),
    wL: num(process.env.CACHE_W_LAT, DEFAULT_CONFIG.wL),
    wM: num(process.env.CACHE_W_MONEY, DEFAULT_CONFIG.wM),
    lambda: num(process.env.CACHE_LAMBDA, DEFAULT_CONFIG.lambda),
    admission: DEFAULT_CONFIG.admission,
  };
}

// Merges a partial update onto the current config, clamping numeric fields
// into CONFIG_LIMITS and validating enum fields. Throws with a descriptive
// message on invalid input so the controller can return a 400.
export function applyConfig(current, patch = {}) {
  const next = { ...current };

  if (patch.mode !== undefined) {
    const mode = String(patch.mode).toLowerCase();
    if (!MODES.includes(mode)) {
      throw new Error(`mode must be one of: ${MODES.join(', ')}`);
    }
    next.mode = mode;
  }

  for (const field of ['capacityMB', 'wL', 'wM', 'lambda']) {
    if (patch[field] === undefined) continue;
    const n = Number(patch[field]);
    if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
    const [min, max] = CONFIG_LIMITS[field];
    next[field] = Math.min(max, Math.max(min, n));
  }

  if (patch.admission !== undefined) next.admission = Boolean(patch.admission);

  return next;
}
