import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { coursesApi, assignmentsApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

function badgeForStatus(s) {
  const x = (s || "").toLowerCase();
  if (x === "completed") return "badge-done";
  if (x === "pending") return "badge-pending";
  return "badge-inprog";
}

export default function Assignments() {
  const { user } = useAuth();
  const showToast = useToast();
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [submitting, setSubmitting] = useState(false);

  const courseNameById = useMemo(() => {
    const m = {};
    courses.forEach((c) => {
      m[c.courseId] = c.courseName;
    });
    return m;
  }, [courses]);

  async function load() {
    setLoading(true);
    try {
      const cRes = await coursesApi.list(user.userId);
      const list = Array.isArray(cRes.data) ? cRes.data : [];
      setCourses(list);
      const all = [];
      for (const c of list) {
        const cid = c.courseId;
        const aRes = await assignmentsApi.byCourse(cid);
        const arr = Array.isArray(aRes.data) ? aRes.data : [];
        arr.forEach((a) => {
          all.push({ ...a, _courseId: cid, courseName: c.courseName });
        });
      }
      all.sort((a, b) => String(a.deadline).localeCompare(String(b.deadline)));
      setRows(all);
    } catch (e) {
      showToast("error", "Load failed", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user.userId]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const iso = new Date(deadline).toISOString();
      await assignmentsApi.create({
        courseId,
        title: title.trim(),
        deadline: iso,
        priority,
        status,
      });
      showToast("success", "Assignment created", title);
      setModal(false);
      setTitle("");
      setDeadline("");
      setPriority("medium");
      setStatus("pending");
      await load();
    } catch (err) {
      showToast("error", "Could not create", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">Assignments</h1>
          <p className="page-sub">{loading ? "Loading…" : `${rows.length} total`}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModal(true)} disabled={!courses.length}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New assignment
        </button>
      </div>

      {!courses.length && !loading ? (
        <div className="card empty-hint">Add a course first, then create assignments for it.</div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table>
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Course</th>
                <th>Due</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.assignmentId}>
                  <td style={{ fontWeight: 500 }}>{a.title}</td>
                  <td style={{ color: "#9ba0b0", fontSize: "13px" }}>{a.courseName || courseNameById[a.courseId]}</td>
                  <td style={{ fontSize: "13px" }}>{a.deadline ? new Date(a.deadline).toLocaleString() : "—"}</td>
                  <td>
                    <span className={`badge ${a.priority === "high" ? "badge-overdue" : "badge-pending"}`}>{a.priority}</span>
                  </td>
                  <td>
                    <span className={`badge ${badgeForStatus(a.status)}`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={modal ? "modal-overlay" : "modal-overlay hidden"}>
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">New assignment</span>
            <button type="button" className="close-btn" onClick={() => setModal(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Course</label>
              <select className="form-input form-select" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
                <option value="">Select course</option>
                {courses.map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseName}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Title</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input className="form-input" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-input form-select" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="pending">pending</option>
                  <option value="completed">completed</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
