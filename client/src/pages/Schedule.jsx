import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { scheduleApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

export default function Schedule() {
  const { user } = useAuth();
  const showToast = useToast();
  const [loading, setLoading] = useState(false);
  const [grouped, setGrouped] = useState(null);

  async function generate() {
    setLoading(true);
    setGrouped(null);
    try {
      const res = await scheduleApi.generate(user.userId);
      setGrouped(res.data || {});
      showToast("success", "Schedule generated", `${res.meta?.generatedCount ?? 0} session(s) planned.`);
    } catch (e) {
      showToast("error", "Schedule failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  const dates = grouped ? Object.keys(grouped).sort() : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">Weekly schedule</h1>
          <p className="page-sub">Generated from pending assignments (next 7 study days, Sundays skipped).</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={generate} disabled={loading}>
          {loading ? "Generating…" : "Generate schedule"}
        </button>
      </div>

      {!dates.length && !loading && (
        <div className="card empty-hint">Click Generate to create planned study sessions from your pending assignments.</div>
      )}

      {dates.map((dateKey) => (
        <div key={dateKey} className="card" style={{ marginBottom: "16px", padding: "16px 18px" }}>
          <div className="section-title" style={{ marginBottom: "12px" }}>
            {dateKey}{" "}
            <span style={{ fontWeight: 400, color: "#9ba0b0", fontSize: "13px" }}>
              ({grouped[dateKey]?.length || 0} block(s))
            </span>
          </div>
          <ul style={{ listStyle: "none", fontSize: "13px" }}>
            {(grouped[dateKey] || []).map((s) => (
              <li key={s.sessionId} style={{ padding: "8px 0", borderBottom: "1px solid #f0f2f8" }}>
                <strong>{s.plannedDuration}h</strong> · assignment <code style={{ fontSize: "12px" }}>{s.assignmentId}</code> ·{" "}
                <span className="badge badge-info">{s.status}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
