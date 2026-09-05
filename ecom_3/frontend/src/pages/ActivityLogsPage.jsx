import ActivityTable from "../components/ActivityTable";
import { formatNumber } from "../utils/formatters";

function SummaryChip({ label, value, className = "text-slate-300" }) {
  return (
    <div className="glass-card glass-card-hover animate-fade-in px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  );
}

export default function ActivityLogsPage({ analytics }) {
  const { stats } = analytics;
  if (!stats) return null;
  const { summary, decisionLog, recentDecisions } = stats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryChip label="HIT" value={formatNumber(summary.hits)} className="text-emerald-300" />
        <SummaryChip label="MISS" value={formatNumber(summary.misses)} className="text-red-300" />
        <SummaryChip label="ADMIT" value={formatNumber(decisionLog.admit)} className="text-cyan-300" />
        <SummaryChip label="REJECT (BYPASS)" value={formatNumber(decisionLog.bypass)} className="text-amber-300" />
        <SummaryChip label="EVICT" value={formatNumber(decisionLog.evict)} className="text-violet-300" />
        <SummaryChip label="OTHER" value={formatNumber(decisionLog.other)} className="text-slate-400" />
      </div>

      <ActivityTable decisions={recentDecisions} title="Activity Log" limit={25} />

      <p className="px-1 text-xs leading-relaxed text-slate-500">
        HIT and MISS counts are cumulative aggregates from the cache metric store; ADMIT,
        REJECT and EVICT counts come from the persisted decision log. The table below shows
        the latest real decision events the backend has recorded — nothing is synthesized.
      </p>
    </div>
  );
}