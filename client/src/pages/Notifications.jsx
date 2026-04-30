import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { analyticsApi, assignmentsApi, coursesApi, scheduleApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

function timeLabel(dateValue) {
  if (!dateValue) return "recently";
  const ts = Date.parse(dateValue);
  if (!Number.isFinite(ts)) return "recently";
  const diffHours = Math.max(1, Math.round((Date.now() - ts) / (1000 * 60 * 60)));
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const days = Math.round(diffHours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function Notifications() {
  const { user } = useAuth();
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRead, setShowRead] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cRes = await coursesApi.list(user.userId);
        const courseList = Array.isArray(cRes.data) ? cRes.data : [];
        const scheduleRes = await scheduleApi.get(user.userId);
        const analyticsRes = await analyticsApi.get(user.userId);

        const notifications = [];
        const now = Date.now();
        for (const course of courseList) {
          const aRes = await assignmentsApi.byCourse(course.courseId);
          const assignments = Array.isArray(aRes.data) ? aRes.data : [];
          assignments.forEach((assignment) => {
            const dueTs = Date.parse(assignment.deadline);
            if (!Number.isFinite(dueTs)) return;
            const status = String(assignment.status || "pending").toLowerCase();
            if (status !== "completed" && dueTs < now) {
              notifications.push({
                id: `overdue-${assignment.assignmentId}`,
                unread: true,
                title: `Assignment overdue: ${assignment.title}`,
                message: `Your ${course.courseName} assignment is overdue. Submit it to avoid penalties.`,
                tag: "Urgent",
                tone: "overdue",
                createdAt: assignment.deadline,
              });
            } else if (status !== "completed" && dueTs - now <= 2 * 24 * 60 * 60 * 1000) {
              notifications.push({
                id: `due-${assignment.assignmentId}`,
                unread: true,
                title: `${assignment.title} due soon`,
                message: `${course.courseName} is due within 48 hours.`,
                tag: "Reminder",
                tone: "pending",
                createdAt: assignment.deadline,
              });
            }
          });
        }

        const groupedSchedule = scheduleRes.data || {};
        const plannedCount = Object.values(groupedSchedule).reduce((acc, x) => acc + (Array.isArray(x) ? x.length : 0), 0);
        if (plannedCount > 0) {
          notifications.push({
            id: "schedule-ready",
            unread: false,
            title: "Weekly schedule available",
            message: `You have ${plannedCount} planned study session(s) in your calendar.`,
            tag: "Report",
            tone: "info",
            createdAt: new Date().toISOString(),
          });
        }

        const analytics = analyticsRes.data || {};
        notifications.push({
          id: "analytics-insight",
          unread: false,
          title: "Weekly analytics updated",
          message: analytics.recommendation || "Your latest workload insight is ready.",
          tag: "Insight",
          tone: "done",
          createdAt: new Date().toISOString(),
        });

        notifications.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        if (!cancelled) setRows(notifications);
      } catch (e) {
        if (!cancelled) showToast("error", "Failed to load notifications", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showToast, user.userId]);

  const unread = useMemo(() => rows.filter((x) => x.unread), [rows]);
  const read = useMemo(() => rows.filter((x) => !x.unread), [rows]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">Notifications</h1>
          <p className="page-sub">Stay up to date with alerts and updates</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setShowRead((v) => !v)}>
          {showRead ? "Hide read" : "Show read"}
        </button>
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#f8f9fc", borderBottom: "1px solid #e8eaf2", fontSize: "12px", fontWeight: 600, color: "#9ba0b0", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Unread · {loading ? "…" : unread.length}
        </div>
        {!loading &&
          unread.map((n) => (
            <div key={n.id} style={{ padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: "14px", borderBottom: "1px solid #f0f2f8", background: "#fafbff" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: n.tone === "overdue" ? "#fee2e2" : "#dde6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                {n.tone === "overdue" ? "!" : "i"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 500, color: "#1a1d2e", marginBottom: "3px" }}>{n.title}</div>
                <div style={{ fontSize: "13px", color: "#9ba0b0" }}>{n.message}</div>
                <div style={{ fontSize: "12px", color: "#c0c5d8", marginTop: "6px" }}>{timeLabel(n.createdAt)}</div>
              </div>
              <span className={`badge ${n.tone === "overdue" ? "badge-overdue" : "badge-pending"}`}>{n.tag}</span>
            </div>
          ))}
        {!loading && unread.length === 0 ? <div className="empty-hint">No unread alerts right now.</div> : null}

        {showRead ? (
          <>
            <div style={{ padding: "14px 18px", background: "#f8f9fc", borderBottom: "1px solid #e8eaf2", borderTop: "1px solid #e8eaf2", fontSize: "12px", fontWeight: 600, color: "#9ba0b0", letterSpacing: "0.5px", textTransform: "uppercase" }}>
              Earlier
            </div>
            {!loading &&
              read.map((n) => (
                <div key={n.id} style={{ padding: "16px 18px", display: "flex", alignItems: "flex-start", gap: "14px", borderBottom: "1px solid #f0f2f8" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: n.tone === "done" ? "#dcfce7" : "#dde6ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                    {n.tone === "done" ? "✓" : "•"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#9ba0b0", marginBottom: "3px" }}>{n.title}</div>
                    <div style={{ fontSize: "13px", color: "#c0c5d8" }}>{n.message}</div>
                    <div style={{ fontSize: "12px", color: "#c0c5d8", marginTop: "6px" }}>{timeLabel(n.createdAt)}</div>
                  </div>
                  <span className={`badge ${n.tone === "done" ? "badge-done" : "badge-info"}`}>{n.tag}</span>
                </div>
              ))}
            {!loading && read.length === 0 ? <div className="empty-hint">No earlier notifications yet.</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
