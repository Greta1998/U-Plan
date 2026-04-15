const express = require("express");
const router = express.Router();
const assignmentController = require("../controllers/assignmentController");

router.post("/", assignmentController.createAssignment);
router.get("/:courseId", assignmentController.getAssignmentsByCourse);
router.put("/:assignmentId", assignmentController.markAssignmentCompleted);

module.exports = router;
