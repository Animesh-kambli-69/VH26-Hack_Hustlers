"use strict";

/**
 * HTTP request layer for the traffic generator.
 * Uses the global fetch (Node >= 18) — no extra dependencies.
 */

const MAX_BODY_SNIFF = 200000; // bytes of body to parse for cache.hit

function classifyStatus(status) {
  if (status === 429) return "rateLimited";
  if (status >= 200 && status < 300) return "ok";
  if (status === 404) return "notFound";
  if (status >= 400) return "httpError";
  return "other";
}

/**
 * Send one request.
 * Returns a normalized result object — never throws for HTTP/network issues.
 */
async function sendRequest(baseUrl, spec, { timeoutMs = 10000, token = null } = {}) {
  const url = baseUrl + spec.url;
  const headers = { Accept: "application/json" };
  if (spec.auth && token) headers.Authorization = `Bearer ${token}`;
  if (spec.body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = process.hrtime.bigint();

  let response;
  try {
    response = await fetch(url, {
      method: spec.method || "GET",
      headers,
      signal: controller.signal,
      body: spec.body !== undefined ? JSON.stringify(spec.body) : undefined,
    });
  } catch (err) {
    clearTimeout(timer);
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const aborted = err.name === "AbortError";
    return {
      url, label: spec.label || spec.url, status: 0,
      latencyMs: elapsedMs,
      cacheHit: null,
      kind: aborted ? "timeout" : "network",
      error: aborted ? `timeout after ${timeoutMs}ms` : err.message,
      body: null,
    };
  }

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  clearTimeout(timer);

  let body = null;
  try {
    const text = await response.text();
    if (text && text.length <= MAX_BODY_SNIFF) body = JSON.parse(text);
  } catch {
    body = null; // non-JSON or too large — ignore
  }

  // The backend stamps every cache-served response with cache.hit — this is
  // the authoritative signal (not latency) that a request came from Redis.
  let cacheHit = null;
  if (body && typeof body === "object" && body.cache && typeof body.cache.hit === "boolean") {
    cacheHit = body.cache.hit;
  }

  return {
    url, label: spec.label || spec.url, status: response.status,
    latencyMs: elapsedMs,
    cacheHit,
    kind: classifyStatus(response.status),
    error: response.status >= 400 ? `HTTP ${response.status}` : null,
    body,
  };
}

/** Quick connectivity check used at startup. */
async function pingHealth(baseUrl, timeoutMs = 3000) {
  const res = await sendRequest(baseUrl, { url: "/health", label: "health" }, { timeoutMs });
  return res.status === 200;
}

module.exports = { sendRequest, pingHealth, classifyStatus };