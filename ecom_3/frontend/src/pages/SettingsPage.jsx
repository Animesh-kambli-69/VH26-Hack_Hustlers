import { Info, Radio, ShieldCheck, Wifi } from "lucide-react";
import Card from "../components/Card";
import { API_BASE_URL } from "../services/analyticsApi";

const INTERVAL_OPTIONS = [
  { value: 2000, label: "2s" },
  { value: 5000, label: "5s" },
  { value: 10000, label: "10s" },
  { value: 30000, label: "30s" },
];

const ENDPOINTS = [
  { path: "GET /api/analytics/stats", desc: "Cumulative cache telemetry: hit/miss totals, decision counts, Redis memory, cached objects, recent decisions" },
  { path: "GET /api/analytics/weights", desc: "CAAC signal weights, admission threshold, recency lambda, size penalty, capacity and TTL settings" },
];

export default function SettingsPage({
  analytics,
  intervalMs,
  onIntervalChange,
}) {
  const { status, telemetry, lastUpdated } = analytics;
  const source = API_BASE_URL.startsWith("http") ? "direct" : "same-origin (Vite proxy)";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Auto-Refresh" subtitle="Polling cadence for both telemetry endpoints" icon={Radio}>
          <div className="flex flex-wrap items-center gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onIntervalChange(opt.value)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  intervalMs === opt.value
                    ? "border-cyan-400/40 bg-cyan-400/15 text-cyan-200"
                    : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={() => onIntervalChange(null)}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                intervalMs === null
                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                  : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-slate-200"
              }`}
            >
              Paused
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Current status:{" "}
            <span className="font-medium text-slate-300">
              {intervalMs === null ? "paused — manual refresh only" : `every ${intervalMs / 1000}s`}
            </span>
          </p>
        </Card>

        <Card title="Backend Connection" subtitle="How the dashboard reaches the ShopVerse API" icon={Wifi}>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
              <span className="text-slate-500">API base URL</span>
              <span className="font-mono text-xs text-cyan-300">{API_BASE_URL}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
              <span className="text-slate-500">Access mode</span>
              <span className="font-medium text-slate-200">{source}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/[0.05] pb-2.5">
              <span className="text-slate-500">Connection status</span>
              <span className="flex items-center gap-1.5 font-medium text-slate-200">
                <span className={`status-dot ${analytics.isOffline ? "bg-red-400" : status === "loading" ? "bg-amber-400" : "bg-emerald-400"}`} />
                {analytics.isOffline ? "Offline" : status === "loading" ? "Connecting…" : status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Last successful fetch</span>
              <span className="font-mono tabular-nums text-slate-200">
                {lastUpdated ? lastUpdated.toLocaleTimeString("en-US", { hour12: true }) : "—"}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Telemetry Endpoints" subtitle="Real endpoints consumed by this dashboard" icon={ShieldCheck}>
        <div className="divide-y divide-white/[0.05]">
          {ENDPOINTS.map((e) => (
            <div key={e.path} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="shrink-0 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 font-mono text-xs font-semibold text-cyan-300">
                {e.path}
              </span>
              <span className="text-xs text-slate-500">{e.desc}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Data Accuracy" subtitle="What is real, what is calculated, and what is not available" icon={Info}>
        <ul className="space-y-2.5 text-sm leading-relaxed text-slate-400">
          <li>
            <span className="font-semibold text-emerald-300">Real backend data</span> — hit/miss
            counts, decision log events, scores, latencies, Redis memory usage, weights and
            threshold are all fetched live from the ShopVerse API.
          </li>
          <li>
            <span className="font-semibold text-cyan-300">Frontend-calculated</span> — hit rate
            (hits ÷ total), admission rate (ADMIT ÷ (ADMIT + REJECT)), requests/second and trend
            deltas are derived from real fetched values; chart history is kept in browser memory
            for the current session only.
          </li>
          <li>
            <span className="font-semibold text-amber-300">Unavailable telemetry</span> — the
            backend does not expose a DB-vs-Redis latency split, so that chart is disabled
            rather than fabricated. Redis memory limit is only shown when Redis reports a
            configured maxmemory.
          </li>
          <li>
            <span className="font-semibold text-slate-300">No fake data</span> — if an endpoint
            is down or missing, the dashboard shows explicit offline/unavailable states instead
            of placeholder metrics.
          </li>
        </ul>
      </Card>
    </div>
  );
}