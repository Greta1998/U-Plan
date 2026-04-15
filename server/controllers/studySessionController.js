const { getFirebaseAdmin } = require("../config/firebase");

function asDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function round2(num) {
  return Math.round(num * 100) / 100;
}

exports.startSession = async (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["sessionId is required"],
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = db.collection("studySessions").doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Study session not found",
      });
    }

    const session = snap.data();
    if (session.status === "completed") {
      return res.status(409).json({
        success: false,
        error: "Session is already completed",
      });
    }

    // Start/reset live tracking fields each time a planned session is started.
    await ref.update({
      status: "in-progress",
      startTime: admin.firestore.FieldValue.serverTimestamp(),
      endTime: null,
      breakStartTime: null,
      totalBreakTime: 0,
      isOnBreak: false,
      actualDuration: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Session started",
      data: {
        sessionId,
        status: "in-progress",
        isOnBreak: false,
        totalBreakTime: 0,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to start session",
    });
  }
};

exports.startBreak = async (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["sessionId is required"],
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = db.collection("studySessions").doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Study session not found",
      });
    }

    const session = snap.data();
    if (!asDate(session.startTime) || session.status !== "in-progress") {
      return res.status(400).json({
        success: false,
        error: "Cannot start break: session is not in progress",
      });
    }
    if (session.isOnBreak) {
      return res.status(409).json({
        success: false,
        error: "Cannot start break: session is already on break",
      });
    }

    await ref.update({
      breakStartTime: admin.firestore.FieldValue.serverTimestamp(),
      isOnBreak: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Break started",
      data: {
        sessionId,
        status: "in-progress",
        isOnBreak: true,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to start break",
    });
  }
};

exports.endBreak = async (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["sessionId is required"],
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = db.collection("studySessions").doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Study session not found",
      });
    }

    const session = snap.data();
    if (!session.isOnBreak) {
      return res.status(400).json({
        success: false,
        error: "Cannot end break: session is not on break",
      });
    }

    const breakStart = asDate(session.breakStartTime);
    if (!breakStart) {
      return res.status(400).json({
        success: false,
        error: "Cannot end break: break start time is missing",
      });
    }

    const now = new Date();
    const breakDuration = Math.max(0, (now.getTime() - breakStart.getTime()) / (1000 * 60 * 60));
    const totalBreakTime = (Number(session.totalBreakTime) || 0) + breakDuration;

    await ref.update({
      totalBreakTime: round2(totalBreakTime),
      breakStartTime: null,
      isOnBreak: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Break ended",
      data: {
        sessionId,
        status: "in-progress",
        isOnBreak: false,
        totalBreakTime: round2(totalBreakTime),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to end break",
    });
  }
};

exports.endSession = async (req, res) => {
  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["sessionId is required"],
    });
  }

  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const ref = db.collection("studySessions").doc(sessionId);
    const snap = await ref.get();

    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: "Study session not found",
      });
    }

    const session = snap.data();
    const start = asDate(session.startTime);
    if (!start) {
      return res.status(400).json({
        success: false,
        error: "Session has not been started yet",
      });
    }
    if (session.isOnBreak) {
      return res.status(400).json({
        success: false,
        error: "Cannot end session while on break. End break first.",
      });
    }

    const end = new Date();
    const totalTime = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
    const totalBreakTime = Math.max(0, Number(session.totalBreakTime) || 0);
    const actualDuration = Math.max(0, totalTime - totalBreakTime);

    await ref.update({
      status: "completed",
      endTime: admin.firestore.Timestamp.fromDate(end),
      isOnBreak: false,
      breakStartTime: null,
      totalBreakTime: round2(totalBreakTime),
      actualDuration: round2(actualDuration),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      success: true,
      message: "Session completed",
      data: {
        sessionId,
        status: "completed",
        actualDuration: round2(actualDuration),
        totalBreakTime: round2(totalBreakTime),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to end session",
    });
  }
};
