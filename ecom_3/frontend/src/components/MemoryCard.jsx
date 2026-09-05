import { Database, HardDrive } from "lucide-react";
import { formatBytes, formatNumber, pct } from "../utils/formatters";

function barColor(pctValue) {
  if (pctValue >= 85) return "bg-red-500";
  if (pctValue >= 60) return "bg-amber-400";
  return "bg-gradient-to-r from-cyan-400 to-violet-400";
}

export default function MemoryCard({ redis, compact = false }) {
  const used = redis?.memoryUsedBytes ?? null;
  const max = redis?.maxMemoryBytes ?? null;
  const usagePct = used != null && max ? pct(used, max) : null;
  const connected = redis?.connected ?? false;

  return (
    <section className="glass-card glass-card-hover animate-fade-in flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Redis Memory</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tabular-nums tracking-tight text-cyan-300">
              {used != null ? formatBytes(used) : "—"}
            </span>
            {max && <span className="text-sm font-medium text-slate-400">/ {formatBytes(max)}</span>}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {usagePct != null ? (
              <span className="font-medium tabular-nums text-slate-300">{usagePct.toFixed(1)}% used</span>
            ) : (
              <span className="text-amber-300/90">Memory limit unavailable</span>
            )}
          </p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
          <Database size={17} strokeWidth={2} />
        </span>
      </div>

      <div className="mt-4">
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor(usagePct ?? 0)}`}
            style={{ width: `${Math.max(0, Math.min(100, usagePct ?? 0))}%` }}
          />
        </div>
      </div>

      {!compact && (
        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 text-xs">
          <div>
            <p className="text-slate-500">Cached objects</p>
            <p className="mt-0.5 font-medium tabular-nums text-slate-200">
              {formatNumber(redis?.cachedObjectCount ?? 0)}
              {redis?.capacityObjects != null && (
                <span className="text-slate-500"> / {formatNumber(redis.capacityObjects)}</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Redis link</p>
            <p className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-200">
              <span className={`status-dot ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
              {connected ? "Connected" : "Unreachable"}
            </p>
          </div>
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[11px] leading-snug text-slate-500">
        <HardDrive size={11} className="shrink-0" />
        {max == null
          ? "Redis has no maxmemory configured — the backend does not report a memory ceiling."
          : "Usage measured from live Redis keys via CONFIG GET maxmemory."}
      </p>
    </section>
  );
}