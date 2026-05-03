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
  const [dueThisWeekCount, setDueThisWeekCount] = useState(0);
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
      const localKey = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      };
      const dow = new Date().getDay();
      const toMonday = dow === 0 ? -6 : 1 - dow;
      const monday = new Date();
      monday.setDate(monday.getDate() + toMonday);
      monday.setHours(0, 0, 0, 0);
      const weekBarColors = ["#3b6ff0", "#f97316", "#ef4444", "#16a34a", "#6366f1", "#0891b2", "#a855f7"];
      const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
      const weekDays = dayLabels.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateKey = localKey(d);
        const items = grouped[dateKey];
        const hours = (Array.isArray(items) ? items : []).reduce((sum, s) => sum + (Number(s.plannedDuration) || 0), 0);
        return {
          label,
          dateKey,
          hours,
          barColor: weekBarColors[i % weekBarColors.length],
        };
      });
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const assignmentsDueSoon = allAssignments.filter((x) => {
        const ts = Date.parse(x.deadline);
        const st = String(x.status || "").toLowerCase();
        return Number.isFinite(ts) && st !== "completed" && ts >= now && ts <= now + weekMs;
      }).length;

      setAnalytics(a.data);
      setUpcoming(nextAssignments);
      setWeekLoad(weekDays);
      setDueThisWeekCount(assignmentsDueSoon);
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
  const plannedTotal = useMemo(() => weekLoad.reduce((sum, w) => sum + w.hours, 0), [weekLoad]);
  const maxWeekHours = useMemo(() => Math.max(1, ...weekLoad.map((w) => w.hours)), [weekLoad]);

  function badgeForStatus(status, deadline) {
    const normalized = String(status || "").toLowerCase();
    const isOverdue = Date.parse(deadline) < Date.now() && normalized !== "completed";
    if (isOverdue) return { className: "badge-overdue", label: "Overdue" };
    if (normalized === "completed") return { className: "badge-done", label: "Completed" };
    if (normalized === "in_progress") return { className: "badge-inprog", label: "In Progress" };
    return { className: "badge-pending", label: "Pending" };
  }

  const inProg = d?.inProgressAssignments ?? 0;
  const pending = d?.pendingAssignments ?? 0;

  return (
    <div className="dash-root">
      <div className="dash-hero">
        <div>
          <h1 className="dash-greeting">
            {greeting()}, {user.name?.split(" ")[0] || "there"} 👋
          </h1>
          {err ? (
            <p className="dash-hero-meta dash-hero-meta--err">{err}</p>
          ) : loading ? (
            <p className="dash-hero-meta">Loading your assignments…</p>
          ) : (
            <p className="dash-hero-meta">
              You have <strong>{dueThisWeekCount}</strong> assignment{dueThisWeekCount !== 1 ? "s" : ""} due this week.
            </p>
          )}
        </div>
        <Link to="/schedule" className="btn btn-primary btn-generate">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Generate Schedule
        </Link>
      </div>

      <div className="dash-stat-grid">
        <div className="card stat-card stat-card--dash">
          <div className="stat-icon stat-icon--soft-blue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b6ff0" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div className="stat-label">Planned Hours</div>
          <div className="stat-value">{loading ? "…" : `${plannedTotal}h`}</div>
          <div className={`stat-trend${plannedTotal >= 6 ? " stat-trend--up" : ""}`}>
            {loading ? "…" : plannedTotal > 0 ? "↑ From your current schedule" : "Add blocks in Schedule"}
          </div>
        </div>
        <div className="card stat-card stat-card--dash">
          <div className="stat-icon stat-icon--soft-green">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </div>
          <div className="stat-label">Completed Tasks</div>
          <div className="stat-value">{loading ? "…" : d?.completedAssignments ?? 0}</div>
          <div className={`stat-trend${inProg > 0 ? " stat-trend--up" : ""}`}>
            {loading ? "…" : inProg > 0 ? `↑ ${inProg} in progress` : "Keep updating statuses"}
          </div>
        </div>

        <div className="card stat-card stat-card--dash">
          <div className="stat-icon stat-icon--soft-amber">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <div className="stat-label">Active Courses</div>
          <div className="stat-value">{loading ? "…" : d?.courseCount ?? 0}</div>
          <div className="stat-trend">
            {loading ? "…" : pending > 0 ? `${pending} with open work` : "On track across courses"}
          </div>
        </div>

        <div className="card stat-card stat-card--dash">
          <div className="stat-icon stat-icon--soft-warm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={workloadColor} strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18 9l-5 5-4-3-6 6" />
            </svg>
          </div>
          <div className="stat-label">Burnout Risk</div>
          <div className="stat-value stat-value--risk" style={{ color: workloadColor }}>
            {loading ? "…" : `${burnoutPct}%`}
          </div>
          <div className={workload === "HIGH" ? "stat-trend stat-trend--risk" : "stat-trend"}>
            {loading ? "…" : workload === "HIGH" ? "↑ Elevated — pace yourself" : `${workload} workload`}
          </div>
        </div>
      </div>

      <div className="dash-panels">
        <div className="card dash-table-card">
          <div className="dash-table-head">
            <span className="section-title">Upcoming Assignments</span>
            <Link to="/assignments" className="dash-view-all">
              View all
            </Link>
          </div>
          <div className="dash-table-scroll">
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
                {loading ? (
                  <tr>
                    <td colSpan={4} className="dash-loading-cell">
                      Loading…
                    </td>
                  </tr>
                ) : (
                  <>
                    {upcoming.map((a) => {
                      const b = badgeForStatus(a.status, a.deadline);
                      return (
                        <tr key={a.assignmentId}>
                          <td className="dash-cell-title">{a.title}</td>
                          <td className="dash-cell-muted">{a.courseName || "Course"}</td>
                          <td>{new Date(a.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                          <td>
                            <span className={`badge ${b.className}`}>{b.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {upcoming.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="dash-empty-cell">
                          No upcoming assignments.
                        </td>
                      </tr>
                    ) : null}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card dash-load-card">
          <div className="section-title dash-load-title">This Week&apos;s Load</div>
          <div className="dash-load-bars">
            {weekLoad.map((item) => (
              <div key={item.dateKey} className="dash-load-row">
                <div className="dash-load-row-top">
                  <span className="dash-load-day">{item.label}</span>
                  <span className="dash-load-hours">{item.hours}h</span>
                </div>
                <div className="progress-bar progress-bar--dash">
                  <div
                    className="progress-fill progress-fill--dash"
                    style={{
                      width: `${Math.min(100, (item.hours / maxWeekHours) * 100)}%`,
                      background: item.barColor,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
