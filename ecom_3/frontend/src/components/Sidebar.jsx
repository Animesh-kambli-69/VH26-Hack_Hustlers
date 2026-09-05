import {
  Database,
  Gauge,
  LayoutDashboard,
  ScrollText,
  Settings,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "cache", label: "Cache Performance", icon: Gauge },
  { id: "weights", label: "CAAC Weights", icon: SlidersHorizontal },
  { id: "memory", label: "Memory & TTL", icon: Database },
  { id: "activity", label: "Activity Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

function Brand({ collapsed }) {
  return (
    <div className={`flex items-center gap-3 px-4 ${collapsed ? "justify-center px-2" : ""} py-5`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-slate-950 shadow-glow">
        <Zap size={18} strokeWidth={2.5} />
      </span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-100">ShopVerse</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-[0.18em] text-cyan-400/80">
            CAAC Monitor
          </p>
        </div>
      )}
    </div>
  );
}

function NavList({ activePage, onNavigate, collapsed }) {
  return (
    <nav className="flex-1 space-y-1 px-3">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const active = activePage === id;
        return (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            title={collapsed ? label : undefined}
            className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              collapsed ? "justify-center px-2" : ""
            } ${
              active
                ? "bg-gradient-to-r from-cyan-400/15 to-violet-400/10 text-cyan-200"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-cyan-400 to-violet-400" />
            )}
            <Icon
              size={17}
              strokeWidth={2}
              className={active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300"}
            />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function Footer({ collapsed }) {
  return (
    <div className={`border-t border-white/[0.06] px-4 py-4 ${collapsed ? "px-2 text-center" : ""}`}>
      <div className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}>
        <span className="status-dot bg-emerald-400" />
        {!collapsed && (
          <p className="text-[11px] text-slate-500">
            CAAC engine v1.0 · <span className="text-slate-400">live telemetry</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function Sidebar({ activePage, onNavigate, open, onClose, collapsed, onToggleCollapsed }) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-white/[0.06] bg-[#070b16]/95 backdrop-blur-xl transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[68px]" : "lg:w-60"}`}
      >
        <div className="flex items-center justify-between">
          <Brand collapsed={collapsed} />
          <button
            onClick={onClose}
            className="mr-3 rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 lg:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <NavList activePage={activePage} onNavigate={onNavigate} collapsed={collapsed} />

        <button
          onClick={onToggleCollapsed}
          className="mx-3 mb-2 hidden items-center justify-center gap-2 rounded-xl border border-white/[0.06] py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300 lg:flex"
        >
          {collapsed ? "»" : "« Collapse"}
        </button>

        <Footer collapsed={collapsed} />
      </aside>
    </>
  );
}