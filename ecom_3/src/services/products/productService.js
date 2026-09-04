const prisma = require("../../config/prisma");
async function list({page=1,limit=20,categoryId}) {
  const where={isActive:true,...(categoryId?{categoryId}:{})};
  const [items,total]=await Promise.all([
    prisma.product.findMany({where,skip:(page-1)*limit,take:limit,include:{category:true},orderBy:{createdAt:"desc"}}),
    prisma.product.count({where})
  ]);
  return {items,total,page,limit};
}
async function getByCode(code) {
  return prisma.product.findUnique({where:{code},include:{category:true}});
}
async function search(q,{page=1,limit=20}={}) {
  const where={isActive:true,name:{contains:q,mode:"insensitive"}};
  const [items,total]=await Promise.all([
    prisma.product.findMany({where,skip:(page-1)*limit,take:limit,include:{category:true}}),
    prisma.product.count({where})
  ]);
  return {items,total,page,limit,q};
}
async function categories() { return prisma.category.findMany({orderBy:{name:"asc"}}); }
module.exports = { list,getByCode,search,categories };
