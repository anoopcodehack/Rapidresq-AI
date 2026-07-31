const { prisma } = require("../config/db");
const { redisClient, isRedisUp } = require("../config/redis");
const { removeFromQueue } = require("./queueService");
const { emitEvent } = require("../config/socket");
const logger = require("../utils/logger");

const LOCK_TTL_SECONDS = 30;

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.status = 404;
  }
}

async function acquireResponderLock(responderId) {
  if (!isRedisUp()) return true; // degrade gracefully if Redis is down
  const lockKey = `lock:responder:${responderId}`;
  const acquired = await redisClient.set(lockKey, "1", { NX: true, EX: LOCK_TTL_SECONDS });
  return acquired === "OK";
}

async function releaseResponderLock(responderId) {
  if (!isRedisUp()) return;
  await redisClient.del(`lock:responder:${responderId}`);
}

async function assignResponder(requestId, responderId) {
  const locked = await acquireResponderLock(responderId);
  if (!locked) {
    throw new ConflictError("Responder is currently being assigned to another request");
  }

  try {
    const request = await prisma.emergencyRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new NotFoundError("Emergency request not found");
    if (request.status === "RESOLVED") throw new ConflictError("Request already resolved, cannot assign");
    if (request.assignedResponderId) throw new ConflictError("Request already assigned to a responder");

    const responder = await prisma.responder.findUnique({ where: { id: responderId } });
    if (!responder) throw new NotFoundError("Responder not found");
    if (responder.status === "BUSY") throw new ConflictError("Responder is currently busy");

    const [updatedRequest] = await prisma.$transaction([
      prisma.emergencyRequest.update({
        where: { id: requestId },
        data: { assignedResponderId: responderId, status: "ASSIGNED" },
      }),
      prisma.responder.update({
        where: { id: responderId },
        data: { status: "BUSY" },
      }),
      prisma.dispatchHistory.create({
        data: { requestId, responderId },
      }),
    ]);

    await removeFromQueue(requestId);

    emitEvent("dispatch_assigned", {
      requestId,
      responderId,
      message: "Emergency assigned to responder",
    });

    logger.info(`Request #${requestId} assigned to Responder #${responderId}`);
    return updatedRequest;
  } finally {
    await releaseResponderLock(responderId);
  }
}

module.exports = { assignResponder, ConflictError, NotFoundError };
