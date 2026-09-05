import { Info } from "lucide-react";
import Card from "../components/Card";
import ThresholdGauge from "../components/ThresholdGauge";
import WeightChart from "../components/WeightChart";

const WEIGHT_DETAILS = [
  { key: "frequency", name: "Frequency", desc: "Normalized access frequency — how often the key is requested." },
  { key: "recency", name: "Recency", desc: "Exponential decay of time since last access (exp(-λ·Δt))." },
  { key: "retrievalCost", name: "Retrieval Cost", desc: "Simulated backend regeneration cost — expensive work scores higher." },
  { key: "latency", name: "Latency", desc: "Backend latency savings — slow operations are worth caching." },
  { key: "trend", name: "Trend", desc: "Recent vs historical access frequency — rising popularity." },
];

export default function WeightsPage({ analytics }) {
  const { weights } = analytics;
  const w = weights?.weights;
  const threshold = weights?.admissionThreshold;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WeightChart weights={weights} />
        </div>
        <ThresholdGauge threshold={threshold} />
      </div>

      <Card title="Weight Reference" subtitle="Signal weights driving the adaptive score — from /api/analytics/weights">
        <div className="divide-y divide-white/[0.05]">
          {WEIGHT_DETAILS.map((d) => (
            <div key={d.key} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-200">{d.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">{d.desc}</p>
              </div>
              <span className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-1 font-mono text-sm font-semibold tabular-nums text-violet-300">
                {w ? Number(w[d.key]).toFixed(2) : "—"}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Score Formula"
        subtitle="BaseScore then size penalty — same formula used by the backend CAAC engine"
      >
        <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#04060d]/60 p-5">
          <p className="font-mono text-sm leading-relaxed text-slate-300">
            BaseScore = <span className="text-cyan-300">wF</span>·Frequency +{" "}
            <span className="text-blue-300">wR</span>·Recency +{" "}
            <span className="text-violet-300">wC</span>·RetrievalCost +{" "}
            <span className="text-fuchsia-300">wL</span>·Latency +{" "}
            <span className="text-emerald-300">wT</span>·Trend
            <br />
            FinalScore = BaseScore / (1 + SizePenalty)
          </p>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
            <Info size={13} className="mt-0.5 shrink-0" />
            All signals are normalized to [0, 1] before weighting. Large objects pay a
            size penalty so memory-hungry values need a higher base score to be admitted.
          </p>
        </div>
      </Card>
    </div>
  );
}