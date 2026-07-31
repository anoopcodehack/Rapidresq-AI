const express = require("express");
const responderController = require("../controllers/responderController");
const emergencyController = require("../controllers/emergencyController");

const router = express.Router();

router.get("/", responderController.listResponders);
router.post("/assign", emergencyController.assignResponderHandler);

module.exports = router;