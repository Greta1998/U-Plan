import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { authApi } from "../lib/api";
import { useToast } from "../context/ToastContext";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const showToast = useToast();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await authApi.register(name.trim(), email.trim(), password);
        if (!res?.data) throw new Error("Unexpected response from server");
        login(res.data);
        showToast("success", "Account created", "Welcome to U-Plan.");
      } else {
        const res = await authApi.login(email.trim(), password);
        if (!res?.data) throw new Error("Unexpected response from server");
        login(res.data);
        showToast("success", "Welcome back", res.data.name || "");
      }
      navigate("/");
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
            <div className="logo-mark">
              <svg viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span style={{ fontSize: "20px", fontWeight: 600, color: "#1a1d2e" }}>UPlan</span>
          </div>
        </div>
        <p className="login-title">{mode === "login" ? "Welcome back" : "Create account"}</p>
        <p className="login-subtitle">
          {mode === "login" ? "Sign in to your student dashboard" : "Register to start planning"}
        </p>

        {error ? (
          <div className="alert-box alert-error" style={{ display: "flex" }}>
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          {mode === "register" ? (
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Alex Student"
              />
            </div>
          ) : null}
          <div className="form-group">
            <label className="form-label">Email</label>
            <div className="input-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 7 10-7" />
              </svg>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@university.edu"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center", padding: "11px" }} disabled={loading}>
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <hr className="divider" />
        <p style={{ textAlign: "center", fontSize: "13px", color: "#9ba0b0" }}>
          {mode === "login" ? (
            <>
              Need an account?{" "}
              <button type="button" style={{ color: "#3b6ff0", background: "none", border: "none", cursor: "pointer" }} onClick={() => { setMode("register"); setError(""); }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" style={{ color: "#3b6ff0", background: "none", border: "none", cursor: "pointer" }} onClick={() => { setMode("login"); setError(""); }}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
