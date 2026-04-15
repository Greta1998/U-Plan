const authService = require("../services/authService");
const { getFirebaseAdmin } = require("../config/firebase");

function isFirebaseReady() {
  try {
    getFirebaseAdmin();
    return true;
  } catch {
    return false;
  }
}

function validateRegisterBody(body) {
  const errors = [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) errors.push("name is required");
  if (name.length > 120) errors.push("name must be at most 120 characters");

  if (!email) errors.push("email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email must be valid");

  if (!password) errors.push("password is required");
  else if (password.length < 6) errors.push("password must be at least 6 characters");

  return { errors, name, email, password };
}

function validateLoginBody(body) {
  const errors = [];
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) errors.push("email is required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email must be valid");

  if (!password) errors.push("password is required");

  return { errors, email, password };
}

exports.register = async (req, res) => {
  if (!isFirebaseReady()) {
    return res.status(503).json({
      success: false,
      error: "Firebase is not configured on this server",
      code: "SERVICE_UNAVAILABLE",
    });
  }

  const { errors, name, email, password } = validateRegisterBody(req.body || {});
  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: errors,
    });
  }

  try {
    const user = await authService.registerUser({ name, email, password });
    return res.status(201).json({
      success: true,
      data: user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Registration failed",
      code: err.code || "REGISTER_ERROR",
    });
  }
};

exports.login = async (req, res) => {
  if (!isFirebaseReady()) {
    return res.status(503).json({
      success: false,
      error: "Firebase is not configured on this server",
      code: "SERVICE_UNAVAILABLE",
    });
  }

  const { errors, email, password } = validateLoginBody(req.body || {});
  if (errors.length) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: errors,
    });
  }

  try {
    const user = await authService.loginUser({ email, password });
    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: err.message || "Login failed",
      code: err.code || "LOGIN_ERROR",
    });
  }
};
