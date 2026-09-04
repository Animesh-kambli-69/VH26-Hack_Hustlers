import app from './app.js';
import { HOST, NODE_ENV, PORT } from './config.js';
import { connectRedis } from './redisClient.js';

await connectRedis();

app.listen(PORT, HOST, () => {
  console.log(`✅ ShopVerse API [${NODE_ENV}] listening on http://${HOST}:${PORT}`);
});
