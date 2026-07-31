const { Server } = require("socket.io");
const logger = require("../utils/logger");

let io = null;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Safe emit — never throws, never crashes the API if sockets are offline
function emitEvent(eventName, payload) {
  try {
    if (io) {
      io.emit(eventName, payload);
      logger.info(`Socket event emitted: ${eventName} -> ${JSON.stringify(payload)}`);
    } else {
      logger.warn(`Socket.IO not initialized, skipped emitting ${eventName}`);
    }
  } catch (err) {
    logger.warn(`Socket emit failed for ${eventName}: ${err.message}`);
  }
}

module.exports = { initSocket, emitEvent };
