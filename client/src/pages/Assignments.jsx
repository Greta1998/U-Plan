import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { coursesApi, assignmentsApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

/** Maps API / legacy values to pending | in_progress | completed */
function normalizeAssignmentStatus(s) {
  const x = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (x === "completed") return "completed";
  if (x === "in_progress" || x === "inprogress") return "in_progress";
  return "pending";
}

function formatDueDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isOverdue(iso, status) {
  if (normalizeAssignmentStatus(status) === "completed") return false;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return t < Date.now();
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
  const [updatingId, setUpdatingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

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

  const filteredRows = useMemo(() => {
    if (filterStatus === "all") return rows;
    return rows.filter((a) => normalizeAssignmentStatus(a.status) === filterStatus);
  }, [rows, filterStatus]);

  async function patchStatus(assignmentId, nextStatus) {
    setUpdatingId(assignmentId);
    try {
      await assignmentsApi.updateStatus(assignmentId, nextStatus);
      await load();
    } catch (err) {
      showToast("error", "Could not update status", err.message);
    } finally {
      setUpdatingId(null);
    }
  }

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 className="page-heading">Assignments</h1>
          <p className="page-sub">
            {loading ? "Loading…" : "Manage and track all your work."}
            {!loading && rows.length > 0 ? ` ${rows.length} total` : ""}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <select
            className="form-input form-select assignments-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => setModal(true)} disabled={!courses.length}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New assignment
          </button>
        </div>
      </div>

      {!courses.length && !loading ? (
        <div className="card empty-hint">Add a course first, then create assignments for it.</div>
      ) : (
        <div className="card assignments-table-card" style={{ overflow: "hidden" }}>
          <table className="assignments-table">
            <thead>
              <tr>
                <th className="assignments-th-check" aria-label="Select" />
                <th>Assignment</th>
                <th>Due date</th>
                <th className="assignments-th-status">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((a) => {
                const st = normalizeAssignmentStatus(a.status);
                const done = st === "completed";
                const overdue = isOverdue(a.deadline, a.status);
                const busy = updatingId === a.assignmentId;
                return (
                  <tr key={a.assignmentId} className={done ? "assignments-row--done" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        className="assignments-checkbox"
                        checked={done}
                        disabled={busy}
                        onChange={(e) => patchStatus(a.assignmentId, e.target.checked ? "completed" : "pending")}
                        aria-label={done ? "Mark as not completed" : "Mark as completed"}
                      />
                    </td>
                    <td className={done ? "assignments-title--done" : undefined} style={{ fontWeight: 500 }}>
                      {a.title}
                    </td>
                    <td
                      className="assignments-due"
                      style={{
                        fontSize: "13px",
                        color: overdue ? "#dc2626" : undefined,
                      }}
                    >
                      {formatDueDate(a.deadline)}
                    </td>
                    <td>
                      <select
                        className="form-input form-select assignments-status-select"
                        value={st}
                        disabled={busy}
                        onChange={(e) => patchStatus(a.assignmentId, e.target.value)}
                        aria-label="Assignment status"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && filteredRows.length === 0 && rows.length > 0 ? (
            <div className="empty-hint" style={{ borderTop: "1px solid #f0f2f8" }}>
              No assignments match this filter.
            </div>
          ) : null}
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
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
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
