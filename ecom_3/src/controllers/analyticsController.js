const {get}=require("../services/analytics/analyticsService");
const {getCached,put}=require("../services/cache/cacheService");
const {touchMetric}=require("../services/cache/metadataService");
const {asyncHandler}=require("../utils/http");
module.exports=asyncHandler(async(req,res)=>{
  const key=`product-analytics:${req.params.code}`;
  const hit=await getCached(key);
  if(hit) return res.json({...hit,cache:{hit:true}});
  const result=await get(req.params.code);
  if(!result) return res.status(404).json({error:"Product not found"});
  const decision=await put(key,result.value,result.costInfo);
  await touchMetric(key,"miss",result.costInfo.latencyMs,result.costInfo.retrievalCost,Buffer.byteLength(JSON.stringify(result.value)));
  res.json({...result.value,cache:{hit:false,decision}});
});
