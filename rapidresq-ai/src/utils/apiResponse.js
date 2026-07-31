// Standardized response shape across every endpoint: { success, message, data }
function success(res, statusCode, message, data = null) {
  return res.status(statusCode).json({ success: true, message, data });
}

function failure(res, statusCode, message) {
  return res.status(statusCode).json({ success: false, message, data: null });
}

module.exports = { success, failure };
