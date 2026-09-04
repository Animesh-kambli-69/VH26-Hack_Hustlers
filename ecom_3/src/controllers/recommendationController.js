const {generate}=require("../services/recommendations/recommendationService");
const {getCached,put}=require("../services/cache/cacheService");
const {touchMetric}=require("../services/cache/metadataService");
const {asyncHandler}=require("../utils/http");
module.exports=asyncHandler(async(req,res)=>{
  const key=`recommendation:${req.params.userId}`;
  const hit=await getCached(key); if(hit) return res.json({...hit,cache:{hit:true,backendAvoided:true}});
  const {value,costInfo}=await generate(req.params.userId);
  const decision=await put(key,value,costInfo);
  await touchMetric(key,"miss",costInfo.latencyMs,costInfo.retrievalCost,Buffer.byteLength(JSON.stringify(value)));
  res.json({...value,cache:{hit:false,decision}});
});
