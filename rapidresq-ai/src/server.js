require("dotenv").config();
const http = require("http");
const app = require("./app");
const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { initSocket } = require("./config/socket");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await connectRedis();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    logger.info(`RapidResQ AI backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
