const { getFirebaseAdmin } = require("../config/firebase");

/** Round to 2 decimal places for API responses. */
function round2(num) {
  return Math.round(num * 100) / 100;
}

/** Safe division: returns 0 when denominator is 0. */
function safeDiv(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

function normalizeAssignmentStatus(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (s === "completed") return "completed";
  if (s === "in_progress") return "in_progress";
  return "pending";
}

/**
 * Workload / progress insight from assignment counts only (no study sessions).
 */
function evaluateAssignmentInsight({
  totalAssignments,
  completedAssignments,
  pendingAssignments,
  inProgressAssignments,
}) {
  if (totalAssignments === 0) {
    return {
      workloadLevel: "LOW",
      reason: "No assignments yet",
      recommendation: "Add courses and create assignments to track your work here.",
    };
  }

  const completionRate = safeDiv(completedAssignments, totalAssignments);

  if (pendingAssignments >= 8 && completionRate < 0.25) {
    return {
      workloadLevel: "HIGH",
      reason: "Large pending backlog",
      recommendation: "Prioritize by due date and tackle one assignment at a time.",
    };
  }

  if (completionRate >= 0.75) {
    return {
      workloadLevel: "LOW",
      reason: "Strong completion rate",
      recommendation: "Keep updating statuses as you finish work.",
    };
  }

  if (inProgressAssignments >= 4 && pendingAssignments >= 3) {
    return {
      workloadLevel: "MEDIUM",
      reason: "Many items active at once",
      recommendation: "Consider finishing in-progress tasks before adding new ones.",
    };
  }

  if (completionRate < 0.35 && pendingAssignments > 0) {
    return {
      workloadLevel: "HIGH",
      reason: "Most work still open",
      recommendation: "Break large assignments into steps and mark progress in Assignments.",
    };
  }

  return {
    workloadLevel: "MEDIUM",
    reason: "Steady workload",
    recommendation: "Use the Assignments page to keep statuses up to date.",
  };
}

/**
 * Dashboard analytics: courses + assignments only (completed / pending / in progress).
 */
async function getAnalyticsSummary(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const coursesSnap = await db.collection("courses").where("userId", "==", userId).get();
  const courseCount = coursesSnap.size;
  const courseIds = coursesSnap.docs.map((doc) => doc.id);

  if (courseIds.length === 0) {
    return {
      courseCount: 0,
      totalAssignments: 0,
      completedAssignments: 0,
      pendingAssignments: 0,
      inProgressAssignments: 0,
      assignmentCompletionRate: 0,
      workloadLevel: "LOW",
      reason: "No courses yet",
      recommendation: "Add a course, then create assignments.",
    };
  }

  let totalAssignments = 0;
  let completedAssignments = 0;
  let pendingAssignments = 0;
  let inProgressAssignments = 0;
  const chunkSize = 10;

  for (let i = 0; i < courseIds.length; i += chunkSize) {
    const chunk = courseIds.slice(i, i + chunkSize);
    const snap = await db.collection("assignments").where("courseId", "in", chunk).get();
    snap.forEach((doc) => {
      totalAssignments += 1;
      const st = normalizeAssignmentStatus(doc.data().status);
      if (st === "completed") completedAssignments += 1;
      else if (st === "in_progress") inProgressAssignments += 1;
      else pendingAssignments += 1;
    });
  }

  const assignmentCompletionRate = round2(safeDiv(completedAssignments, totalAssignments));
  const insight = evaluateAssignmentInsight({
    totalAssignments,
    completedAssignments,
    pendingAssignments,
    inProgressAssignments,
  });

  return {
    courseCount,
    totalAssignments,
    completedAssignments,
    pendingAssignments,
    inProgressAssignments,
    assignmentCompletionRate,
    workloadLevel: insight.workloadLevel,
    reason: insight.reason,
    recommendation: insight.recommendation,
  };
}

module.exports = {
  getAnalyticsSummary,
};
