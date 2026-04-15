const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");

router.get("/:userId", analyticsController.getAnalytics);

module.exports = router;
