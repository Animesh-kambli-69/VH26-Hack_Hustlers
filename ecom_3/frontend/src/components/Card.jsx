export default function Card({ title, subtitle, icon: Icon, right, children, className = "", bodyClassName = "" }) {
  return (
    <section className={`glass-card glass-card-hover animate-fade-in p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-cyan-300">
                <Icon size={15} strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {title}
                </h3>
              )}
              {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {right}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}