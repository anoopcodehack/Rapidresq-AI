const { prisma } = require("../config/db");
const { success } = require("../utils/apiResponse");

async function listResponders(req, res, next) {
  try {
    const responders = await prisma.responder.findMany();
    return success(res, 200, "Responders retrieved", responders);
  } catch (err) {
    next(err);
  }
}

module.exports = { listResponders };