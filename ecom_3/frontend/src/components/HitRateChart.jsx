import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "./Card";
import { formatPercent, formatTime } from "../utils/formatters";

function hitColor(hitRate) {
  if (hitRate > 75) return { stroke: "#34d399", text: "text-emerald-300", gradient: "rgba(52,211,153,0.25)" };
  if (hitRate >= 50) return { stroke: "#fbbf24", text: "text-amber-300", gradient: "rgba(251,191,36,0.25)" };
  return { stroke: "#f87171", text: "text-red-300", gradient: "rgba(248,113,113,0.25)" };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a101f]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-medium tabular-nums text-slate-300">{label}</p>
      <p className="mt-1 tabular-nums text-cyan-300">
        Hit rate: <span className="font-semibold">{formatPercent(p.hitRate / 100)}</span>
      </p>
      <p className="tabular-nums text-slate-400">
        Requests: <span className="font-medium text-slate-200">{p.totalRequests.toLocaleString()}</span>
      </p>
    </div>
  );
}

export default function HitRateChart({ history }) {
  const last = history[history.length - 1];
  const current = last?.hitRate ?? null;
  const color = hitColor(current ?? 0);

  const data = history.map((p) => ({
    time: formatTime(p.time),
    hitRate: p.hitRate,
    totalRequests: p.totalRequests,
  }));

  return (
    <Card
      title="Cache Hit Rate Over Time"
      subtitle="Session history of fetched snapshots — real values only"
      icon={Activity}
      className="h-full"
      right={
        <div className="text-right">
          <p className={`text-2xl font-bold tabular-nums ${color.text}`}>
            {current != null ? formatPercent(current / 100) : "—"}
          </p>
          <p className="text-[11px] text-slate-500">current</p>
        </div>
      }
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="hitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color.stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color.stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "rgba(148,163,184,0.12)" }}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: "#64748b", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="hitRate"
              stroke={color.stroke}
              strokeWidth={2}
              fill="url(#hitGradient)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}