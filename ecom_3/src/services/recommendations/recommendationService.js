const prisma = require("../../config/prisma");
const { recommendationDelayMs, recommendationComputeCost, recommendationDbCost, recommendationExternalCost } = require("../../config/env");
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function generate(userId) {
  const start=process.hrtime.bigint();
  await prisma.user.findUnique({where:{id:userId}});
  await prisma.userActivity.findMany({where:{userId},include:{product:true},take:50,orderBy:{createdAt:"desc"}});
  await sleep(recommendationDelayMs);
  const products=await prisma.product.findMany({where:{isActive:true},take:5,orderBy:{createdAt:"desc"}});
  const latencyMs=Number(process.hrtime.bigint()-start)/1e6;
  return {
    value:{userId,products:products.map(p=>({id:p.id,code:p.code,name:p.name,price:p.price.toString()})),generatedAt:new Date().toISOString()},
    costInfo:{latencyMs,retrievalCost:recommendationComputeCost+recommendationDbCost+recommendationExternalCost}
  };
}
module.exports={generate};
