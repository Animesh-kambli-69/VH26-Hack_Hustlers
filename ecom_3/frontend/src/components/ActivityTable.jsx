import { ScrollText } from "lucide-react";
import Card from "./Card";
import { UnavailablePanel } from "./StatePanel";
import { formatLatency, formatScore, formatTime } from "../utils/formatters";

const EVENT_STYLES = {
  ADMIT: "border-cyan-400/25 bg-cyan-400/10 text-cyan-300",
  BYPASS: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  REJECT: "border-amber-400/25 bg-amber-400/10 text-amber-300",
  EVICT: "border-violet-400/25 bg-violet-400/10 text-violet-300",
  RETAIN: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  REFRESH: "border-blue-400/25 bg-blue-400/10 text-blue-300",
  CACHE: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
};

const STATUS_STYLES = {
  SUCCESS: "text-emerald-300",
  EVICTED: "text-violet-300",
  SKIPPED: "text-slate-400",
};

function statusFor(action) {
  if (action === "EVICT") return { label: "EVICTED", style: STATUS_STYLES.EVICTED };
  if (action === "BYPASS") return { label: "SKIPPED", style: STATUS_STYLES.SKIPPED };
  return { label: "SUCCESS", style: STATUS_STYLES.SUCCESS };
}

// reason is a Json column in the backend — it can arrive as a string[], a bare
// string, or an object. Render any shape without crashing.
function reasonText(reason) {
  if (Array.isArray(reason)) return reason.map(r => String(r)).join(" · ");
  if (typeof reason === "string") return reason;
  if (reason && typeof reason === "object") {
    const strings = Object.values(reason).filter(v => typeof v === "string");
    if (strings.length) return strings.join(" · ");
    try { return JSON.stringify(reason); } catch { return ""; }
  }
  return "";
}

export default function ActivityTable({ decisions = [], title = "Live Activity Stream", limit = 10 }) {
  const rows = decisions.slice(0, limit);

  return (
    <Card
      title={title}
      subtitle="Recent events from the CAAC decision log — real backend data"
      icon={ScrollText}
      bodyClassName=""
    >
      {decisions.length === 0 ? (
        <UnavailablePanel
          title="Recent activity endpoint not available"
          message="The backend has not recorded any cache decisions yet. The table is wired to the decision log and will populate as traffic flows."
        />
      ) : (
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2.5 pr-4 font-semibold">Time</th>
                <th className="py-2.5 pr-4 font-semibold">Request Key</th>
                <th className="py-2.5 pr-4 font-semibold">Event</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Score</th>
                <th className="py-2.5 pr-4 text-right font-semibold">Latency</th>
                <th className="py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.map((d) => {
                const status = statusFor(d.action);
                return (
                  <tr key={d.id} className="transition-colors hover:bg-white/[0.03]">
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-xs text-slate-400">
                      {formatTime(d.createdAt)}
                    </td>
                    <td className="max-w-[220px] py-2.5 pr-4">
                      <p
                        className="truncate font-mono text-xs text-slate-200"
                        title={d.cacheKey}
                      >
                        {d.cacheKey}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500" title={reasonText(d.reason)}>
                        {reasonText(d.reason) || "—"}
                      </p>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                          EVENT_STYLES[d.action] || EVENT_STYLES.BYPASS
                        }`}
                      >
                        {d.action}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                      {formatScore(d.score)}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-xs text-slate-300">
                      {formatLatency(d.latencyMs)}
                    </td>
                    <td className={`py-2.5 text-xs font-semibold ${status.style}`}>{status.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}