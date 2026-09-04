const router=require("express").Router(); const c=require("../services/products/productController");
router.get("/",c.listProducts); router.get("/search",c.searchProducts); router.get("/categories",c.getCategories); router.get("/:code",c.getProduct);
module.exports=router;
