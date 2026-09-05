import { Menu, Pause, Play, RefreshCw } from "lucide-react";
import { formatClock } from "../utils/formatters";

function ConnectionPill({ status, telemetry }) {
  const cfg = {
    loading: { dot: "bg-amber-400 animate-pulse", text: "Connecting…", cls: "text-amber-300" },
    connected: { dot: "bg-emerald-400", text: "Backend Connected", cls: "text-emerald-300" },
    degraded: { dot: "bg-amber-400", text: "Backend Degraded", cls: "text-amber-300" },
    error: { dot: "bg-red-400", text: "API Error", cls: "text-red-300" },
    offline: { dot: "bg-red-400", text: "Backend Offline", cls: "text-red-300" },
  }[status] || { dot: "bg-slate-400", text: "Unknown", cls: "text-slate-300" };

  return (
    <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
      <span className={`status-dot ${cfg.dot}`} />
      <span className={`text-xs font-semibold ${cfg.cls}`}>{cfg.text}</span>
    </div>
  );
}

export default function Header({
  status,
  telemetry,
  lastUpdated,
  autoRefresh,
  intervalMs,
  onToggleAutoRefresh,
  onRefresh,
  onOpenSidebar,
}) {
  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-white/[0.06] bg-[#05080f]/60 px-4 py-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onOpenSidebar}
        className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-slate-300 hover:bg-white/[0.08] lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="text-lg font-bold tracking-tight text-slate-100 sm:text-xl">
          CAAC Monitoring
        </h1>
        <p className="text-xs text-slate-500">Cost-Aware Adaptive Cache Intelligence</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <ConnectionPill status={status} telemetry={telemetry} />

        <div className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-slate-400 md:flex">
          <span className="font-medium">Last updated:</span>
          <span className="font-mono tabular-nums text-slate-200">
            {lastUpdated ? formatClock(lastUpdated) : "—"}
          </span>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
            autoRefresh
              ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
              : "border-slate-400/20 bg-slate-400/10 text-slate-400"
          }`}
          title={autoRefresh ? "Auto-refresh enabled" : "Auto-refresh paused"}
        >
          <span className={`status-dot ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
          Auto-refresh: {autoRefresh ? `${intervalMs / 1000}s` : "OFF"}
        </div>

        <button
          onClick={onToggleAutoRefresh}
          title={autoRefresh ? "Pause auto-refresh" : "Resume auto-refresh"}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-2 text-slate-300 transition-colors hover:bg-white/[0.08]"
        >
          {autoRefresh ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <button
          onClick={onRefresh}
          title="Refresh now"
          className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-2 text-cyan-300 transition-colors hover:bg-cyan-400/20"
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </header>
  );
}