function Pulse({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

export function KpiSkeleton() {
  return (
    <div className="glass-card animate-pulse p-5">
      <Pulse className="h-3 w-24" />
      <Pulse className="mt-3 h-8 w-28" />
      <Pulse className="mt-2 h-3 w-20" />
      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function ChartSkeleton({ height = "h-64" }) {
  return (
    <div className="glass-card animate-pulse p-5">
      <Pulse className="h-3 w-32" />
      <div className={`mt-4 ${height} flex items-end gap-2`}>
        {[0.4, 0.65, 0.5, 0.8, 0.6, 0.9, 0.7, 0.95, 0.55, 0.75, 0.85, 0.6].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-white/[0.05]"
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="glass-card animate-pulse p-5">
      <Pulse className="h-3 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Pulse className="h-3 w-16" />
            <Pulse className="h-3 flex-1" />
            <Pulse className="h-3 w-16" />
            <Pulse className="h-3 w-12" />
            <Pulse className="h-3 w-12" />
            <Pulse className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}