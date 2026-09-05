import { SlidersHorizontal } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import Card from "./Card";

const PARAMS = [
  { key: "frequency", label: "Frequency", full: "Access frequency" },
  { key: "recency", label: "Recency", full: "Exponential recency decay" },
  { key: "retrievalCost", label: "Retrieval Cost", full: "Backend regeneration cost" },
  { key: "latency", label: "Latency", full: "Backend latency savings" },
  { key: "trend", label: "Trend", full: "Search/popularity trend" },
];

function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a101f]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-medium text-slate-300">{p.full}</p>
      <p className="mt-1 tabular-nums text-violet-300">
        Weight: <span className="font-semibold">{p.value.toFixed(2)}</span>
      </p>
    </div>
  );
}

export default function WeightChart({ weights }) {
  const w = weights?.weights;
  const data = w
    ? PARAMS.map((p) => ({ param: p.label, full: p.full, value: Number(w[p.key]) || 0 }))
    : [];

  return (
    <Card
      title="CAAC Weight Distribution"
      subtitle="Live values from /api/analytics/weights"
      icon={SlidersHorizontal}
      className="h-full"
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="rgba(148,163,184,0.15)" />
            <PolarAngleAxis
              dataKey="param"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
            />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            <Tooltip content={<RadarTooltip />} />
            <Radar
              dataKey="value"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="#8b5cf6"
              fillOpacity={0.28}
              dot={{ r: 3, fill: "#a78bfa", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5 border-t border-white/[0.06] pt-3">
        {data.map((d) => (
          <div key={d.param} className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">{d.param}</p>
            <p className="text-sm font-semibold tabular-nums text-violet-300">{d.value.toFixed(2)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}