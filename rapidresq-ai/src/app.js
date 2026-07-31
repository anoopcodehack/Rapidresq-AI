const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");
const errorHandler = require("./middlewares/errorHandler");
const emergencyRoutes = require("./routes/emergencyRoutes");
const responderRoutes = require("./routes/responderRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "RapidResQ AI backend is running" });
});

app.use("/api/emergency", emergencyRoutes);
app.use("/api/responders", responderRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
