const router=require("express").Router(); const {authenticate}=require("../middleware/auth"); const c=require("../controllers/analyticsController");
router.get("/:code/analytics",authenticate,c); module.exports=router;
