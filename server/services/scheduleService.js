const { getFirebaseAdmin } = require("../config/firebase");

const PRIORITY_HOURS = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Max study session rows per calendar day */
const MAX_SESSIONS_PER_DAY = 2;
/** Max total planned hours per day (e.g. two 2h blocks) */
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

/** Local calendar date key (avoid UTC drift from toISOString) */
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

  const coursesSnap = await db.collection("courses").where("userId", "==", userId).get();
  if (coursesSnap.empty) return [];

  const courseIds = coursesSnap.docs.map((doc) => doc.id);
  const pendingAssignments = [];

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

/**
 * Assignments that already have at least one planned or in-progress study session
 * are skipped on generate (no duplicate planning for the same assignment).
 */
async function fetchAssignmentIdsWithActiveSessions(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const snap = await db.collection("studySessions").where("userId", "==", userId).get();
  const ids = new Set();
  snap.forEach((doc) => {
    const s = doc.data();
    if (s.status === "planned" || s.status === "in-progress") {
      if (s.assignmentId) ids.add(s.assignmentId);
    }
  });
  return ids;
}

function buildWeekWindow() {
  const today = startOfDay(new Date());
  const days = [];
  let offset = 0;
  while (days.length < HORIZON_DAYS) {
    const date = addDays(today, offset);
    offset += 1;
    if (date.getDay() === 0) continue;
    days.push({
      index: days.length,
      date,
      dateKey: formatDateKey(date),
      dayName: getDayName(date),
      totalHours: 0,
      sessionCount: 0,
      assignmentsToday: new Set(),
    });
  }
  return days;
}

/**
 * Merge existing planned/in-progress sessions in the horizon into day caps
 * so new sessions don't exceed max sessions/hours per day.
 */
async function loadExistingWeekStateIntoDays(userId, days) {
  const dateKeys = new Set(days.map((d) => d.dateKey));
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const snap = await db.collection("studySessions").where("userId", "==", userId).get();

  snap.forEach((doc) => {
    const s = doc.data();
    if (s.status !== "planned" && s.status !== "in-progress") return;
    const key = s.date;
    if (!key || typeof key !== "string" || !dateKeys.has(key)) return;
    const day = days.find((d) => d.dateKey === key);
    if (!day) return;
    day.sessionCount += 1;
    day.totalHours += Number(s.plannedDuration) || 0;
    if (s.assignmentId) day.assignmentsToday.add(s.assignmentId);
  });
}

function selectBestDay(days, deadline, assignmentId) {
  const deadlineDate = Date.parse(deadline);
  const validDeadline = Number.isFinite(deadlineDate);

  const eligible = days.filter((day) => {
    if (day.sessionCount >= MAX_SESSIONS_PER_DAY) return false;
    if (day.assignmentsToday.has(assignmentId)) return false;
    if (day.totalHours >= MAX_HOURS_PER_DAY) return false;
    if (!validDeadline) return true;
    return day.date.getTime() <= startOfDay(new Date(deadlineDate)).getTime();
  });

  const pool = eligible.length ? eligible : [];
  if (!pool.length) return null;

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
  const alreadyScheduled = await fetchAssignmentIdsWithActiveSessions(userId);
  const week = buildWeekWindow();
  await loadExistingWeekStateIntoDays(userId, week);

  const sessionsToCreate = [];

  for (const assignment of pendingAssignments) {
    if (alreadyScheduled.has(assignment.assignmentId)) {
      continue;
    }

    let hoursLeft = PRIORITY_HOURS[assignment.priority];
    while (hoursLeft > 0) {
      const day = selectBestDay(week, assignment.deadline, assignment.assignmentId);
      if (!day) break;

      const availableHours = MAX_HOURS_PER_DAY - day.totalHours;
      if (availableHours <= 0) break;

      const chunkHours = Math.min(SESSION_HOURS, hoursLeft, availableHours);
      if (chunkHours <= 0) break;

      day.totalHours += chunkHours;
      day.sessionCount += 1;
      day.assignmentsToday.add(assignment.assignmentId);
      hoursLeft -= chunkHours;

      sessionsToCreate.push({
        userId,
        assignmentId: assignment.assignmentId,
        assignmentTitle: assignment.title || "Study session",
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
    const key = session.date;
    if (!groupedByDay[key]) groupedByDay[key] = [];
    groupedByDay[key].push({
      sessionId: session.sessionId,
      assignmentId: session.assignmentId,
      assignmentTitle: session.assignmentTitle,
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

/**
 * Loads all study sessions for a user from Firestore, grouped by date (YYYY-MM-DD),
 * with assignment titles resolved from the assignments collection.
 */
async function getScheduleGroupedByUser(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const snap = await db.collection("studySessions").where("userId", "==", userId).get();

  if (snap.empty) {
    return {};
  }

  const sessions = snap.docs.map((doc) => ({ sessionId: doc.id, ...doc.data() }));
  const assignmentIds = [...new Set(sessions.map((s) => s.assignmentId).filter(Boolean))];

  const titleMap = {};
  const chunkSize = 10;
  for (let i = 0; i < assignmentIds.length; i += chunkSize) {
    const chunk = assignmentIds.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection("assignments").doc(id));
    const docs = await db.getAll(...refs);
    docs.forEach((d) => {
      if (d.exists) titleMap[d.id] = d.data().title;
    });
  }

  const groupedByDay = {};
  sessions.forEach((s) => {
    const key = s.date;
    if (!key || typeof key !== "string") return;
    if (!groupedByDay[key]) groupedByDay[key] = [];
    groupedByDay[key].push({
      sessionId: s.sessionId,
      assignmentId: s.assignmentId,
      assignmentTitle: titleMap[s.assignmentId] || "Study session",
      plannedDuration: s.plannedDuration,
      date: s.date,
      status: s.status,
    });
  });

  Object.keys(groupedByDay).forEach((k) => {
    groupedByDay[k].sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
  });

  return groupedByDay;
}

module.exports = {
  generateScheduleForUser,
  getScheduleGroupedByUser,
};
