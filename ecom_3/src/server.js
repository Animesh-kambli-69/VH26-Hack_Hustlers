const app = require("./app");
const redis = require("./config/redis");
const prisma = require("./config/prisma");
const { port } = require("./config/env");
(async () => { await redis.connect();await prisma.$connect(); app.listen(port, () => console.log(`ShopVerse API running on http://localhost:${port}`)); })().catch(e => { console.error("Startup failed", e); process.exit(1); });
process.on("SIGINT", async () => { await redis.quit(); await prisma.$disconnect(); process.exit(0) });
