import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from "./components/Skeletons";
import { ErrorPanel, OfflinePanel } from "./components/StatePanel";
import { useAnalytics } from "./hooks/useAnalytics";
import ActivityLogsPage from "./pages/ActivityLogsPage";
import CachePerformance from "./pages/CachePerformance";
import Dashboard from "./pages/Dashboard";
import MemoryTtlPage from "./pages/MemoryTtlPage";
import SettingsPage from "./pages/SettingsPage";
import WeightsPage from "./pages/WeightsPage";

function LoadingLayout() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <ChartSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}

function DegradedBanner({ message }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2.5 text-sm text-amber-200">
      <AlertTriangle size={15} className="shrink-0" />
      {message || "Backend degraded — showing last known data."}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [intervalMs, setIntervalMs] = useState(5000);

  const analytics = useAnalytics({ intervalMs });

  const pageContent = useMemo(() => {
    switch (page) {
      case "cache":
        return <CachePerformance analytics={analytics} />;
      case "weights":
        return <WeightsPage analytics={analytics} />;
      case "memory":
        return <MemoryTtlPage analytics={analytics} />;
      case "activity":
        return <ActivityLogsPage analytics={analytics} />;
      case "settings":
        return (
          <SettingsPage
            analytics={analytics}
            intervalMs={intervalMs}
            onIntervalChange={setIntervalMs}
          />
        );
      default:
        return <Dashboard analytics={analytics} />;
    }
  }, [page, analytics, intervalMs]);

  const navigate = (id) => {
    setPage(id);
    setSidebarOpen(false);
  };

  let content;
  if (analytics.isLoading) {
    content = <LoadingLayout />;
  } else if (analytics.isOffline && !analytics.hasData) {
    content = <OfflinePanel onRetry={analytics.refresh} />;
  } else if (analytics.status === "error" && !analytics.hasData) {
    content = <ErrorPanel message={analytics.error} onRetry={analytics.refresh} />;
  } else {
    content = (
      <>
        {analytics.status === "degraded" && <DegradedBanner message={analytics.error} />}
        {pageContent}
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        activePage={page}
        onNavigate={navigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((c) => !c)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          status={analytics.status}
          telemetry={analytics.telemetry}
          lastUpdated={analytics.lastUpdated}
          autoRefresh={analytics.autoRefresh}
          intervalMs={intervalMs}
          onToggleAutoRefresh={() => analytics.setAutoRefresh((v) => !v)}
          onRefresh={analytics.refresh}
          onOpenSidebar={() => setSidebarOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1400px] flex-1 p-4 sm:p-6">
          <ErrorBoundary>{content}</ErrorBoundary>
        </main>

        <footer className="border-t border-white/[0.05] px-6 py-4 text-center text-[11px] text-slate-600">
          ShopVerse · Cost-Aware Adaptive Cache · observability dashboard — data sourced live
          from <span className="font-mono">/api/analytics/*</span> · no synthetic metrics
        </footer>
      </div>
    </div>
  );
}