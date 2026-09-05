import { Timer } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "./Card";
import { UnavailablePanel } from "./StatePanel";
import { formatLatency, formatTime } from "../utils/formatters";

function LineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0a101f]/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="font-medium tabular-nums text-slate-300">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="mt-0.5 tabular-nums" style={{ color: entry.stroke }}>
          {entry.name}: <span className="font-semibold">{formatLatency(entry.value)}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * DB vs Redis latency dual-line chart.
 *
 * The current ShopVerse API does not expose per-source latency telemetry, so
 * the component renders an honest "unavailable" state. If a future backend
 * version provides `series.db` / `series.redis` (arrays of { time, value }),
 * the dual-line chart below activates automatically — no fake data is ever
 * plotted.
 */
export default function LatencyChart({ series = null, avgLatencyMs = null }) {
  const hasSeries = series?.db?.length && series?.redis?.length;

  return (
    <Card
      title="DB vs Redis Latency"
      subtitle="Per-source latency telemetry"
      icon={Timer}
      className="h-full"
    >
      {hasSeries ? (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series.data} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="time"
                tickFormatter={(v) => formatTime(v)}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "rgba(148,163,184,0.12)" }}
                minTickGap={40}
              />
              <YAxis
                tickFormatter={(v) => `${v}ms`}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<LineTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="db" name="Database" stroke="#a78bfa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="redis" name="Redis" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <UnavailablePanel
          title="Latency telemetry unavailable"
          message={
            avgLatencyMs != null
              ? `The API does not expose a database-vs-Redis latency split. Only aggregate average backend latency is tracked: ${formatLatency(avgLatencyMs)}.`
              : "The API does not expose database-vs-Redis latency values. No latency is fabricated — wire the dual-line series here when the backend provides it."
          }
        />
      )}
    </Card>
  );
}