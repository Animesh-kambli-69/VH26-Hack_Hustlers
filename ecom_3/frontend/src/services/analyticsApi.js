/**
 * Centralized API service for the ShopVerse CAAC telemetry endpoints.
 *
 * Base URL resolution order:
 *   1. VITE_API_BASE_URL env var (see .env.example)
 *   2. "/api" — same-origin, proxied by the Vite dev/preview server to
 *      http://localhost:3000 (no CORS issues with the backend's default config)
 */
const DEFAULT_API_BASE = "/api";

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = null, kind = "http", path = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind; // "network" | "not-found" | "http"
    this.path = path;
  }
}

async function request(path, { signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    // fetch only rejects on network-level failures (offline backend, CORS
    // blocked, DNS failure, ...)
    throw new ApiError("Network error — unable to reach the ShopVerse API", {
      kind: "network",
      path,
    });
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(`Endpoint unavailable: ${path}`, { status: 404, kind: "not-found", path });
    }
    throw new ApiError(`API error (HTTP ${res.status})`, { status: res.status, path });
  }

  return res.json();
}

/** GET /api/analytics/stats — cumulative cache telemetry */
export function fetchAnalyticsStats(opts) {
  return request("/analytics/stats", opts);
}

/** GET /api/analytics/weights — CAAC weights, admission threshold, tuning params */
export function fetchAnalyticsWeights(opts) {
  return request("/analytics/weights", opts);
}