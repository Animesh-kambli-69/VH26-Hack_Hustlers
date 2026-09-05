import { Activity, ArrowUpRight, Gauge, Percent } from "lucide-react";
import DecisionChart from "../components/DecisionChart";
import HitRateChart from "../components/HitRateChart";
import KPICard from "../components/KPICard";
import { formatLatency, formatNumber, formatPercent, formatScore, ratio } from "../utils/formatters";

function hitAccent(hitRate) {
  if (hitRate > 0.75) return "green";
  if (hitRate >= 0.5) return "amber";
  return "red";
}

export default function CachePerformance({ analytics }) {
  const { stats, history } = analytics;
  if (!stats) return null;
  const { summary, decisionLog } = stats;
  const hitRate = ratio(summary.hits, summary.totalRequests);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Cache Hit Rate"
          value={formatPercent(hitRate)}
          icon={Percent}
          accent={hitAccent(hitRate)}
          rows={[
            { label: "Hits", value: formatNumber(summary.hits) },
            { label: "Misses", value: formatNumber(summary.misses) },
          ]}
        />
        <KPICard
          label="Total Requests"
          value={formatNumber(summary.totalRequests)}
          icon={Activity}
          accent="blue"
          rows={[{ label: "Backend calls", value: formatNumber(summary.backendCalls) }]}
        />
        <KPICard
          label="Cost Saved"
          value={formatNumber(summary.estimatedCostSaved)}
          icon={ArrowUpRight}
          accent="green"
          rows={[{ label: "Backend cost incurred", value: formatNumber(summary.estimatedBackendCost) }]}
        />
        <KPICard
          label="Admission Decisions"
          value={formatNumber(decisionLog.admit + decisionLog.bypass)}
          icon={Gauge}
          accent="violet"
          rows={[
            { label: "ADMIT", value: formatNumber(decisionLog.admit) },
            { label: "REJECT (BYPASS)", value: formatNumber(decisionLog.bypass) },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HitRateChart history={history} />
        <DecisionChart summary={summary} decisionLog={decisionLog} />
      </div>

      {/* Top cached objects */}
      <section className="glass-card glass-card-hover animate-fade-in p-5">
        <header className="mb-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Top Cached Objects
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Ordered by live CAAC score — real metric aggregates from the backend
          </p>
        </header>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Cache Key</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Score</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Hits</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Misses</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg Latency</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Retrieval Cost</th>
                <th className="py-2.5 text-right font-semibold">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {stats.objects.map((o) => (
                <tr key={o.cacheKey} className="transition-colors hover:bg-white/[0.03]">
                  <td className="max-w-[260px] py-2.5 pr-4">
                    <p className="truncate font-mono text-xs text-slate-200" title={o.cacheKey}>
                      {o.cacheKey}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-cyan-300">
                    {formatScore(o.currentScore)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-emerald-300">
                    {formatNumber(o.hitCount)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-red-300">
                    {formatNumber(o.missCount)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                    {formatLatency(o.avgLatencyMs)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                    {o.retrievalCost != null ? Number(o.retrievalCost).toFixed(2) : "—"}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-xs text-slate-300">
                    {(o.objectSizeBytes ?? 0).toLocaleString()} B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}