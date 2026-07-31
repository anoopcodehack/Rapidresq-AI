const express = require("express");
const controller = require("../controllers/responderController");

const router = express.Router();

router.get("/", controller.listResponders);

module.exports = router;
