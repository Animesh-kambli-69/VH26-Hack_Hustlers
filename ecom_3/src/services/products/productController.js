const { list,getByCode,search,categories }=require("./productService");
const { asyncHandler }=require("../../utils/http");
const { getCached,put }=require("../cache/cacheService");
const { touchMetric,getMetric }=require("../cache/metadataService");
function cacheKeyFor(req){ return `products:${req.originalUrl.replace(/\//g,"/")}`; }
const listProducts=asyncHandler(async(req,res)=>{
  const page=Number(req.query.page||1),limit=Number(req.query.limit||20);
  const key=`products:list:page=${page}:limit=${limit}`;
  const hit=await getCached(key); if(hit) return res.json({...hit,cache:{hit:true}});
  const start=Date.now(); const result=await list({page,limit,categoryId:req.query.categoryId});
  const latencyMs=Date.now()-start; await touchMetric(key,"miss",latencyMs,.1,Buffer.byteLength(JSON.stringify(result)));
  const decision=await put(key,result,{latencyMs,retrievalCost:.1});
  res.json({...result,cache:{hit:false,decision}});
});
const getProduct=asyncHandler(async(req,res)=>{
  const key=`product:${req.params.code}`;
  const hit=await getCached(key); if(hit) return res.json({...hit,cache:{hit:true}});
  const start=Date.now(); const result=await getByCode(req.params.code);
  if(!result) return res.status(404).json({error:"Product not found"});
  const value={id:result.id,code:result.code,name:result.name,description:result.description,price:result.price.toString(),stock:result.stock,category:result.category.name};
  const latencyMs=Date.now()-start; await touchMetric(key,"miss",latencyMs,.1,Buffer.byteLength(JSON.stringify(value)));
  const decision=await put(key,value,{latencyMs,retrievalCost:.1});
  res.json({...value,cache:{hit:false,decision}});
});
const searchProducts=asyncHandler(async(req,res)=>{
  const q=String(req.query.q||"").trim(); if(!q) return res.status(400).json({error:"q is required"});
  const page=Number(req.query.page||1),limit=Number(req.query.limit||20);
  const key=`products:search:q=${encodeURIComponent(q)}:page=${page}:limit=${limit}`;
  const hit=await getCached(key); if(hit) return res.json({...hit,cache:{hit:true}});
  const start=Date.now(); const result=await search(q,{page,limit}); const latencyMs=Date.now()-start;
  await touchMetric(key,"miss",latencyMs,.2,Buffer.byteLength(JSON.stringify(result)));
  const decision=await put(key,result,{latencyMs,retrievalCost:.2});
  res.json({...result,cache:{hit:false,decision}});
});
const getCategories=asyncHandler(async(req,res)=>res.json(await categories()));
module.exports={listProducts,getProduct,searchProducts,getCategories};
