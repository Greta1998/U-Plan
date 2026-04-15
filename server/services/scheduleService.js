const { getFirebaseAdmin } = require("../config/firebase");

const PRIORITY_HOURS = {
  high: 3,
  medium: 2,
  low: 1,
};

const MAX_HOURS_PER_DAY = 4;
const HORIZON_DAYS = 7;
const SESSION_HOURS = 2;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function getDayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function normalizePriority(priority) {
  const p = (priority || "").toLowerCase();
  return PRIORITY_HOURS[p] ? p : "low";
}

async function fetchPendingAssignmentsForUser(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  // Assignments do not store userId directly in current schema,
  // so we first fetch user's courses, then load assignments by courseId.
  const coursesSnap = await db.collection("courses").where("userId", "==", userId).get();
  if (coursesSnap.empty) return [];

  const courseIds = coursesSnap.docs.map((doc) => doc.id);
  const pendingAssignments = [];

  // Firestore "in" queries are limited; chunk requests for safety.
  const chunkSize = 10;
  for (let i = 0; i < courseIds.length; i += chunkSize) {
    const chunk = courseIds.slice(i, i + chunkSize);
    const assignmentSnap = await db
      .collection("assignments")
      .where("courseId", "in", chunk)
      .where("status", "==", "pending")
      .get();

    assignmentSnap.forEach((doc) => {
      const data = doc.data();
      pendingAssignments.push({
        assignmentId: doc.id,
        courseId: data.courseId,
        title: data.title,
        deadline: data.deadline,
        priority: normalizePriority(data.priority),
      });
    });
  }

  pendingAssignments.sort((a, b) => {
    const aTime = Date.parse(a.deadline) || Number.MAX_SAFE_INTEGER;
    const bTime = Date.parse(b.deadline) || Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  return pendingAssignments;
}

function buildWeekWindow() {
  const today = startOfDay(new Date());
  const days = [];
  let offset = 0;
  while (days.length < HORIZON_DAYS) {
    const date = addDays(today, offset);
    offset += 1;
    if (date.getDay() === 0) continue; // Leave out Sundays.
    days.push({
      index: days.length,
      date,
      dateKey: formatDateKey(date),
      dayName: getDayName(date),
      totalHours: 0,
    });
  }
  return days;
}

function selectBestDay(days, deadline) {
  const deadlineDate = Date.parse(deadline);
  const validDeadline = Number.isFinite(deadlineDate);

  const eligible = days.filter((day) => {
    if (day.totalHours >= MAX_HOURS_PER_DAY) return false;
    if (!validDeadline) return true;
    return day.date.getTime() <= startOfDay(new Date(deadlineDate)).getTime();
  });

  const pool = eligible.length ? eligible : days;
  pool.sort((a, b) => {
    if (a.totalHours !== b.totalHours) return a.totalHours - b.totalHours;
    return a.index - b.index;
  });
  return pool[0];
}

async function generateScheduleForUser(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const pendingAssignments = await fetchPendingAssignmentsForUser(userId);
  const week = buildWeekWindow();
  const sessionsToCreate = [];

  // Rule-based scheduling:
  // 1) Earlier deadlines scheduled first.
  // 2) Priority maps to target hours (high=3, medium=2, low=1).
  // 3) Split into 2-hour chunks to spread work evenly and respect daily cap.
  for (const assignment of pendingAssignments) {
    let hoursLeft = PRIORITY_HOURS[assignment.priority];
    while (hoursLeft > 0) {
      const day = selectBestDay(week, assignment.deadline);
      const availableToday = MAX_HOURS_PER_DAY - day.totalHours;
      if (availableToday <= 0) break;
      const chunkHours = Math.min(SESSION_HOURS, hoursLeft, availableToday);

      day.totalHours += chunkHours;
      hoursLeft -= chunkHours;

      sessionsToCreate.push({
        userId,
        assignmentId: assignment.assignmentId,
        plannedDuration: chunkHours,
        date: day.dateKey,
        dayName: day.dayName,
        status: "planned",
      });
    }
  }

  if (!sessionsToCreate.length) {
    return {
      groupedByDay: {},
      createdSessions: [],
    };
  }

  const batch = db.batch();
  const collection = db.collection("studySessions");

  sessionsToCreate.forEach((session) => {
    const ref = collection.doc();
    batch.set(ref, {
      userId: session.userId,
      assignmentId: session.assignmentId,
      plannedDuration: session.plannedDuration,
      date: session.date,
      status: session.status,
      startTime: null,
      endTime: null,
      breakStartTime: null,
      totalBreakTime: 0,
      isOnBreak: false,
      actualDuration: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    session.sessionId = ref.id;
  });

  await batch.commit();

  const groupedByDay = {};
  sessionsToCreate.forEach((session) => {
    const key = session.date; // Group by exact date key: YYYY-MM-DD
    if (!groupedByDay[key]) groupedByDay[key] = [];
    groupedByDay[key].push({
      sessionId: session.sessionId,
      assignmentId: session.assignmentId,
      plannedDuration: session.plannedDuration,
      date: session.date,
      status: session.status,
    });
  });

  return {
    groupedByDay,
    createdSessions: sessionsToCreate,
  };
}

module.exports = {
  generateScheduleForUser,
};
