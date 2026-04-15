const express = require("express");
const router = express.Router();
const studySessionController = require("../controllers/studySessionController");

router.post("/start", studySessionController.startSession);
router.post("/break/start", studySessionController.startBreak);
router.post("/break/end", studySessionController.endBreak);
router.post("/end", studySessionController.endSession);

module.exports = router;
