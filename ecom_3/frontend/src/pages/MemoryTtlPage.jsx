import Card from "../components/Card";
import MemoryCard from "../components/MemoryCard";
import { formatLatency, formatNumber, formatScore } from "../utils/formatters";

function ttlCell(value) {
  if (value == null) return <span className="text-slate-600">—</span>;
  return <span className="tabular-nums text-slate-300">{value}s</span>;
}

export default function MemoryTtlPage({ analytics }) {
  const { stats } = analytics;
  if (!stats) return null;
  const { redis, summary, objects } = stats;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MemoryCard redis={redis} />
        </div>
        <Card
          title="Cache Configuration"
          subtitle="Live backend settings"
        >
          <div className="space-y-3 text-sm">
            {[
              ["Capacity (objects)", formatNumber(summary.capacityObjects)],
              ["Default TTL", `${summary.defaultTtlSeconds}s`],
              ["Cached right now", formatNumber(redis.cachedObjectCount ?? 0)],
              ["Redis", redis.connected ? "Connected" : "Unreachable"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/[0.05] pb-2.5 last:border-0">
                <span className="text-slate-500">{label}</span>
                <span className="font-medium tabular-nums text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Per-Object Memory & TTL"
        subtitle="Configured TTL from metric aggregates · Redis TTL is the live remaining TTL of the cached key"
      >
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Cache Key</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Score</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Object Size</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Configured TTL</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Live Redis TTL</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Avg Latency</th>
                <th className="py-2.5 text-right font-semibold">Last Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {objects.map((o) => (
                <tr key={o.cacheKey} className="transition-colors hover:bg-white/[0.03]">
                  <td className="max-w-[260px] py-2.5 pr-4">
                    <p className="truncate font-mono text-xs text-slate-200" title={o.cacheKey}>
                      {o.cacheKey}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-cyan-300">
                    {formatScore(o.currentScore)}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                    {(o.objectSizeBytes ?? 0).toLocaleString()} B
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">{ttlCell(o.ttlSeconds)}</td>
                  <td className="py-2.5 pr-4 text-right font-mono text-xs">
                    {o.redisTtlSeconds != null && o.redisTtlSeconds >= 0 ? (
                      <span className="tabular-nums text-emerald-300">{o.redisTtlSeconds}s</span>
                    ) : (
                      <span className="text-slate-600" title="Key is not currently stored in Redis (expired or evicted)">
                        not cached
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                    {formatLatency(o.avgLatencyMs)}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-xs text-slate-400">
                    {o.lastAccessAt ? new Date(o.lastAccessAt).toLocaleTimeString("en-US", { hour12: false }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}