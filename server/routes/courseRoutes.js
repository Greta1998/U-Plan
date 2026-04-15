const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");

router.post("/", courseController.createCourse);
router.get("/:userId", courseController.getCoursesByUser);
router.delete("/:courseId", courseController.deleteCourse);

module.exports = router;
