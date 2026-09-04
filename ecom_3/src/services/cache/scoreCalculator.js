const { weights, recencyLambda, sizePenaltyFactor } = require("../../config/env");

const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const normalize = (value, min, max) => max <= min ? 0 : clamp((value-min)/(max-min));

function calculateRecency(lastAccessAt, now=Date.now()) {
  if (!lastAccessAt) return 0;
  const seconds = Math.max(0, (now - new Date(lastAccessAt).getTime()) / 1000);
  return clamp(Math.exp(-recencyLambda * seconds));
}
function calculateTrend(recent, historical) {
  const raw = recent / (historical + 0.000001);
  return clamp(raw / 2);
}
function calculateScore(input) {
  const frequency = clamp(input.frequency);
  const recency = clamp(input.recency);
  const cost = clamp(input.retrievalCost);
  const latency = clamp(input.latency);
  const trend = clamp(input.trend);
  const base =
    weights.frequency * frequency +
    weights.recency * recency +
    weights.cost * cost +
    weights.latency * latency +
    weights.trend * trend;
  const sizePenalty = Math.max(0, input.objectSizeBytes || 0) * sizePenaltyFactor;
  const finalScore = clamp(base / (1 + sizePenalty));
  return { baseScore: base, sizePenalty, finalScore, signals: { frequency, recency, cost, latency, trend } };
}
function scoreReasons(signals, sizePenalty, comparison) {
  const reasons = [];
  if (signals.cost > .7) reasons.push("high regeneration cost");
  if (signals.latency > .7) reasons.push("high backend latency");
  if (signals.frequency > .7) reasons.push("high access frequency");
  if (signals.trend > .7) reasons.push("rising popularity trend");
  if (sizePenalty > .2) reasons.push("large object size penalty");
  if (comparison) reasons.push(comparison);
  return reasons.length ? reasons : ["balanced score across runtime signals"];
}
module.exports = { clamp, normalize, calculateRecency, calculateTrend, calculateScore, scoreReasons };
