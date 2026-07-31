const express = require("express");
const { body } = require("express-validator");
const validate = require("../middlewares/validate");
const controller = require("../controllers/emergencyController");

const router = express.Router();

// 1. Create Emergency Request
router.post(
  "/",
  [
    body("user_id").isInt({ min: 1 }).withMessage("user_id must be a positive integer"),
    body("location").trim().notEmpty().withMessage("location is required"),
    body("latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("latitude must be between -90 and 90"),
    body("longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("longitude must be between -180 and 180"),
    body("description")
      .trim()
      .notEmpty()
      .withMessage("description is required")
      .isLength({ min: 5, max: 500 })
      .withMessage("description must be between 5 and 500 characters"),
  ],
  validate,
  controller.createRequest
);

// 2. Get Pending Requests
router.get("/pending", controller.getPendingRequests);

// 3. Assign Responder
router.post(
  "/assign",
  [
    body("request_id").isInt().withMessage("request_id must be an integer"),
    body("responder_id").isInt().withMessage("responder_id must be an integer"),
  ],
  validate,
  controller.assignResponderHandler
);

// 4. Update Request Status
router.patch(
  "/status",
  [
    body("request_id").isInt().withMessage("request_id must be an integer"),
    body("status")
      .isIn(["PENDING", "ASSIGNED", "ON_THE_WAY", "RESOLVED"])
      .withMessage("Invalid status value"),
  ],
  validate,
  controller.updateStatus
);

// 5. Get Active Requests
router.get("/active", controller.getActiveRequests);

// 6. Dispatch Notification
router.post(
  "/notify",
  [body("request_id").isInt().withMessage("request_id must be an integer")],
  validate,
  controller.dispatchNotification
);

// 7. AI Priority Classification
router.post(
  "/classify",
  [body("description").notEmpty().withMessage("description is required")],
  validate,
  controller.classifyEndpoint
);

module.exports = router;
