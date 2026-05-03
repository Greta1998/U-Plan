import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { fetchNavBadgeCounts } from "../lib/navBadges";

const titles = {
  "/": "Dashboard",
  "/courses": "Courses",
  "/assignments": "Assignments",
  "/schedule": "Schedule",
  "/analytics": "Analytics",
  "/notifications": "Notifications",
};

function navClass({ isActive }) {
  return `nav-item${isActive ? " active" : ""}`;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const [navBadges, setNavBadges] = useState({ pending: null, urgent: null });

  useEffect(() => {
    if (!user?.userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { pendingAssignments, notificationUnread } = await fetchNavBadgeCounts(user.userId);
        if (!cancelled) setNavBadges({ pending: pendingAssignments, urgent: notificationUnread });
      } catch {
        if (!cancelled) setNavBadges({ pending: 0, urgent: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, pathname]);

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  return (
    <>
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="logo-text">UPlan</span>
        </div>

        <div className="sidebar-section">Main</div>
        <NavLink to="/" end className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          Dashboard
        </NavLink>
        <NavLink to="/courses" className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          Courses
        </NavLink>
        <NavLink to="/assignments" className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Assignments
          {navBadges.pending != null && navBadges.pending > 0 ? (
            <span className="nav-badge">{navBadges.pending > 99 ? "99+" : navBadges.pending}</span>
          ) : null}
        </NavLink>
        <NavLink to="/schedule" className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Schedule
        </NavLink>

        <div className="sidebar-section">Insights</div>
        <NavLink to="/analytics" className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 3v18h18" />
            <path d="M18 9l-5 5-4-3-6 6" />
          </svg>
          Analytics
        </NavLink>
        <NavLink to="/notifications" className={navClass}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          Notifications
          {navBadges.urgent != null && navBadges.urgent > 0 ? (
            <span className="nav-badge nav-badge--alert">{navBadges.urgent > 99 ? "99+" : navBadges.urgent}</span>
          ) : null}
        </NavLink>

        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar">{initials}</div>
            <div className="user-info user-info--sidebar">
              <div className="name">{user?.name || "Student"}</div>
              <div className="role">Courses & scheduling</div>
            </div>
            <button
              type="button"
              className="sidebar-logout"
              title="Log out"
              aria-label="Log out"
              onClick={() => {
                logout();
                navigate("/login");
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className="app-content">
        <header className={`topbar${pathname === "/" ? " topbar--dashboard" : ""}`}>
          {pathname === "/" ? (
            <label className="search-bar search-bar--input">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input type="search" placeholder="Search anything…" aria-label="Search" />
            </label>
          ) : (
            <span className="topbar-title" id="topbarTitle">
              {titles[pathname] || "UPlan"}
            </span>
          )}
          <div className="topbar-spacer" />
          {pathname !== "/" ? (
            <label className="search-bar search-bar--compact search-bar--input">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input type="search" placeholder="Search anything…" aria-label="Search" />
            </label>
          ) : null}
          <NavLink to="/notifications" className="icon-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {navBadges.urgent != null && navBadges.urgent > 0 ? <div className="notif-dot" /> : null}
          </NavLink>
          <div className="avatar" style={{ cursor: "default" }}>
            {initials}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </>
  );
}
