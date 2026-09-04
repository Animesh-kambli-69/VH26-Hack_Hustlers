const prisma=require("../../config/prisma");
const { analyticsDelayMs }=require("../../config/env");
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(productCode){
  const start=process.hrtime.bigint();
  const p=await prisma.product.findUnique({where:{code:productCode}});
  if(!p) return null;
  const views=await prisma.userActivity.count({where:{productId:p.id,activityType:"VIEW"}});
  await sleep(analyticsDelayMs);
  const latencyMs=Number(process.hrtime.bigint()-start)/1e6;
  return {value:{productCode,views,purchases:await prisma.userActivity.count({where:{productId:p.id,activityType:"PURCHASE"}}),generatedAt:new Date().toISOString()},costInfo:{latencyMs,retrievalCost:4}};
}
module.exports={get};
