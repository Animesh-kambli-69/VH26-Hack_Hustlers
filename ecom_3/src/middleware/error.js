function notFound(req,res) { res.status(404).json({ error:"Route not found" }); }
function errorHandler(err, req, res, next) {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : "Internal server error" });
}
module.exports = { notFound, errorHandler };
