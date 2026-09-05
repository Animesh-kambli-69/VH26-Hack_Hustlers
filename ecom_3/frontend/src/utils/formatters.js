export const formatNumber = (n) =>
  n == null || Number.isNaN(n) ? "—" : new Intl.NumberFormat("en-US").format(n);

/** 0.584 → "58.4%" */
export const formatPercent = (v, digits = 1) =>
  v == null || Number.isNaN(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

export const formatScore = (v) => (v == null || Number.isNaN(v) ? "—" : Number(v).toFixed(2));

export const formatLatency = (ms) => {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1) return "<1ms";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
};

export const formatBytes = (bytes) => {
  if (bytes == null || Number.isNaN(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/** 12-hour clock, e.g. "10:42:18 AM" */
export const formatClock = (date) =>
  new Date(date).toLocaleTimeString("en-US", { hour12: true });

/** 24-hour clock for chart axes, e.g. "10:42:18" */
export const formatTime = (date) =>
  new Date(date).toLocaleTimeString("en-US", { hour12: false });

/** Safe percentage: 0 when total is 0/undefined — never NaN. */
export const pct = (part, total) => (total ? (part / total) * 100 : 0);

/** Safe ratio: 0 when total is 0/undefined — never NaN. */
export const ratio = (part, total) => (total ? part / total : 0);