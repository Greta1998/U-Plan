require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./routes");
const authRoutes = require("./routes/authRoutes");
const courseRoutes = require("./routes/courseRoutes");
const assignmentRoutes = require("./routes/assignmentRoutes");
const scheduleRoutes = require("./routes/scheduleRoutes");
const studySessionRoutes = require("./routes/studySessionRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const { initFirebase } = require("./config/firebase");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

try {
  initFirebase();
  console.log("Firebase Admin initialized.");
} catch (err) {
  console.warn("Firebase Admin not initialized:", err.message);
  console.warn("Add GOOGLE_APPLICATION_CREDENTIALS to .env to enable Firebase.");
}

app.use("/auth", authRoutes);
app.use("/courses", courseRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/study-session", studySessionRoutes);
app.use("/analytics", analyticsRoutes);
app.use("/", routes);

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const server = app.listen(PORT, () => {
  console.log(`U-Plan API listening on http://localhost:${PORT}`);
  console.log("Server is running — press Ctrl+C to stop.");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
  } else {
    console.error("HTTP server error:", err.message);
  }
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("uncaughtException:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("unhandledRejection:", reason);
});
