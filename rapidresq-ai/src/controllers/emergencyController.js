const { prisma } = require("../config/db");
const { classifyPriority } = require("../services/aiService");
const {
  addToQueue,
  getPendingQueue,
  getActiveRequestsCache,
  setActiveRequestsCache,
} = require("../services/queueService");
const { assignResponder } = require("../services/dispatchService");
const { emitEvent } = require("../config/socket");
const logger = require("../utils/logger");
const { success } = require("../utils/apiResponse");

const DUPLICATE_WINDOW_SECONDS = 60;

// Checks for a recent, unresolved request from the same user at the same
// location with the same description. Keeps it simple (no PostGIS): exact
// location + description match within a 60-second window — enough to catch
// panic re-submits without needing geo-distance math.
async function findRecentDuplicate(userId, location, description) {
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_SECONDS * 1000);
  return prisma.emergencyRequest.findFirst({
    where: {
      userId,
      location,
      description,
      createdAt: { gte: windowStart },
      status: { not: "RESOLVED" },
    },
    orderBy: { createdAt: "desc" },
  });
}

// 1. Create Emergency Request
async function createRequest(req, res, next) {
  try {
    const { user_id, location, latitude, longitude, description } = req.body;

    const user = await prisma.user.findUnique({ where: { id: user_id } });
    if (!user) {
      const err = new Error("Invalid user_id");
      err.status = 404;
      throw err;
    }

    logger.info(`Incoming emergency request from user #${user_id}: "${description}"`);

    const duplicate = await findRecentDuplicate(user_id, location, description);
    if (duplicate) {
      logger.warn(
        `Duplicate emergency request rejected for user #${user_id} at "${location}" (existing request #${duplicate.id})`
      );
      const err = new Error("Duplicate Emergency Request");
      err.status = 409;
      throw err;
    }

    const { priority, source } = await classifyPriority(description);

    const request = await prisma.emergencyRequest.create({
      data: {
        userId: user_id,
        location,
        latitude,
        longitude,
        description,
        priority,
      },
    });

    await addToQueue(request.id, priority);

    emitEvent("status_updated", {
      requestId: request.id,
      status: request.status,
      priority,
    });

    logger.info(`Request #${request.id} created — priority ${priority} (source: ${source})`);

    return success(res, 201, "Emergency request created", {
      ...request,
      prioritySource: source,
    });
  } catch (err) {
    next(err);
  }
}

// 2. Get Pending Requests (Redis, priority order)
async function getPendingRequests(req, res, next) {
  try {
    const ids = await getPendingQueue();
    if (ids.length === 0) {
      return success(res, 200, "No pending requests", []);
    }
    const requests = await prisma.emergencyRequest.findMany({
      where: { id: { in: ids } },
    });
    const ordered = ids
      .map((id) => requests.find((r) => r.id === id))
      .filter(Boolean);

    return success(res, 200, "Pending requests retrieved", ordered);
  } catch (err) {
    next(err);
  }
}

// 3. Assign Responder
async function assignResponderHandler(req, res, next) {
  try {
    const { request_id, responder_id } = req.body;
    const updated = await assignResponder(request_id, responder_id);
    return success(res, 200, "Responder assigned successfully", updated);
  } catch (err) {
    next(err);
  }
}

// 4. Update Request Status
async function updateStatus(req, res, next) {
  try {
    const { request_id, status } = req.body;

    const request = await prisma.emergencyRequest.findUnique({ where: { id: request_id } });
    if (!request) {
      const err = new Error("Emergency request not found");
      err.status = 404;
      throw err;
    }
    if (request.status === "RESOLVED") {
      const err = new Error("Request already resolved, cannot update");
      err.status = 400;
      throw err;
    }

    const updated = await prisma.emergencyRequest.update({
      where: { id: request_id },
      data: { status },
    });

    if (status === "RESOLVED" && request.assignedResponderId) {
      await prisma.responder.update({
        where: { id: request.assignedResponderId },
        data: { status: "AVAILABLE" },
      });
      await prisma.dispatchHistory.updateMany({
        where: { requestId: request_id, completedTime: null },
        data: { completedTime: new Date() },
      });
    }

    emitEvent("status_updated", { requestId: request_id, status });
    logger.info(`Request #${request_id} status updated -> ${status}`);

    return success(res, 200, "Status updated successfully", updated);
  } catch (err) {
    next(err);
  }
}

// 5. Get Active Requests (cache-aside)
async function getActiveRequests(req, res, next) {
  try {
    const cached = await getActiveRequestsCache();
    if (cached) {
      return success(res, 200, "Active requests retrieved (cache)", cached);
    }

    const active = await prisma.emergencyRequest.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
    });

    await setActiveRequestsCache(active);
    return success(res, 200, "Active requests retrieved (db)", active);
  } catch (err) {
    next(err);
  }
}

// 6. Dispatch Notification (manual trigger / demo helper)
async function dispatchNotification(req, res, next) {
  try {
    const { request_id } = req.body;
    const request = await prisma.emergencyRequest.findUnique({ where: { id: request_id } });
    if (!request) {
      const err = new Error("Emergency request not found");
      err.status = 404;
      throw err;
    }
    emitEvent("dispatch_assigned", {
      requestId: request_id,
      responderId: request.assignedResponderId,
      message: "Emergency assigned to responder",
    });
    return success(res, 200, "Notification emitted", null);
  } catch (err) {
    next(err);
  }
}

// 7. AI Priority Classification (standalone endpoint)
async function classifyEndpoint(req, res, next) {
  try {
    const { description } = req.body;
    const result = await classifyPriority(description);
    return success(res, 200, "Priority classified", result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createRequest,
  getPendingRequests,
  assignResponderHandler,
  updateStatus,
  getActiveRequests,
  dispatchNotification,
  classifyEndpoint,
};
