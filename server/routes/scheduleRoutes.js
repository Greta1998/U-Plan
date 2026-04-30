const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");

router.get("/user/:userId", scheduleController.getSchedule);
router.post("/generate", scheduleController.generateSchedule);

module.exports = router;
