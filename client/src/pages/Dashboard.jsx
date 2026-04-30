import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { analyticsApi, assignmentsApi, coursesApi, scheduleApi } from "../lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const [analytics, setAnalytics] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [weekLoad, setWeekLoad] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef(null);

  const loadData = useCallback(async () => {
    if (!user?.userId) return;
    try {
      setErr("");
      const [a, c, sched] = await Promise.all([
        analyticsApi.get(user.userId),
        coursesApi.list(user.userId),
        scheduleApi.get(user.userId),
      ]);
      const courseList = Array.isArray(c.data) ? c.data : [];
      const allAssignments = [];
      for (const course of courseList) {
        const aa = await assignmentsApi.byCourse(course.courseId);
        const arr = Array.isArray(aa.data) ? aa.data : [];
        arr.forEach((x) => allAssignments.push({ ...x, courseName: course.courseName }));
      }
      const now = Date.now();
      const nextAssignments = allAssignments
        .filter((x) => String(x.status || "").toLowerCase() !== "completed")
        .sort((x, y) => Date.parse(x.deadline) - Date.parse(y.deadline))
        .slice(0, 5);

      const grouped = sched.data || {};
      const dailyHours = Object.entries(grouped).map(([dateKey, items]) => ({
        dateKey,
        hours: (Array.isArray(items) ? items : []).reduce((sum, s) => sum + (Number(s.plannedDuration) || 0), 0),
      }));
      dailyHours.sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
      const nextDays = dailyHours.slice(0, 6).map((d) => ({
        ...d,
        label:
          Date.parse(d.dateKey) > now
            ? new Date(d.dateKey).toLocaleDateString("en-US", { weekday: "long" })
            : "Today",
      }));

      setAnalytics(a.data);
      setUpcoming(nextAssignments);
      setWeekLoad(nextDays);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData, location.key]);

  useEffect(() => {
    function scheduleRefresh() {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        debounceTimer.current = null;
        if (document.visibilityState === "visible") {
          loadData();
        }
      }, 400);
    }

    function onVisibility() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    function onFocus() {
      scheduleRefresh();
    }

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [loadData]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  const d = analytics;
  const workload = d?.workloadLevel ?? "—";
  const workloadColor =
    workload === "HIGH" ? "#dc2626" : workload === "MEDIUM" ? "#f59e0b" : "#16a34a";
  const burnoutPct = useMemo(() => Math.min(95, (d?.pendingAssignments || 0) * 12), [d?.pendingAssignments]);

  function badgeForStatus(status, deadline) {
    const normalized = String(status || "").toLowerCase();
    const isOverdue = Date.parse(deadline) < Date.now() && normalized !== "completed";
    if (isOverdue) return { className: "badge-overdue", label: "Overdue" };
    if (normalized === "completed") return { className: "badge-done", label: "Completed" };
    if (normalized === "in_progress") return { className: "badge-inprog", label: "In Progress" };
    return { className: "badge-pending", label: "Pending" };
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">
            {greeting()}, {user.name?.split(" ")[0] || "there"} 👋
          </h1>
          {err ? (
            <p className="page-sub">
              <span style={{ color: "#dc2626" }}>{err}</span>
            </p>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <Link to="/assignments" className="btn btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Assignments
          </Link>
          <Link to="/schedule" className="btn btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Schedule
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#f0f4ff" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b6ff0" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="stat-label">Planned hours</div>
          <div className="stat-value">
            {loading ? "…" : `${weekLoad.reduce((sum, d2) => sum + d2.hours, 0)}h`}
          </div>
          <div className="stat-change up">From your current schedule</div>
        </div>
        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#f0fdf4" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="stat-label">Completed tasks</div>
          <div className="stat-value">
            {loading ? "…" : `${d?.completedAssignments ?? 0}`}
            <span style={{ fontSize: "16px", color: "#9ba0b0" }}>
              {loading ? "" : ` / ${d?.totalAssignments ?? 0}`}
            </span>
          </div>
          <div className="stat-sub" style={{ marginTop: "6px", fontSize: "11px", color: "#9ba0b0" }}>
            Assignments marked done
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#fff7ed" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-label">Active courses</div>
          <div className="stat-value">{loading ? "…" : d?.courseCount ?? 0}</div>
          <div className="stat-sub" style={{ marginTop: "6px", fontSize: "11px", color: "#9ba0b0" }}>
            Enrolled this semester
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon" style={{ background: "#fff7ed" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={workloadColor} strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 9l-5 5-4-3-6 6" />
            </svg>
          </div>
          <div className="stat-label">Burnout risk</div>
          <div className="stat-value" style={{ fontSize: "22px", color: workloadColor }}>
            {loading ? "…" : `${burnoutPct}%`}
          </div>
          <div className="stat-sub">{loading ? "" : workload}</div>
        </div>
      </div>

      {d && !loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(300px, 340px)", gap: "20px", marginBottom: "24px" }}>
          <div className="card">
            <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f0f2f8" }}>
              <span className="section-title">Upcoming Assignments</span>
              <Link to="/assignments" className="btn btn-ghost btn-sm">
                View all
              </Link>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Course</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((a) => {
                  const b = badgeForStatus(a.status, a.deadline);
                  return (
                    <tr key={a.assignmentId}>
                      <td style={{ fontWeight: 500 }}>{a.title}</td>
                      <td style={{ color: "#9ba0b0" }}>{a.courseName || "Course"}</td>
                      <td>{new Date(a.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td>
                        <span className={`badge ${b.className}`}>{b.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {upcoming.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ color: "#9ba0b0", textAlign: "center" }}>
                      No upcoming assignments.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: "18px" }}>
            <div style={{ marginBottom: "16px" }} className="section-title">
              This Week&apos;s Load
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {weekLoad.map((item) => (
                <div key={item.dateKey}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                    <span style={{ color: "#5a6080" }}>{item.label}</span>
                    <span style={{ color: "#9ba0b0" }}>{item.hours}h</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${Math.min(100, (item.hours / 6) * 100)}%`, background: item.hours >= 5 ? "#f04444" : "#3b6ff0" }} />
                  </div>
                </div>
              ))}
              {weekLoad.length === 0 ? <p style={{ color: "#9ba0b0", fontSize: "13px" }}>No planned sessions yet.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: "13px", color: "#9ba0b0", margin: 0 }}>
          Schedule and study sessions are separate from these assignment metrics. Open the sidebar for Schedule or Courses.
        </p>
      </div>
    </div>
  );
}
