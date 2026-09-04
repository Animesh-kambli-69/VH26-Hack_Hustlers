// ---------------------------------------------------------------------------
// Cost-Aware Auto-Scaler Advisor (simulated — no real scaling happens).
//
// Watches the rolling window of *misses*: every miss is a recompute we paid
// for that a bigger cache could have avoided. If the projected avoidable
// cost per hour exceeds the cost of renting one more 100 MB cache node, the
// advisor recommends SCALE_UP and quotes the ROI.
//
//   "If +100MB → save ~$X/hr; node costs $Y/hr → ROI n×"
// ---------------------------------------------------------------------------

import { inr, fmtINR } from './costModel.js';

export const NODE_COST_PER_HOUR_USD = 0.15; // rented 100 MB cache node
export const NODE_CAPACITY_MB = 100;
// Modeled: with +100 MB we assume half of today's misses become hits.
export const ASSUMED_HIT_GAIN = 0.5;

export function advise({ windowMissCostUsd = 0, windowSeconds = 0 } = {}) {
  if (windowSeconds <= 0) {
    return {
      recommendation: 'COLD',
      missCostPerHourUsd: 0,
      avoidablePerHourUsd: 0,
      nodeCostPerHourUsd: NODE_COST_PER_HOUR_USD,
      capacityStepMB: NODE_CAPACITY_MB,
      roi: 0,
      summary: 'Not enough traffic to advise yet — keep watching.',
    };
  }

  const missCostPerHourUsd = (windowMissCostUsd * 3600) / windowSeconds;
  const avoidablePerHourUsd = missCostPerHourUsd * ASSUMED_HIT_GAIN;
  const roi = avoidablePerHourUsd / NODE_COST_PER_HOUR_USD;

  if (missCostPerHourUsd <= NODE_COST_PER_HOUR_USD) {
    return {
      recommendation: 'OK',
      missCostPerHourUsd,
      avoidablePerHourUsd,
      nodeCostPerHourUsd: NODE_COST_PER_HOUR_USD,
      capacityStepMB: NODE_CAPACITY_MB,
      roi,
      summary:
        `Misses cost ~$${missCostPerHourUsd.toFixed(3)}/hr — below the ` +
        `$${NODE_COST_PER_HOUR_USD.toFixed(2)}/hr node price. Current cache is fine.`,
    };
  }

  const savedInr = fmtINR(avoidablePerHourUsd);
  return {
    recommendation: 'SCALE_UP',
    missCostPerHourUsd,
    avoidablePerHourUsd,
    nodeCostPerHourUsd: NODE_COST_PER_HOUR_USD,
    capacityStepMB: NODE_CAPACITY_MB,
    roi,
    summary:
      `If +${NODE_CAPACITY_MB}MB → save ~$${avoidablePerHourUsd.toFixed(2)}/hr ` +
      `(${savedInr}/hr), node costs $${NODE_COST_PER_HOUR_USD.toFixed(2)}/hr → ` +
      `ROI ${roi.toFixed(1)}×, SCALE_UP`,
  };
}

