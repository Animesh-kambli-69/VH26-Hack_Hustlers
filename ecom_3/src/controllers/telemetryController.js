const { getStats, getWeights } = require("../services/analytics/telemetryService");
const { asyncHandler } = require("../utils/http");

const stats = asyncHandler(async (req, res) => {
  res.json(await getStats());
});

const weights = asyncHandler(async (req, res) => {
  res.json(getWeights());
});

module.exports = { stats, weights };