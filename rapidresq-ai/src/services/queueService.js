const { redisClient, isRedisUp } = require("../config/redis");
const logger = require("../utils/logger");

const QUEUE_KEY = "pending_requests";
const CACHE_KEY = "active_requests";
const CACHE_TTL_SECONDS = 60;

const PRIORITY_SCORE = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

// Add a request to the Redis priority queue. Never throws — logs and
// continues if Redis is down, so request creation still succeeds.
async function addToQueue(requestId, priority) {
  if (!isRedisUp()) {
    logger.error(`Redis down — request ${requestId} saved to DB only, not queued`);
    return false;
  }
  try {
    const score = PRIORITY_SCORE[priority] || 1;
    await redisClient.zAdd(QUEUE_KEY, [{ score, value: String(requestId) }]);
    return true;
  } catch (err) {
    logger.error(`Failed to add request ${requestId} to Redis queue: ${err.message}`);
    return false;
  }
}

// Return pending request IDs ordered CRITICAL -> LOW
async function getPendingQueue() {
  if (!isRedisUp()) {
    logger.warn("Redis down — cannot read pending queue");
    return [];
  }
  try {
    // highest score first = highest priority first
    const ids = await redisClient.zRange(QUEUE_KEY, 0, -1, { REV: true });
    return ids.map((id) => parseInt(id, 10));
  } catch (err) {
    logger.error(`Failed to read Redis queue: ${err.message}`);
    return [];
  }
}

async function removeFromQueue(requestId) {
  if (!isRedisUp()) return false;
  try {
    await redisClient.zRem(QUEUE_KEY, String(requestId));
    return true;
  } catch (err) {
    logger.error(`Failed to remove request ${requestId} from Redis queue: ${err.message}`);
    return false;
  }
}

async function getActiveRequestsCache() {
  if (!isRedisUp()) return null;
  try {
    const cached = await redisClient.get(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.error(`Failed to read active_requests cache: ${err.message}`);
    return null;
  }
}

async function setActiveRequestsCache(data) {
  if (!isRedisUp()) return;
  try {
    await redisClient.set(CACHE_KEY, JSON.stringify(data), { EX: CACHE_TTL_SECONDS });
  } catch (err) {
    logger.error(`Failed to set active_requests cache: ${err.message}`);
  }
}

module.exports = {
  addToQueue,
  getPendingQueue,
  removeFromQueue,
  getActiveRequestsCache,
  setActiveRequestsCache,
};
