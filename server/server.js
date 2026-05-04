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

try {
  initFirebase();
  console.log("Firebase Admin initialized.");
} catch (err) {
  console.warn("Firebase Admin not initialized:", err.message);
  console.warn("Set FIREBASE_CONFIG (JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path) to enable Firebase.");
}

// JSON API — register before static so paths never collide with `public/` files.
app.use("/auth", authRoutes);
app.use("/courses", courseRoutes);
app.use("/assignments", assignmentRoutes);
app.use("/schedule", scheduleRoutes);
app.use("/study-session", studySessionRoutes);
app.use("/analytics", analyticsRoutes);
// Same routes under `/api/*` so `VITE_API_URL=https://host.../api` matches the server.
app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/study-session", studySessionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api", routes);

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  if (
    req.path.startsWith("/auth") ||
    req.path.startsWith("/courses") ||
    req.path.startsWith("/assignments") ||
    req.path.startsWith("/schedule") ||
    req.path.startsWith("/study-session") ||
    req.path.startsWith("/analytics") ||
    req.path.startsWith("/api")
  ) {
    return next();
  }

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
