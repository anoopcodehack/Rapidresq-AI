const { PrismaClient } = require("@prisma/client");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

async function connectDB() {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected via Prisma");
  } catch (err) {
    logger.error(`PostgreSQL connection failed: ${err.message}`);
    throw err;
  }
}

module.exports = { prisma, connectDB };
