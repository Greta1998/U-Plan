import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { analyticsApi } from "../lib/api";

export default function Analytics() {
  const { user } = useAuth();
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const res = await analyticsApi.get(user.userId);
        if (!c) setD(res.data);
      } catch (e) {
        if (!c) setErr(e.message);
      }
    })();
    return () => {
      c = true;
    };
  }, [user.userId]);

  if (err) return <div className="alert-box alert-error">{err}</div>;
  if (!d) return <div className="empty-hint">Loading analytics…</div>;

  const burnoutColor = d.burnoutLevel === "HIGH" ? "#dc2626" : d.burnoutLevel === "MEDIUM" ? "#f59e0b" : "#16a34a";

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h1 className="page-heading">Analytics</h1>
        <p className="page-sub">Live from GET /analytics/:userId</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <div className="card stat-card">
          <div className="stat-label">Planned hours</div>
          <div className="stat-value">
            {d.totalPlannedHours}
            <span style={{ fontSize: "16px", color: "#9ba0b0" }}>h</span>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Actual hours</div>
          <div className="stat-value">
            {d.totalActualHours}
            <span style={{ fontSize: "16px", color: "#9ba0b0" }}>h</span>
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Completion rate</div>
          <div className="stat-value" style={{ color: "#16a34a" }}>
            {(d.completionRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Burnout</div>
          <div className="stat-value" style={{ color: burnoutColor, fontSize: "22px" }}>
            {d.burnoutLevel}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <div className="section-title" style={{ marginBottom: "16px" }}>
            Behaviour & focus
          </div>
          <table>
            <tbody>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Sessions</td>
                <td style={{ textAlign: "right" }}>
                  {d.totalSessions} ({d.completedSessions} completed, {d.missedSessions ?? d.totalSessions - d.completedSessions} missed)
                </td>
              </tr>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Consistency</td>
                <td style={{ textAlign: "right" }}>{(d.consistencyScore * 100).toFixed(0)}%</td>
              </tr>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Avg session length</td>
                <td style={{ textAlign: "right" }}>{d.avgSessionLength}h</td>
              </tr>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Avg break time</td>
                <td style={{ textAlign: "right" }}>{d.avgBreakTime}h</td>
              </tr>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Focus score</td>
                <td style={{ textAlign: "right" }}>{(d.focusScore * 100).toFixed(0)}%</td>
              </tr>
              <tr>
                <td style={{ color: "#9ba0b0" }}>Daily load (max / min)</td>
                <td style={{ textAlign: "right" }}>
                  {d.maxDailyHours}h / {d.minDailyHours}h
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: "20px" }}>
          <div className="section-title" style={{ marginBottom: "16px" }}>
            Burnout insight
          </div>
          <p style={{ fontSize: "14px", marginBottom: "8px" }}>
            <strong>Reason:</strong> {d.reason}
          </p>
          <p style={{ fontSize: "13px", color: "#5a6080", marginBottom: "16px" }}>{d.recommendation}</p>
          <div className="section-title" style={{ marginBottom: "8px" }}>
            Actual hours by weekday
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {d.dailyLoadByWeekday && Object.keys(d.dailyLoadByWeekday).length === 0 ? (
              <span style={{ fontSize: "13px", color: "#9ba0b0" }}>No completed sessions yet.</span>
            ) : (
              Object.entries(d.dailyLoadByWeekday || {}).map(([day, hrs]) => (
                <div key={day} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span>{day}</span>
                  <span>{hrs}h</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
