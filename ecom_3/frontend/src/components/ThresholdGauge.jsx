import { Gauge } from "lucide-react";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import Card from "./Card";
import { UnavailablePanel } from "./StatePanel";

export default function ThresholdGauge({ threshold }) {
  const available = threshold != null && Number.isFinite(threshold);

  return (
    <Card
      title="Admission Threshold"
      subtitle="Minimum CAAC score to enter the cache"
      icon={Gauge}
      className="h-full"
    >
      {available ? (
        <div className="relative mx-auto h-52 w-full max-w-[260px]">
          <RadialBarChart
            width={260}
            height={208}
            cx="50%"
            cy="88%"
            innerRadius="62%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={[{ name: "threshold", value: threshold, fill: "#22d3ee" }]}
          >
            <PolarAngleAxis type="number" domain={[0, 1]} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={12}
              background={{ fill: "rgba(148,163,184,0.08)" }}
              isAnimationActive={false}
            />
          </RadialBarChart>
          <div className="pointer-events-none absolute inset-x-0 bottom-1 text-center">
            <p className="text-4xl font-bold tabular-nums tracking-tight text-cyan-300">
              {Number(threshold).toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
              score required to admit
            </p>
          </div>
        </div>
      ) : (
        <UnavailablePanel title="Threshold telemetry unavailable" />
      )}
    </Card>
  );
}