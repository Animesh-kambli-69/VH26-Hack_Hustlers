const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
function requireRole(role) {
  return (req,res,next) => req.user?.role === role
    ? next()
    : res.status(403).json({ error: "Forbidden" });
}
module.exports = { authenticate, requireRole };
