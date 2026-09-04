const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("Admin@12345", 10);
  await prisma.user.upsert({
    where: { email: "admin@shopverse.local" },
    update: { role: "ADMIN", passwordHash },
    create: { name: "ShopVerse Admin", email: "admin@shopverse.local", passwordHash, role: "ADMIN" }
  });
  const user = await prisma.user.upsert({
    where: { email: "demo@shopverse.local" },
    update: {},
    create: { name: "Demo User", email: "demo@shopverse.local", passwordHash: await bcrypt.hash("Demo@12345", 10), role: "USER" }
  });

  const categoryNames = ["Footwear", "Electronics", "Home", "Fitness"];
  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await prisma.category.upsert({
      where: { name }, update: {}, create: { name }
    });
  }

  const products = [
    ["P001","Running Shoes","Lightweight running shoes",2499,"Footwear"],
    ["P002","Trail Shoes","Durable trail shoes",3199,"Footwear"],
    ["P003","Walking Shoes","Comfort walking shoes",1999,"Footwear"],
    ["P004","Smart Watch","Fitness smart watch",4999,"Electronics"],
    ["P005","Wireless Earbuds","Compact wireless earbuds",2999,"Electronics"],
    ["P006","Laptop Stand","Adjustable aluminum stand",1599,"Electronics"],
    ["P007","Coffee Maker","Programmable coffee maker",3999,"Home"],
    ["P008","Desk Lamp","LED desk lamp",999,"Home"],
    ["P009","Yoga Mat","Non-slip yoga mat",799,"Fitness"],
    ["P010","Dumbbells","Adjustable dumbbell set",3499,"Fitness"],
    ["P011","Resistance Bands","Set of resistance bands",699,"Fitness"],
    ["P012","Water Bottle","Insulated steel bottle",899,"Fitness"]
  ];
  for (const [code,name,description,price,cat] of products) {
    await prisma.product.upsert({
      where: { code },
      update: {},
      create: { code, name, description, price, stock: 100, categoryId: categories[cat].id }
    });
  }

  const p = await prisma.product.findUnique({ where: { code: "P001" } });
  if (p) await prisma.userActivity.createMany({
    data: Array.from({length: 10}, (_,i) => ({
      userId: user.id, productId: p.id, activityType: i % 2 ? "CLICK" : "VIEW"
    }))
  });

  console.log("Seed complete.");
  console.log("Admin: admin@shopverse.local / Admin@12345");
  console.log("Demo:  demo@shopverse.local / Demo@12345");
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
