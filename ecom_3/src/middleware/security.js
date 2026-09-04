const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { corsOrigin } = require("../config/env");

const limiter = rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false });
module.exports = { helmet: helmet(), cors: cors({ origin: corsOrigin === "*" ? true : corsOrigin }), limiter };
