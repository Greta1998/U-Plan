const { getFirebaseAdmin } = require("../config/firebase");

function validateCreateCourse(body) {
  const errors = [];
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const courseName = typeof body.courseName === "string" ? body.courseName.trim() : "";
  const creditUnits = Number(body.creditUnits);

  if (!userId) errors.push("userId is required");
  if (!courseName) errors.push("courseName is required");
  if (!Number.isFinite(creditUnits) || creditUnits <= 0) {
    errors.push("creditUnits must be a positive number");
  }

  return { errors, userId, courseName, creditUnits };
}

exports.createCourse = async (req, res) => {
  const { errors, userId, courseName, creditUnits } = validateCreateCourse(req.body || {});
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
    const docRef = await db.collection("courses").add({
      userId,
      courseName,
      creditUnits,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(201).json({
      success: true,
      data: {
        courseId: docRef.id,
        userId,
        courseName,
        creditUnits,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to create course",
    });
  }
};

exports.getCoursesByUser = async (req, res) => {
  const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "userId is required",
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const snapshot = await db.collection("courses").where("userId", "==", userId).get();
    const courses = snapshot.docs.map((doc) => ({ courseId: doc.id, ...doc.data() }));

    return res.status(200).json({
      success: true,
      data: courses,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch courses",
    });
  }
};

exports.deleteCourse = async (req, res) => {
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
    const courseRef = db.collection("courses").doc(courseId);
    const courseDoc = await courseRef.get();

    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: "Course not found",
      });
    }

    await courseRef.delete();
    return res.status(200).json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to delete course",
    });
  }
};
