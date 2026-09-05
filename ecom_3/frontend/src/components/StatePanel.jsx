import { AlertTriangle, RefreshCw, Unplug, WifiOff } from "lucide-react";

export function OfflinePanel({ onRetry }) {
  return (
    <div className="glass-card animate-fade-in mx-auto max-w-lg p-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
        <WifiOff size={24} />
      </span>
      <h2 className="mt-5 text-xl font-bold text-slate-100">Backend Offline</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        Unable to connect to ShopVerse API.
        <br />
        Please ensure the backend is running on port 3000.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/20"
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}

export function ErrorPanel({ message, onRetry }) {
  return (
    <div className="glass-card animate-fade-in mx-auto max-w-lg p-10 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
        <AlertTriangle size={24} />
      </span>
      <h2 className="mt-5 text-xl font-bold text-slate-100">Unable to load analytics data</h2>
      <p className="mt-2 text-sm text-slate-400">{message || "The backend returned an error."}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/20"
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}

export function UnavailablePanel({ title = "Telemetry unavailable", message }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400">
        <Unplug size={18} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-300">{title}</p>
      {message && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-slate-500">{message}</p>}
    </div>
  );
}