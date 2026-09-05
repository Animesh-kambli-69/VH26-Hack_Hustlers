import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "./Card";
import { formatNumber } from "../utils/formatters";

const COLORS = {
  HIT: "#34d399",
  MISS: "#f87171",
  ADMIT: "#22d3ee",
  REJECT: "#fbbf24",
  EVICT: "#a78bfa",
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a101f]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="flex items-center gap-2 font-medium text-slate-300">
        <span className="h-2 w-2 rounded-full" style={{ background: p.payload.fill }} />
        {label}
      </p>
      <p className="mt-1 tabular-nums text-slate-200">
        {formatNumber(p.value)} <span className="text-slate-500">decisions</span>
      </p>
    </div>
  );
}

export default function DecisionChart({ summary, decisionLog }) {
  const data = [
    { name: "HIT", value: summary?.hits ?? 0 },
    { name: "MISS", value: summary?.misses ?? 0 },
    { name: "ADMIT", value: decisionLog?.admit ?? 0 },
    { name: "REJECT", value: decisionLog?.bypass ?? 0 },
    { name: "EVICT", value: decisionLog?.evict ?? 0 },
  ];

  return (
    <Card
      title="Cumulative Cache Decisions"
      subtitle="HIT/MISS from metric aggregates · ADMIT/REJECT/EVICT from the decision log · REJECT = BYPASS"
      icon={BarChart3}
      className="h-full"
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -22 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.12)" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} isAnimationActive={false} maxBarSize={56}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                style={{ fill: "#cbd5e1", fontSize: 11, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}