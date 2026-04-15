const { getFirebaseAdmin } = require("../config/firebase");

const ALLOWED_PRIORITY = new Set(["low", "medium", "high"]);
const ALLOWED_STATUS = new Set(["pending", "completed"]);

function validateCreateAssignment(body) {
  const errors = [];
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const deadline = typeof body.deadline === "string" ? body.deadline.trim() : "";
  const priority = typeof body.priority === "string" ? body.priority.trim().toLowerCase() : "";
  const status = typeof body.status === "string" ? body.status.trim().toLowerCase() : "";

  if (!courseId) errors.push("courseId is required");
  if (!title) errors.push("title is required");
  if (!deadline) errors.push("deadline is required");
  else if (Number.isNaN(Date.parse(deadline))) errors.push("deadline must be a valid ISO date string");
  if (!ALLOWED_PRIORITY.has(priority)) errors.push("priority must be one of: low, medium, high");
  if (!ALLOWED_STATUS.has(status)) errors.push("status must be one of: pending, completed");

  return { errors, courseId, title, deadline, priority, status };
}

exports.createAssignment = async (req, res) => {
  const { errors, courseId, title, deadline, priority, status } = validateCreateAssignment(req.body || {});
  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors,
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const courseDoc = await db.collection("courses").doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    const docRef = await db.collection("assignments").add({
      courseId,
      title,
      deadline,
      priority,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      data: {
        assignmentId: docRef.id,
        courseId,
        title,
        deadline,
        priority,
        status,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to create assignment",
    });
  }
};

exports.getAssignmentsByCourse = async (req, res) => {
  const courseId = typeof req.params.courseId === "string" ? req.params.courseId.trim() : "";
  if (!courseId) {
    return res.status(400).json({
      success: false,
      error: "courseId is required",
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const snapshot = await db.collection("assignments").where("courseId", "==", courseId).get();
    const assignments = snapshot.docs.map((doc) => ({ assignmentId: doc.id, ...doc.data() }));

    return res.status(200).json({
      success: true,
      data: assignments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch assignments",
    });
  }
};

exports.markAssignmentCompleted = async (req, res) => {
  const assignmentId = typeof req.params.assignmentId === "string" ? req.params.assignmentId.trim() : "";
  if (!assignmentId) {
    return res.status(400).json({
      success: false,
      error: "assignmentId is required",
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const assignmentRef = db.collection("assignments").doc(assignmentId);
    const assignmentDoc = await assignmentRef.get();

    if (!assignmentDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Assignment not found",
      });
    }

    await assignmentRef.update({
      status: "completed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Assignment marked as completed",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update assignment",
    });
  }
};
