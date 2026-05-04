const BASE = import.meta.env.VITE_API_URL || "https://your-backend.onrender.com";
/**
 * JSON API helper. Backend returns { success, data?, error?, details? }.
 */
export async function api(path, options = {}) {
  const { method = "GET", body } = options;
  const headers = { "Content-Type": "application/json", ...options.headers };

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();

  if (/^\s*<!doctype html>/i.test(text)) {
    throw new Error("API returned HTML instead of JSON. Check VITE_API_URL and server routes.");
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON response from server");
  }

  if (!res.ok) {
    const err = new Error(data.error || res.statusText || "Request failed");
    err.status = res.status;
    err.details = data.details;
    err.code = data.code;
    throw err;
  }

  return data;
}

export function getBaseUrl() {
  return BASE;
}

export const authApi = {
  login: (email, password) =>
    api("/auth/login", { method: "POST", body: { email, password } }),
  register: (name, email, password) =>
    api("/auth/register", { method: "POST", body: { name, email, password } }),
};

export const coursesApi = {
  list: (userId) => api(`/courses/${encodeURIComponent(userId)}`),
  create: (payload) => api("/courses", { method: "POST", body: payload }),
  remove: (courseId) => api(`/courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }),
};

export const assignmentsApi = {
  byCourse: (courseId) => api(`/assignments/${encodeURIComponent(courseId)}`),
  create: (payload) => api("/assignments", { method: "POST", body: payload }),
  updateStatus: (assignmentId, status) =>
    api(`/assignments/${encodeURIComponent(assignmentId)}`, { method: "PUT", body: { status } }),
};

export const scheduleApi = {
  get: (userId) => api(`/schedule/user/${encodeURIComponent(userId)}`),
  generate: (userId) => api("/schedule/generate", { method: "POST", body: { userId } }),
};

export const studySessionApi = {
  start: (sessionId) => api("/study-session/start", { method: "POST", body: { sessionId } }),
  end: (sessionId) => api("/study-session/end", { method: "POST", body: { sessionId } }),
  breakStart: (sessionId) =>
    api("/study-session/break/start", { method: "POST", body: { sessionId } }),
  breakEnd: (sessionId) =>
    api("/study-session/break/end", { method: "POST", body: { sessionId } }),
};

export const analyticsApi = {
  get: (userId) => api(`/analytics/${encodeURIComponent(userId)}`),
};
