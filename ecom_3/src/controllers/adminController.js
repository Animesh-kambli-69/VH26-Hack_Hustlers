const prisma=require("../config/prisma");
const redis=require("../config/redis");
const {flush,listKeys}=require("../services/cache/cacheService");
const {asyncHandler}=require("../utils/http");
const {runBenchmark}=require("../benchmarks/benchmarkEngine");
const metrics=asyncHandler(async(req,res)=>{
  const rows=await prisma.cacheMetric.findMany(); const hits=rows.reduce((s,r)=>s+r.hitCount,0),misses=rows.reduce((s,r)=>s+r.missCount,0);
  const decisions=await prisma.cacheDecision.findMany({orderBy:{createdAt:"desc"},take:10});
  const memoryUsed=(await Promise.all((await listKeys()).map(k=>redis.memoryUsage(`cache:data:${k}`).catch(()=>0)))).reduce((a,b)=>a+(b||0),0);
  res.json({hitRate:(hits+misses)?hits/(hits+misses):0,missRate:(hits+misses)?misses/(hits+misses):0,
    avgLatencyMs:rows.length?rows.reduce((s,r)=>s+r.avgLatencyMs,0)/rows.length:0,
    p95LatencyMs:0,backendCalls:misses,estimatedBackendCost:rows.reduce((s,r)=>s+r.retrievalCost*r.missCount,0),
    estimatedCostSaved:rows.reduce((s,r)=>s+r.retrievalCost*r.hitCount,0),memoryUsedBytes:memoryUsed,capacityObjects:10,
    topCachedObjects:rows.sort((a,b)=>b.currentScore-a.currentScore).slice(0,10),recentDecisions:decisions});
});
const decisions=asyncHandler(async(req,res)=>res.json({decisions:await prisma.cacheDecision.findMany({orderBy:{createdAt:"desc"},take:Number(req.query.limit||50)})}));
const flushCache=asyncHandler(async(req,res)=>{await flush();res.json({message:"Cache flushed"});});
const benchmark=asyncHandler(async(req,res)=>res.status(202).json(await runBenchmark(req.body?.scenario||"expensive-rare",req.body?.requests||200)));
const benchmarkById=asyncHandler(async(req,res)=>{const row=await prisma.benchmarkRun.findUnique({where:{id:req.params.id}});if(!row)return res.status(404).json({error:"Benchmark not found"});res.json(row);});
module.exports={metrics,decisions,flushCache,benchmark,benchmarkById};
