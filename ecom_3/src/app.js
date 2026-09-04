const express=require("express");
const swaggerUi=require("swagger-ui-express");
const {helmet,cors,limiter}=require("./middleware/security");
const auth=require("./routes/authRoutes"),products=require("./routes/productRoutes"),recs=require("./routes/recommendationRoutes"),analytics=require("./routes/analyticsRoutes"),admin=require("./routes/adminRoutes");
const {notFound,errorHandler}=require("./middleware/error");
const app=express();
app.use(helmet); app.use(cors); app.use(express.json({limit:"1mb"})); app.use(limiter);
app.get("/health",(req,res)=>res.json({status:"ok",service:"shopverse-cache"}));
app.use("/api/auth",auth); app.use("/api/products",products); app.use("/api/recommendations",recs); app.use("/api/products",analytics); app.use("/api/admin",admin);
const spec={openapi:"3.0.0",info:{title:"ShopVerse CAAC API",version:"1.0.0"},servers:[{url:"http://localhost:3000"}],paths:{
"/health":{get:{summary:"Health check"}}, "/api/auth/register":{post:{summary:"Register"}}, "/api/auth/login":{post:{summary:"Login"}},
"/api/products":{get:{summary:"List products"}}, "/api/products/{code}":{get:{summary:"Get product"}}, "/api/products/search":{get:{summary:"Search products"}},
"/api/products/categories":{get:{summary:"List categories"}}, "/api/recommendations/{userId}":{get:{summary:"Expensive recommendations"}},
"/api/products/{code}/analytics":{get:{summary:"Expensive analytics"}}, "/api/admin/cache/metrics":{get:{summary:"Cache metrics"}},
"/api/admin/cache/decisions":{get:{summary:"Decision log"}}, "/api/admin/cache/flush":{post:{summary:"Flush cache"}}, "/api/admin/benchmark/run":{post:{summary:"Run benchmark"}}
}};
app.use("/api/docs",swaggerUi.serve,swaggerUi.setup(spec));
app.use(notFound); app.use(errorHandler);
module.exports=app;
