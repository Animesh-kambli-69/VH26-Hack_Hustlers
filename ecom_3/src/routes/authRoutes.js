const router=require("express").Router(); const c=require("../controllers/authController");
router.post("/register",c.register); router.post("/login",c.login); router.get("/me",require("../middleware/auth").authenticate,c.me);
module.exports=router;
