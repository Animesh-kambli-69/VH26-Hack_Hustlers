const router=require("express").Router(); const {authenticate,requireRole}=require("../middleware/auth"); const c=require("../controllers/adminController");
router.use(authenticate,requireRole("ADMIN"));
router.get("/cache/metrics",c.metrics); router.get("/cache/decisions",c.decisions); router.post("/cache/flush",c.flushCache);
router.post("/benchmark/run",c.benchmark); router.get("/benchmark/:id",c.benchmarkById);
module.exports=router;
