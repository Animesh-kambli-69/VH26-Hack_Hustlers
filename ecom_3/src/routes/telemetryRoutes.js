const router = require("express").Router();
const c = require("../controllers/telemetryController");

// Read-only telemetry for the monitoring dashboard (public in demo mode;
// protect behind auth in any shared deployment).
router.get("/stats", c.stats);
router.get("/weights", c.weights);

module.exports = router;