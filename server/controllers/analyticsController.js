const analyticsService = require("../services/analyticsService");

exports.getAnalytics = async (req, res) => {
  const userId = typeof req.params.userId === "string" ? req.params.userId.trim() : "";
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: "userId is required",
    });
  }

  try {
    const summary = await analyticsService.getAnalyticsSummary(userId);
    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to fetch analytics",
    });
  }
};
