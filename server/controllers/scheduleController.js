const scheduleService = require("../services/scheduleService");

exports.getSchedule = async (req, res) => {
  const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["userId is required"],
    });
  }

  try {
    const groupedByDay = await scheduleService.getScheduleGroupedByUser(userId);
    return res.status(200).json({
      success: true,
      data: groupedByDay,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load schedule",
    });
  }
};

exports.generateSchedule = async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: ["userId is required"],
    });
  }

  try {
    const { createdSessions } = await scheduleService.generateScheduleForUser(userId);
    const groupedByDay = await scheduleService.getScheduleGroupedByUser(userId);
    return res.status(200).json({
      success: true,
      data: groupedByDay,
      meta: {
        generatedCount: createdSessions.length,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to generate schedule",
    });
  }
};
