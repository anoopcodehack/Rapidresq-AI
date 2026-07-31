const { createClient } = require("redis");
const logger = require("../utils/logger");

const redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });

redisClient.on("error", (err) => {
  logger.error(`Redis error: ${err.message}`);
});

redisClient.on("connect", () => {
  logger.info("Redis connected");
});

async function connectRedis() {
  try {
    if (!redisClient.isOpen) await redisClient.connect();
  } catch (err) {
    logger.error(`Redis connection failed, continuing without Redis: ${err.message}`);
  }
}

// Helper: is redis currently usable
function isRedisUp() {
  return redisClient.isOpen;
}

module.exports = { redisClient, connectRedis, isRedisUp };
