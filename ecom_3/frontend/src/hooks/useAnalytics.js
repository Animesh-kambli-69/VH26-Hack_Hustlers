import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAnalyticsStats, fetchAnalyticsWeights } from "../services/analyticsApi";

const MAX_HISTORY = 120;

const INITIAL_STATE = {
  stats: null,
  weights: null,
  history: [], // real fetched snapshots, kept for the current browser session
  status: "loading", // loading | connected | degraded | error | offline
  telemetry: { stats: "loading", weights: "loading" }, // ok | unavailable | error | loading
  lastUpdated: null,
  error: null,
};

function classify(result) {
  if (result.status === "fulfilled") return { ok: true, data: result.value };
  const err = result.reason;
  return {
    ok: false,
    data: null,
    kind: err?.kind || "http",
    message: err?.message || String(err),
  };
}

export function useAnalytics({ intervalMs = 5000, initialAutoRefresh = true } = {}) {
  const [state, setState] = useState(INITIAL_STATE);
  const [autoRefresh, setAutoRefresh] = useState(initialAutoRefresh);
  const mountedRef = useRef(true);
  const refreshSeq = useRef(0);
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current;
    const fetchedAt = new Date();

    const [statsResult, weightsResult] = await Promise.allSettled([
      fetchAnalyticsStats(),
      fetchAnalyticsWeights(),
    ]);

    // Ignore results that raced with a newer refresh or an unmount.
    if (!mountedRef.current || seq !== refreshSeq.current) return;

    const stats = classify(statsResult);
    const weights = classify(weightsResult);

    const telemetry = {
      stats: stats.ok ? "ok" : stats.kind === "not-found" ? "unavailable" : "error",
      weights: weights.ok ? "ok" : weights.kind === "not-found" ? "unavailable" : "error",
    };

    setState((prev) => {
      const next = { ...prev, telemetry };

      if (stats.ok) {
        next.stats = stats.data;
        next.lastUpdated = fetchedAt;
        next.error = null;

        const point = {
          time: fetchedAt,
          hitRate: +(stats.data.summary.hitRate * 100).toFixed(2),
          totalRequests: stats.data.summary.totalRequests,
          hits: stats.data.summary.hits,
          misses: stats.data.summary.misses,
          avgLatencyMs: stats.data.summary.avgLatencyMs,
          memoryUsedBytes: stats.data.redis.memoryUsedBytes,
        };
        next.history = [...prev.history, point].slice(-MAX_HISTORY);
      }

      if (weights.ok) next.weights = weights.data;

      if (stats.ok) {
        next.status = "connected";
      } else if (stats.kind === "network") {
        next.status = "offline";
        next.error = stats.message;
      } else if (prev.status === "connected" || prev.status === "degraded") {
        // We have stale data — keep showing it, flag the degradation.
        next.status = "degraded";
        next.error = `${stats.message} (${stats.data === null ? "using last known data" : ""})`;
      } else {
        next.status = "error";
        next.error = stats.message;
      }

      return next;
    });
  }, []);

  // Initial fetch.
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Polling loop — only while auto-refresh is enabled.
  useEffect(() => {
    if (!autoRefresh) return undefined;
    intervalRef.current = setInterval(refresh, intervalMs);
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, intervalMs, refresh]);

  return {
    ...state,
    autoRefresh,
    setAutoRefresh,
    refresh,
    isOffline: state.status === "offline",
    isLoading: state.status === "loading" && !state.stats,
    hasData: Boolean(state.stats),
  };
}