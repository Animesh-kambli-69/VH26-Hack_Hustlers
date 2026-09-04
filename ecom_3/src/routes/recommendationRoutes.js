const router=require("express").Router(); const {authenticate}=require("../middleware/auth"); const c=require("../controllers/recommendationController");
router.get("/:userId",authenticate,c); module.exports=router;
