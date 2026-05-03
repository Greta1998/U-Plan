import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { scheduleApi, coursesApi, assignmentsApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

const HOUR_START = 8;
const PX_PER_HOUR = 52;
/** Visual gap between sessions on the same day (matches server: max 2 sessions/day with room for a break) */
const REST_BETWEEN_SESSIONS_H = 1;

const EVENT_PALETTE = [
  { bg: "#dde6ff", color: "#2242ae" },
  { bg: "#ede9fe", color: "#5b21b6" },
  { bg: "#dcfce7", color: "#15803d" },
  { bg: "#fef3c7", color: "#92600a" },
  { bg: "#fee2e2", color: "#b91c1c" },
  { bg: "#f1f5f9", color: "#475569" },
];

function formatDateKeyLocal(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

function addCalendarDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function formatWeekRangeLabel(monday) {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const start = monday.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const end = sunday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  return `Week of ${start} – ${end}`;
}

function paletteForAssignmentId(title, sessionId, assignmentId) {
  let h = 0;
  const s = `${title || ""}:${assignmentId || ""}:${sessionId || ""}`;
  for (let i = 0; i < s.length; i += 1) {
    h = (h + s.charCodeAt(i) * (i + 1)) % 997;
  }
  return EVENT_PALETTE[h % EVENT_PALETTE.length];
}

function normalizeAssignmentStatus(s) {
  const x = String(s || "")
    .trim()
    .toLowerCase();
  return x === "completed" ? "completed" : "active";
}

function startOfTodayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

async function computeOverdueAssignable(userId, scheduleGrouped) {
  const cRes = await coursesApi.list(userId);
  const courseList = Array.isArray(cRes.data) ? cRes.data : [];
  const todayKey = formatDateKeyLocal(new Date());
  const assignmentIdsBlocked = new Set();
  Object.values(scheduleGrouped || {}).forEach((sessions) => {
    (sessions || []).forEach((sess) => {
      if (sess.status !== "planned" && sess.status !== "in-progress") return;
      if (!sess.assignmentId) return;
      if (sess.status === "planned" && sess.date && sess.date < todayKey) return;
      assignmentIdsBlocked.add(sess.assignmentId);
    });
  });
  let overdue = 0;
  const startToday = startOfTodayLocal().getTime();
  for (const course of courseList) {
    const aRes = await assignmentsApi.byCourse(course.courseId);
    const rows = Array.isArray(aRes.data) ? aRes.data : [];
    for (const a of rows) {
      if (normalizeAssignmentStatus(a.status) === "completed") continue;
      const dueTs = Date.parse(a.deadline);
      if (!Number.isFinite(dueTs)) continue;
      if (dueTs >= startToday) continue;
      if (!assignmentIdsBlocked.has(a.assignmentId)) overdue += 1;
    }
  }
  return overdue;
}

function layoutDaySessions(sessions) {
  const sorted = [...sessions].sort((a, b) => String(a.sessionId).localeCompare(String(b.sessionId)));
  let cursor = HOUR_START;
  return sorted.map((s, i) => {
    const dur = Math.min(Math.max(Number(s.plannedDuration) || 1, 0.5), 12);
    if (i > 0) cursor += REST_BETWEEN_SESSIONS_H;
    const startHour = cursor;
    cursor += dur;
    const assignmentTitle = s.assignmentTitle || s.title || "Study session";
    return { ...s, startHour, duration: dur, assignmentTitle };
  });
}

export default function Schedule() {
  const { user } = useAuth();
  const showToast = useToast();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [grouped, setGrouped] = useState({});
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [overdueAssignable, setOverdueAssignable] = useState(null);

  const refreshOverdueAssignable = useCallback(
    async (scheduleGroupedMap) => {
      if (!user?.userId) return;
      try {
        const n = await computeOverdueAssignable(user.userId, scheduleGroupedMap);
        setOverdueAssignable(n);
      } catch {
        setOverdueAssignable(null);
      }
    },
    [user?.userId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingInitial(true);
      try {
        const res = await scheduleApi.get(user.userId);
        const data = res?.data != null && typeof res.data === "object" ? res.data : {};
        if (!cancelled) setGrouped(data);
      } catch {
        if (!cancelled) setGrouped({});
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.userId]);

  const weekAnchor = useMemo(() => new Date(), []);

  const weekInfo = useMemo(() => {
    const monday = startOfWeekMonday(weekAnchor);
    const weekDays = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addCalendarDays(monday, i);
      weekDays.push({
        date: d,
        dateKey: formatDateKeyLocal(d),
        weekdayShort: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
        dayNum: d.getDate(),
      });
    }

    return {
      weekDays,
      weekLabel: formatWeekRangeLabel(monday),
    };
  }, [weekAnchor]);

  useEffect(() => {
    refreshOverdueAssignable(grouped);
  }, [refreshOverdueAssignable, grouped]);

  useEffect(() => {
    if (!weekInfo?.weekDays?.length) return;
    const todayKey = formatDateKeyLocal(new Date());
    const match = weekInfo.weekDays.find((w) => w.dateKey === todayKey);
    setSelectedDayKey(match ? todayKey : weekInfo.weekDays[0].dateKey);
  }, [weekInfo]);

  const gridModel = useMemo(() => {
    if (!weekInfo) {
      return { columns: [[], [], [], [], []], displayEndHour: 17 };
    }
    const columns = [[], [], [], [], []];
    let maxEnd = HOUR_START + 9;

    weekInfo.weekDays.slice(0, 5).forEach((wd, colIdx) => {
      const raw = grouped[wd.dateKey] || [];
      const laid = layoutDaySessions(raw);
      const withMeta = laid.map((s) => ({
        ...s,
        dateKey: wd.dateKey,
      }));
      columns[colIdx] = withMeta;
      withMeta.forEach((s) => {
        const end = s.startHour + s.duration;
        if (end > maxEnd) maxEnd = end;
      });
    });

    const displayEndHour = Math.max(17, Math.ceil(maxEnd));
    return { columns, displayEndHour };
  }, [grouped, weekInfo]);

  const hourLabels = useMemo(() => {
    const end = gridModel.displayEndHour;
    const out = [];
    for (let h = HOUR_START; h < end; h += 1) {
      out.push(h);
    }
    return out;
  }, [gridModel.displayEndHour]);

  function handleDayPillClick(d) {
    setSelectedDayKey(d.dateKey);
    const dow = d.date.getDay();
    if (dow >= 1 && dow <= 5) {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`schedule-col-${d.dateKey}`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      });
    }
  }

  async function generate() {
    setGenerating(true);
    try {
      const res = await scheduleApi.generate(user.userId);
      const next = res?.data && typeof res.data === "object" ? res.data : {};
      setGrouped(next);
      const n = res.meta?.generatedCount ?? 0;
      showToast(
        "success",
        "Schedule generated",
        n === 0 ? "No new sessions — work may already be planned (including overdue slots)." : `${n} new session(s) added.`,
      );
      await refreshOverdueAssignable(next);
    } catch (e) {
      showToast("error", "Schedule failed", e.message);
    } finally {
      setGenerating(false);
    }
  }

  function exportPdf() {
    window.print();
  }

  const gridHeight = (gridModel.displayEndHour - HOUR_START) * PX_PER_HOUR;

  const hasAnySessions = useMemo(() => Object.values(grouped).some((arr) => Array.isArray(arr) && arr.length > 0), [grouped]);

  return (
    <div className="schedule-page">
      <div className="schedule-page-header">
        <div>
          <h1 className="schedule-weekly-title">Weekly Schedule</h1>
          {weekInfo ? <p className="schedule-week-range">{weekInfo.weekLabel}</p> : null}
        </div>
        <div className="schedule-toolbar-actions">
          <button type="button" className="btn btn-outline schedule-btn-export" onClick={exportPdf} disabled={!weekInfo || generating || loadingInitial}>
            Export PDF
          </button>
          <button type="button" className="btn btn-primary schedule-btn-generate" onClick={generate} disabled={generating || loadingInitial}>
            {generating ? (
              "Generating…"
            ) : (
              <>
                <svg className="schedule-sparkle" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 3l1.48 5.02L18 12l-4.52 3.98L12 21l-1.48-5.02L6 12l4.52-3.98L12 3z" />
                </svg>
                Generate Schedule
              </>
            )}
          </button>
        </div>
      </div>

      {overdueAssignable != null && overdueAssignable > 0 ? (
        <div className="schedule-overdue-banner" role="status">
          <div>
            <strong>{overdueAssignable}</strong> overdue assignment{overdueAssignable !== 1 ? "s" : ""} need{overdueAssignable === 1 ? "s" : ""} time this week.
            <span className="schedule-overdue-banner__hint"> Generate Schedule places them first (past planned blocks no longer block new slots).</span>
          </div>
          <button type="button" className="btn btn-primary btn-sm schedule-overdue-cta" onClick={generate} disabled={generating || loadingInitial}>
            {generating ? "Working…" : "Reschedule overdue"}
          </button>
        </div>
      ) : null}

      {loadingInitial && <div className="card empty-hint schedule-loading-hint">Loading your schedule…</div>}

      {weekInfo ? (
        <>
          <div className="schedule-day-pills schedule-day-pills--weekly" role="tablist" aria-label="Week days">
            {weekInfo.weekDays.map((d) => (
              <button
                key={d.dateKey}
                type="button"
                role="tab"
                aria-selected={selectedDayKey === d.dateKey}
                className={`schedule-day-pill${selectedDayKey === d.dateKey ? " schedule-day-pill--active" : ""}`}
                onClick={() => handleDayPillClick(d)}
              >
                <div className="schedule-day-pill__dow">{d.weekdayShort}</div>
                <div className="schedule-day-pill__num">{d.dayNum}</div>
              </button>
            ))}
          </div>
          <div className="card schedule-grid-card schedule-grid-card--scroll schedule-grid-card--mock">
            {!hasAnySessions && !loadingInitial ? (
              <div className="schedule-empty-overlay">No sessions yet — use Generate Schedule to build from your assignments.</div>
            ) : null}
            <div className="schedule-grid-header">
              <div className="schedule-grid-corner" />
              {weekInfo.weekDays.slice(0, 5).map((d) => (
                <div
                  key={d.dateKey}
                  id={`schedule-head-${d.dateKey}`}
                  className={`sched-header${selectedDayKey === d.dateKey ? " sched-header--selected" : ""}`}
                >
                  {d.date.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
              ))}
            </div>

            <div className="schedule-grid-body">
              <div className="schedule-time-gutter" style={{ minHeight: gridHeight }}>
                {hourLabels.map((h) => (
                  <div key={h} className="sched-time" style={{ height: PX_PER_HOUR }}>
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {gridModel.columns.map((col, colIdx) => {
                const wd = weekInfo.weekDays[colIdx];
                const selected = selectedDayKey === wd.dateKey;
                return (
                  <div
                    key={wd.dateKey}
                    id={`schedule-col-${wd.dateKey}`}
                    className={`schedule-day-column${selected ? " schedule-day-column--selected" : ""}`}
                    style={{
                      minHeight: gridHeight,
                      height: gridHeight,
                      backgroundImage: `repeating-linear-gradient(to bottom, #fff 0, #fff ${PX_PER_HOUR - 1}px, #eceef5 ${PX_PER_HOUR - 1}px, #eceef5 ${PX_PER_HOUR}px)`,
                    }}
                  >
                    {col.map((s) => {
                      const pal = paletteForAssignmentId(s.assignmentTitle, s.sessionId, s.assignmentId);
                      const top = (s.startHour - HOUR_START) * PX_PER_HOUR;
                      const h = s.duration * PX_PER_HOUR;
                      return (
                        <div
                          key={s.sessionId}
                          className="sched-event sched-event--mock schedule-event--abs"
                          style={{
                            top,
                            height: h,
                            background: pal.bg,
                            color: pal.color,
                          }}
                          title={`${s.assignmentTitle} · ${s.plannedDuration}h · ${s.status}`}
                        >
                          <span className="sched-event-title">{s.assignmentTitle}</span>
                          <span className="sched-event-meta">
                            {s.plannedDuration}h · {s.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
