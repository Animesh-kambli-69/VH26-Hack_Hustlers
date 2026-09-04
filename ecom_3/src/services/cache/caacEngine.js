const { cache } = require("../../config/env");
const { calculateRecency, calculateTrend, calculateScore, scoreReasons } = require("./scoreCalculator");

function buildSignals(meta, runtime = {}) {
  const historical = Math.max(1, meta.accessCount || 1);
  const recent = meta.recentAccessCount ?? Math.min(meta.accessCount || 0, 10);
  const frequency = Math.min(1, (meta.accessCount || 0) / Math.max(1, runtime.frequencyCeiling || 100));
  const recency = calculateRecency(meta.lastAccessAt);
  const trend = calculateTrend(recent, historical);
  const retrievalCost = Math.min(1, (meta.retrievalCost || 0) / Math.max(.0001, runtime.maxCost || 10));
  const latency = Math.min(1, (meta.avgLatencyMs || 0) / Math.max(1, runtime.maxLatencyMs || 3000));
  return { frequency, recency, trend, retrievalCost, latency };
}
function evaluate(meta, runtime={}) {
  const signals = buildSignals(meta, runtime);
  const result = calculateScore({ ...signals, objectSizeBytes: meta.objectSizeBytes || 0 });
  return { ...result, reasons: scoreReasons(result.signals, result.sizePenalty) };
}
function decideAdmission(score, lowestScore=null) {
  if (score < cache.admissionThreshold) return { action:"BYPASS", reason:["score below admission threshold"] };
  if (lowestScore == null) return { action:"ADMIT", reason:["space available"] };
  if (score > lowestScore) return { action:"ADMIT", reason:["new object has higher cost-saving value than lowest cached object"] };
  return { action:"BYPASS", reason:["new object does not exceed lowest cached score"] };
}
module.exports = { buildSignals, evaluate, decideAdmission };
