const express = require("express");
const router = express.Router();
const scheduleController = require("../controllers/scheduleController");

router.post("/generate", scheduleController.generateSchedule);

module.exports = router;
