import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { analyticsApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

function clampPercent(value) {
  const n = Number(value) || 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export default function Analytics() {
  const { user } = useAuth();
  const showToast = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await analyticsApi.get(user.userId);
        if (!cancelled) setData(res.data || null);
      } catch (e) {
        if (!cancelled) showToast("error", "Failed to load analytics", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast, user.userId]);

  const completionPct = useMemo(() => clampPercent((data?.assignmentCompletionRate || 0) * 100), [data]);
  const burnoutScore = useMemo(() => clampPercent((data?.pendingAssignments || 0) * 12), [data]);
  const ringOffset = useMemo(() => 314 - (314 * burnoutScore) / 100, [burnoutScore]);
  const workloadColor =
    data?.workloadLevel === "HIGH" ? "#f59e0b" : data?.workloadLevel === "LOW" ? "#16a34a" : "#3b6ff0";

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 className="page-heading">Analytics</h1>
        <p className="page-sub">Your academic performance overview</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <div className="card stat-card">
          <div className="stat-label">Assignments</div>
          <div className="stat-value">{loading ? "…" : data?.totalAssignments ?? 0}</div>
          <div className="stat-sub">Total tracked tasks</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Task completion</div>
          <div className="stat-value" style={{ color: "#16a34a" }}>
            {loading ? "…" : `${completionPct.toFixed(0)}%`}
          </div>
          <div className="stat-sub">Completed assignments</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Burnout level</div>
          <div className="stat-value" style={{ color: workloadColor }}>
            {loading ? "…" : data?.workloadLevel || "MEDIUM"}
          </div>
          <div className="stat-sub">{loading ? "" : data?.reason}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <div className="section-title" style={{ marginBottom: "16px" }}>
            Burnout indicator
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <div className="burnout-wrap" style={{ padding: 0 }}>
              <div className="burnout-ring">
                <svg width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f0f2f8" strokeWidth="10" />
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke={workloadColor}
                    strokeWidth="10"
                    strokeDasharray="314"
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="burnout-label">
                  <span className="burnout-score" style={{ color: workloadColor }}>
                    {loading ? "…" : burnoutScore.toFixed(0)}
                  </span>
                  <span className="burnout-text">/ 100</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", color: "#5a6080", marginBottom: "8px" }}>
                <strong>Reason:</strong> {loading ? "Loading…" : data?.reason || "No insight yet"}
              </p>
              <div style={{ fontSize: "13px", color: "#5a6080" }}>
                <strong>Recommendation:</strong> {loading ? "Please wait…" : data?.recommendation || "Keep tracking your work."}
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div className="section-title" style={{ marginBottom: "16px" }}>
            Assignment progress
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                <span style={{ fontWeight: 500 }}>Completed</span>
                <span style={{ color: "#16a34a", fontWeight: 500 }}>{loading ? "…" : data?.completedAssignments ?? 0}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${completionPct}%`, background: "#16a34a" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                <span style={{ fontWeight: 500 }}>In progress</span>
                <span style={{ color: "#3b6ff0", fontWeight: 500 }}>{loading ? "…" : data?.inProgressAssignments ?? 0}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${clampPercent((data?.inProgressAssignments || 0) * 15)}%`, background: "#3b6ff0" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                <span style={{ fontWeight: 500 }}>Pending</span>
                <span style={{ color: "#dc2626", fontWeight: 500 }}>{loading ? "…" : data?.pendingAssignments ?? 0}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${clampPercent((data?.pendingAssignments || 0) * 15)}%`, background: "#dc2626" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
