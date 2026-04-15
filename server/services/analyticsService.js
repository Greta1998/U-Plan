const { getFirebaseAdmin } = require("../config/firebase");

/** Parse Firestore Timestamp, Date, or ISO string to a JS Date. */
function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Round to 2 decimal places for API responses. */
function round2(num) {
  return Math.round(num * 100) / 100;
}

/** Safe division: returns 0 when denominator is 0. */
function safeDiv(numerator, denominator) {
  if (!denominator || denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Short weekday label from a YYYY-MM-DD date string (UTC noon avoids DST edge cases).
 */
function weekdayShortFromDateKey(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const d = new Date(`${dateStr.trim()}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

/**
 * Rule-based burnout + recommendation from performance and behavior signals.
 * Order of checks matters (first match wins).
 */
function evaluateBurnout({
  totalActualHours,
  completionRate,
  consistencyScore,
  maxDailyHours,
}) {
  if (totalActualHours > 30 && consistencyScore > 0.8) {
    return {
      burnoutLevel: "HIGH",
      reason: "Overworking",
      recommendation: "Reduce study hours and take rest days",
    };
  }
  if (completionRate < 0.5) {
    return {
      burnoutLevel: "HIGH",
      reason: "Falling behind",
      recommendation: "Focus on completing planned sessions",
    };
  }
  if (maxDailyHours > 6) {
    return {
      burnoutLevel: "MEDIUM",
      reason: "Uneven workload",
      recommendation: "Distribute study sessions more evenly",
    };
  }
  if (consistencyScore < 0.5) {
    return {
      burnoutLevel: "MEDIUM",
      reason: "Low consistency",
      recommendation: "Try to follow your schedule consistently",
    };
  }
  return {
    burnoutLevel: "LOW",
    reason: "Healthy study pattern",
    recommendation: "Maintain your current study habits",
  };
}

/**
 * Aggregates studySessions for a user: planned vs actual (break-excluded actualDuration),
 * session counts, daily load, break/focus behavior, and burnout snapshot.
 */
async function getAnalyticsSummary(userId) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const sessionsSnap = await db.collection("studySessions").where("userId", "==", userId).get();

  if (sessionsSnap.empty) {
    return {
      totalPlannedHours: 0,
      totalActualHours: 0,
      completionRate: 0,
      totalSessions: 0,
      completedSessions: 0,
      missedSessions: 0,
      consistencyScore: 0,
      avgSessionLength: 0,
      avgBreakTime: 0,
      focusScore: 0,
      dailyLoadByWeekday: {},
      maxDailyHours: 0,
      minDailyHours: 0,
      burnoutLevel: "LOW",
      reason: "No sessions recorded",
      recommendation: "Add or complete study sessions to see insights",
    };
  }

  let totalPlannedHours = 0;
  let totalActualHours = 0;
  let totalSessions = 0;
  let completedSessions = 0;
  /** Sum of totalBreakTime (hours) on completed sessions only — used for avg break + focus. */
  let sumBreakTimeCompleted = 0;
  /** Map weekday short label → sum of actual study hours that day (completed sessions). */
  const dailyLoadByWeekday = {};

  sessionsSnap.forEach((doc) => {
    totalSessions += 1;
    const s = doc.data();

    // Planned time applies to every scheduled session row.
    totalPlannedHours += Number(s.plannedDuration) || 0;

    // Actual time is only meaningful once a session is completed (actualDuration already excludes breaks).
    if (s.status === "completed") {
      completedSessions += 1;

      let actualHours = 0;
      if (Number.isFinite(Number(s.actualDuration))) {
        actualHours = Number(s.actualDuration);
      } else {
        // Legacy: derive net study time from timestamps if actualDuration was not stored.
        const start = toDate(s.startTime);
        const end = toDate(s.endTime);
        if (start && end && end >= start) {
          const gross = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          const breaks = Number(s.totalBreakTime) || 0;
          actualHours = Math.max(0, gross - breaks);
        }
      }

      totalActualHours += actualHours;

      const bt = Number(s.totalBreakTime) || 0;
      sumBreakTimeCompleted += bt;

      const dayKey =
        s.date || (toDate(s.startTime) ? toDate(s.startTime).toISOString().slice(0, 10) : null);
      const wk = weekdayShortFromDateKey(dayKey);
      if (wk) {
        dailyLoadByWeekday[wk] = (dailyLoadByWeekday[wk] || 0) + actualHours;
      }
    }
  });

  const missedSessions = totalSessions - completedSessions;

  const completionRate = safeDiv(totalActualHours, totalPlannedHours);
  const consistencyScore = safeDiv(completedSessions, totalSessions);
  const avgSessionLength = safeDiv(totalActualHours, completedSessions);
  const avgBreakTime = safeDiv(sumBreakTimeCompleted, completedSessions);

  const denomFocus = totalActualHours + sumBreakTimeCompleted;
  const focusScore = safeDiv(totalActualHours, denomFocus);

  const dailyValues = Object.values(dailyLoadByWeekday);
  let maxDailyHours = 0;
  let minDailyHours = 0;
  if (dailyValues.length > 0) {
    maxDailyHours = Math.max(...dailyValues);
    minDailyHours = Math.min(...dailyValues);
  }

  const burnout = evaluateBurnout({
    totalActualHours,
    completionRate,
    consistencyScore,
    maxDailyHours,
  });

  return {
    totalPlannedHours: round2(totalPlannedHours),
    totalActualHours: round2(totalActualHours),
    completionRate: round2(completionRate),
    totalSessions,
    completedSessions,
    missedSessions,
    consistencyScore: round2(consistencyScore),
    avgSessionLength: round2(avgSessionLength),
    avgBreakTime: round2(avgBreakTime),
    focusScore: round2(focusScore),
    dailyLoadByWeekday: Object.fromEntries(
      Object.entries(dailyLoadByWeekday).map(([k, v]) => [k, round2(v)])
    ),
    maxDailyHours: round2(maxDailyHours),
    minDailyHours: round2(minDailyHours),
    burnoutLevel: burnout.burnoutLevel,
    reason: burnout.reason,
    recommendation: burnout.recommendation,
  };
}

module.exports = {
  getAnalyticsSummary,
};
