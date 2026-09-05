import { Cpu } from "lucide-react";
import Card from "./Card";

const TERMS = [
  { key: "frequency", symbol: "wF", label: "Frequency", color: "text-cyan-300" },
  { key: "recency", symbol: "wR", label: "Recency", color: "text-blue-300" },
  { key: "retrievalCost", symbol: "wC", label: "Retrieval Cost", color: "text-violet-300" },
  { key: "latency", symbol: "wL", label: "Latency", color: "text-fuchsia-300" },
  { key: "trend", symbol: "wT", label: "Trend", color: "text-emerald-300" },
];

export default function CaacExplanation({ weights }) {
  const w = weights?.weights;
  const threshold = weights?.admissionThreshold;

  return (
    <Card
      title="How CAAC decides"
      subtitle="Cost-Aware Adaptive Cache — admission by adaptive score, not access count alone"
      icon={Cpu}
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <p className="max-w-xl text-sm leading-relaxed text-slate-400">
          CAAC evaluates every cache candidate against access{" "}
          <span className="text-slate-200">frequency</span>,{" "}
          <span className="text-slate-200">recency</span>,{" "}
          <span className="text-slate-200">retrieval cost</span>,{" "}
          <span className="text-slate-200">latency savings</span> and{" "}
          <span className="text-slate-200">search trends</span>. Items are admitted
          only when their adaptive score clears the current admission threshold — so
          an expensive, rarely-requested object can outrank a cheap frequent one when
          it saves more backend cost per byte of memory.
        </p>

        <div className="rounded-xl border border-white/[0.07] bg-[#04060d]/60 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Live scoring formula
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
            {TERMS.map((t, i) => (
              <span key={t.key} className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-300">
                  {t.symbol}
                  <span className={t.color}>·{t.label}</span>
                </span>
                {w != null && (
                  <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-xs tabular-nums text-slate-300">
                    {Number(w[t.key]).toFixed(2)}
                  </span>
                )}
                {i < TERMS.length - 1 && <span className="text-slate-600">+</span>}
              </span>
            ))}
          </div>
          <p className="mt-3 font-mono text-xs text-slate-400">
            FinalScore = BaseScore / (1 + SizePenalty)
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Admission requires FinalScore{" "}
            <span className="font-semibold text-cyan-300">
              ≥ {threshold != null ? Number(threshold).toFixed(2) : "—"}
            </span>{" "}
            and capacity; otherwise the item is bypassed (logged as REJECT).
          </p>
        </div>
      </div>
    </Card>
  );
}