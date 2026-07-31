const logger = require("../utils/logger");

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  logger.error(`${req.method} ${req.originalUrl} -> ${err.message}`);

  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
    data: null,
  });
}

module.exports = errorHandler;
