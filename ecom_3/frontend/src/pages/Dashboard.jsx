import {
  Activity,
  ArrowUpRight,
  Boxes,
  Gauge,
  Percent,
} from "lucide-react";
import ActivityTable from "../components/ActivityTable";
import CaacExplanation from "../components/CaacExplanation";
import DecisionChart from "../components/DecisionChart";
import HitRateChart from "../components/HitRateChart";
import KPICard from "../components/KPICard";
import LatencyChart from "../components/LatencyChart";
import MemoryCard from "../components/MemoryCard";
import ThresholdGauge from "../components/ThresholdGauge";
import WeightChart from "../components/WeightChart";
import { formatNumber, formatPercent, pct, ratio } from "../utils/formatters";

function hitAccent(hitRate) {
  if (hitRate > 0.75) return "green";
  if (hitRate >= 0.5) return "amber";
  return "red";
}

function hitTrend(history) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2].hitRate;
  const curr = history[history.length - 1].hitRate;
  const diff = +(curr - prev).toFixed(1);
  if (Math.abs(diff) < 0.05) return { direction: "flat", label: "vs previous snapshot" };
  return {
    direction: diff > 0 ? "up" : "down",
    value: `${Math.abs(diff).toFixed(1)}pp`,
    label: "vs previous snapshot",
  };
}

function requestsPerSecond(history) {
  if (history.length < 2) return null;
  const [prev, curr] = history.slice(-2);
  const deltaReq = curr.totalRequests - prev.totalRequests;
  const deltaSec = (curr.time - prev.time) / 1000;
  if (deltaReq <= 0 || deltaSec <= 0) return null;
  return deltaReq / deltaSec;
}

export default function Dashboard({ analytics }) {
  const { stats, weights, history } = analytics;
  if (!stats) return null;

  const { summary, decisionLog, redis } = stats;
  const hitRate = ratio(summary.hits, summary.totalRequests);
  const admissionRate = ratio(decisionLog.admit, decisionLog.admit + decisionLog.bypass);
  const rps = requestsPerSecond(history);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Cache Hit Rate"
          value={formatPercent(hitRate)}
          icon={Percent}
          accent={hitAccent(hitRate)}
          trend={hitTrend(history)}
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
          rows={[
            {
              label: "Requests / s",
              value: rps != null ? `${rps.toFixed(1)} (computed)` : "—",
            },
            { label: "Backend calls", value: formatNumber(summary.backendCalls) },
          ]}
        />

        <KPICard
          label="Admission Efficiency"
          value={admissionRate > 0 ? formatPercent(admissionRate) : "—"}
          icon={Gauge}
          accent="violet"
          rows={[
            { label: "ADMIT", value: formatNumber(decisionLog.admit) },
            { label: "REJECT", value: formatNumber(decisionLog.bypass) },
          ]}
        >
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all duration-700"
                style={{ width: `${Math.min(100, pct(decisionLog.admit, decisionLog.admit + decisionLog.bypass))}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {decisionLog.admit + decisionLog.bypass > 0
                ? `${formatNumber(decisionLog.admit)} of ${formatNumber(decisionLog.admit + decisionLog.bypass)} admission decisions accepted`
                : "No admission decisions recorded yet"}
            </p>
          </div>
        </KPICard>

        <MemoryCard redis={redis} compact />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HitRateChart history={history} />
        </div>
        <DecisionChart summary={summary} decisionLog={decisionLog} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <LatencyChart avgLatencyMs={summary.avgLatencyMs} />
        <WeightChart weights={weights} />
        <ThresholdGauge threshold={weights?.admissionThreshold} />
      </div>

      {/* CAAC explanation */}
      <CaacExplanation weights={weights} />

      {/* Cost-effectiveness strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KPICard
          label="Backend Cost Saved"
          value={formatNumber(summary.estimatedCostSaved)}
          icon={ArrowUpRight}
          accent="green"
          rows={[{ label: "Estimated backend cost", value: formatNumber(summary.estimatedBackendCost) }]}
        />
        <KPICard
          label="Cached Objects"
          value={formatNumber(redis.cachedObjectCount ?? 0)}
          icon={Boxes}
          accent="cyan"
          rows={[
            { label: "Capacity", value: formatNumber(summary.capacityObjects) },
            { label: "Avg backend latency", value: `${summary.avgLatencyMs.toFixed(1)}ms` },
          ]}
        />
      </div>

      {/* Activity stream */}
      <ActivityTable decisions={stats.recentDecisions} limit={10} />
    </div>
  );
}