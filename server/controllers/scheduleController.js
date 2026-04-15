const scheduleService = require("../services/scheduleService");

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
    const { groupedByDay, createdSessions } = await scheduleService.generateScheduleForUser(userId);
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
