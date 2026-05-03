import { assignmentsApi, coursesApi } from "./api";

/**
 * Sidebar badge counts aligned with Notifications "unread" rules (due / overdue).
 */
export async function fetchNavBadgeCounts(userId) {
  const cRes = await coursesApi.list(userId);
  const courseList = Array.isArray(cRes.data) ? cRes.data : [];
  let pendingAssignments = 0;
  let notificationUnread = 0;
  const now = Date.now();
  const twoDays = 2 * 24 * 60 * 60 * 1000;

  for (const course of courseList) {
    const aRes = await assignmentsApi.byCourse(course.courseId);
    const assignments = Array.isArray(aRes.data) ? aRes.data : [];
    for (const assignment of assignments) {
      const status = String(assignment.status || "pending").toLowerCase();
      if (status === "completed") continue;
      pendingAssignments += 1;
      const dueTs = Date.parse(assignment.deadline);
      if (!Number.isFinite(dueTs)) continue;
      if (dueTs < now || dueTs - now <= twoDays) {
        notificationUnread += 1;
      }
    }
  }

  return { pendingAssignments, notificationUnread };
}
