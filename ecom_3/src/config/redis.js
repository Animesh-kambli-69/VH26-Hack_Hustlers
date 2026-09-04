const { createClient } = require("redis");
const { redisUrl } = require("./env");

const redis = createClient({ url: redisUrl });
redis.on("error", err => console.error("[Redis]", err.message));
module.exports = redis;
