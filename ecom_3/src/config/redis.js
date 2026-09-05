const { createClient } = require("redis");
const { redisUrl } = require("./env");

const redis = createClient({ url: redisUrl });
redis.on("connect",  () => console.log("[Redis] connected to", redisUrl.replace(/:[^@]*@/, ":***@")));
redis.on("ready",    () => console.log("[Redis] ready"));
redis.on("error",    err => console.error("[Redis] error:", err.message));
redis.on("reconnecting", () => console.log("[Redis] reconnecting..."));
module.exports = redis;
