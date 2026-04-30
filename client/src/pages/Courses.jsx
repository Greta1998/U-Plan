import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { assignmentsApi, coursesApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

const gradients = [
  "linear-gradient(135deg,#3b6ff0,#6091ff)",
  "linear-gradient(135deg,#7c3aed,#a855f7)",
  "linear-gradient(135deg,#059669,#34d399)",
  "linear-gradient(135deg,#dc2626,#f87171)",
  "linear-gradient(135deg,#d97706,#fbbf24)",
];

export default function Courses() {
  const { user } = useAuth();
  const showToast = useToast();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [creditUnits, setCreditUnits] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const [courseStats, setCourseStats] = useState({});

  async function load() {
    setLoading(true);
    try {
      const res = await coursesApi.list(user.userId);
      const list = Array.isArray(res.data) ? res.data : [];
      setCourses(list);
      const stats = {};
      for (const course of list) {
        const aRes = await assignmentsApi.byCourse(course.courseId);
        const assignments = Array.isArray(aRes.data) ? aRes.data : [];
        const completed = assignments.filter((a) => String(a.status || "").toLowerCase() === "completed").length;
        const total = assignments.length;
        stats[course.courseId] = {
          completed,
          total,
          pct: total === 0 ? 0 : Math.round((completed / total) * 100),
        };
      }
      setCourseStats(stats);
    } catch (e) {
      showToast("error", "Failed to load courses", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user.userId]);

  async function handleAdd(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await coursesApi.create({
        userId: user.userId,
        courseName: courseName.trim(),
        creditUnits: Number(creditUnits),
      });
      showToast("success", "Course added", courseName);
      setModalOpen(false);
      setCourseName("");
      setCreditUnits(3);
      await load();
    } catch (err) {
      showToast("error", "Could not add course", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(courseId) {
    if (!confirm("Delete this course?")) return;
    try {
      await coursesApi.remove(courseId);
      showToast("success", "Course removed", "");
      await load();
    } catch (err) {
      showToast("error", "Delete failed", err.message);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 className="page-heading">My Courses</h1>
          <p className="page-sub">{loading ? "Loading…" : `${courses.length} course(s)`}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Course
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
        {courses.map((c, i) => (
          <div key={c.courseId || c.id} className="course-card">
            <div className="course-card-top" style={{ background: gradients[i % gradients.length] }}>
              <span style={{ fontSize: "22px" }}>📚</span>
            </div>
            <div className="course-card-body">
              <div className="course-name">{c.courseName}</div>
              <div className="course-code">{c.creditUnits} credits</div>
              <div className="progress-bar" style={{ marginBottom: "8px" }}>
                <div className="progress-fill" style={{ width: `${courseStats[c.courseId]?.pct || 0}%`, background: "#3b6ff0" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ba0b0", marginBottom: "10px" }}>
                <span>{courseStats[c.courseId]?.pct || 0}% complete</span>
                <span>
                  {courseStats[c.courseId]?.completed || 0}/{courseStats[c.courseId]?.total || 0} assignments
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <span className="badge badge-info">{c.creditUnits} Credits</span>
                <span className={`badge ${(courseStats[c.courseId]?.pct || 0) >= 65 ? "badge-done" : "badge-pending"}`}>
                  {(courseStats[c.courseId]?.pct || 0) >= 65 ? "On Track" : "Needs Work"}
                </span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(c.courseId || c.id)}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="course-card"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "200px",
            borderStyle: "dashed",
            cursor: "pointer",
            background: "#fafbff",
            border: "1px dashed #dde0ed",
          }}
          onClick={() => setModalOpen(true)}
        >
          <div style={{ textAlign: "center", color: "#9ba0b0" }}>
            <div style={{ fontSize: "28px", marginBottom: "8px" }}>+</div>
            <div style={{ fontSize: "13px", fontWeight: 500 }}>Add a course</div>
          </div>
        </button>
      </div>

      <div className={modalOpen ? "modal-overlay" : "modal-overlay hidden"} role="dialog" aria-modal="true">
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Add course</span>
            <button type="button" className="close-btn" onClick={() => setModalOpen(false)}>
              ✕
            </button>
          </div>
          <form onSubmit={handleAdd}>
            <div className="form-group">
              <label className="form-label">Course name</label>
              <input className="form-input" value={courseName} onChange={(e) => setCourseName(e.target.value)} required placeholder="Introduction to Databases" />
            </div>
            <div className="form-group">
              <label className="form-label">Credit units</label>
              <input
                className="form-input"
                type="number"
                min={1}
                max={12}
                value={creditUnits}
                onChange={(e) => setCreditUnits(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : "Add course"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
