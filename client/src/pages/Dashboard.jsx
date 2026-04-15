import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyticsApi, coursesApi } from "../lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [courseCount, setCourseCount] = useState(0);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, c] = await Promise.all([
          analyticsApi.get(user.userId),
          coursesApi.list(user.userId),
        ]);
        if (!cancelled) {
          setAnalytics(a.data);
          setCourseCount(Array.isArray(c.data) ? c.data.length : 0);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const planned = analytics?.totalPlannedHours ?? 0;
  const completed = analytics?.completedSessions ?? 0;
  const burnout = analytics?.burnoutLevel ?? "—";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">
            {greeting()}, {user.name?.split(" ")[0] || "there"} 👋
          </h1>
          <p className="page-sub">
            {err ? <span style={{ color: "#dc2626" }}>{err}</span> : "Your study overview from the U-Plan API."}
          </p>
        </div>
        <Link to="/schedule" className="btn btn-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Generate Schedule
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#f0f4ff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b6ff0" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="stat-label">Planned hours (tracked)</div>
          <div className="stat-value">
            {planned}
            <span style={{ fontSize: "16px", color: "#9ba0b0" }}>h</span>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#f0fdf4" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="stat-label">Sessions completed</div>
          <div className="stat-value">{completed}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#fff7ed" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-label">Courses</div>
          <div className="stat-value">{courseCount}</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#fef2f2" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 9l-5 5-4-3-6 6" />
            </svg>
          </div>
          <div className="stat-label">Burnout level</div>
          <div className="stat-value" style={{ fontSize: "22px", color: burnout === "HIGH" ? "#dc2626" : burnout === "MEDIUM" ? "#f59e0b" : "#16a34a" }}>
            {burnout}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: "20px" }}>
        <div className="section-title" style={{ marginBottom: "8px" }}>Quick actions</div>
        <p style={{ fontSize: "13px", color: "#9ba0b0", marginBottom: "12px" }}>
          Use the sidebar to manage courses, assignments, generate a schedule, and view analytics — all backed by your Express API.
        </p>
        <Link to="/analytics" className="btn btn-outline btn-sm">
          Open analytics
        </Link>
      </div>
    </div>
  );
}
