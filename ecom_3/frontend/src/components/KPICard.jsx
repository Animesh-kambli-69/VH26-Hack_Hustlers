import { TrendingDown, TrendingUp, Minus } from "lucide-react";

const ACCENTS = {
  green: {
    chip: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    value: "text-emerald-300",
    bar: "from-emerald-400 to-teal-300",
  },
  cyan: {
    chip: "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    value: "text-cyan-300",
    bar: "from-cyan-400 to-sky-300",
  },
  blue: {
    chip: "border-blue-400/20 bg-blue-400/10 text-blue-300",
    value: "text-blue-300",
    bar: "from-blue-400 to-indigo-300",
  },
  violet: {
    chip: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    value: "text-violet-300",
    bar: "from-violet-400 to-purple-300",
  },
  amber: {
    chip: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    value: "text-amber-300",
    bar: "from-amber-400 to-orange-300",
  },
  red: {
    chip: "border-red-400/20 bg-red-400/10 text-red-300",
    value: "text-red-300",
    bar: "from-red-400 to-rose-300",
  },
  slate: {
    chip: "border-slate-400/20 bg-slate-400/10 text-slate-300",
    value: "text-slate-200",
    bar: "from-slate-400 to-slate-300",
  },
};

function TrendChip({ trend }) {
  if (!trend || trend.direction === "flat" || trend.value == null) {
    return (
      <span className="chip text-slate-400">
        <Minus size={12} />
        {trend?.label ?? "steady"}
      </span>
    );
  }
  const up = trend.direction === "up";
  return (
    <span className={`chip ${up ? "text-emerald-300" : "text-red-300"}`}>
      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {trend.value} {trend.label}
    </span>
  );
}

export default function KPICard({
  label,
  value,
  unit,
  icon: Icon,
  accent = "cyan",
  trend,
  rows = [],
  children,
}) {
  const a = ACCENTS[accent] || ACCENTS.cyan;
  return (
    <section className="glass-card glass-card-hover animate-fade-in flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-3xl font-bold tabular-nums tracking-tight ${a.value}`}>{value}</span>
            {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
          </div>
        </div>
        {Icon && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${a.chip}`}>
            <Icon size={17} strokeWidth={2} />
          </span>
        )}
      </div>

      {trend && (
        <div className="mt-2.5">
          <TrendChip trend={trend} />
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-xs">
              <span className="text-slate-500">{row.label}</span>
              <span className="font-medium tabular-nums text-slate-200">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </section>
  );
}