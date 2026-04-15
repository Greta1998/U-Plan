const bcrypt = require("bcryptjs");
const { getFirebaseAdmin } = require("../config/firebase");

const SALT_ROUNDS = 10;

function getAuthAndDb() {
  const admin = getFirebaseAdmin();
  return { auth: admin.auth(), db: admin.firestore(), FieldValue: admin.firestore.FieldValue };
}

/**
 * Creates Firebase Auth user and profile in Firestore (users/{uid}).
 */
async function registerUser({ name, email, password }) {
  const { auth, db, FieldValue } = getAuthAndDb();
  let userRecord;

  try {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
    });
  } catch (err) {
    throw mapAuthError(err);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      passwordHash,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    try {
      await auth.deleteUser(userRecord.uid);
    } catch {
      /* best-effort rollback */
    }
    throw err;
  }

  return {
    userId: userRecord.uid,
    name,
    email,
  };
}

/**
 * Looks up user in Firestore by email and verifies password (server-side; complements Firebase Auth).
 */
async function loginUser({ email, password }) {
  const { db } = getAuthAndDb();
  const snap = await db
    .collection("users")
    .where("email", "==", email)
    .limit(1)
    .get();

  if (snap.empty) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  const doc = snap.docs[0];
  const data = doc.data();
  const match = await bcrypt.compare(password, data.passwordHash || "");

  if (!match) {
    const err = new Error("Invalid email or password");
    err.statusCode = 401;
    err.code = "INVALID_CREDENTIALS";
    throw err;
  }

  return {
    userId: doc.id,
    name: data.name,
    email: data.email,
  };
}

function mapAuthError(err) {
  const e = new Error(err.message || "Authentication failed");
  e.statusCode = 400;
  e.code = err.code || "AUTH_ERROR";

  if (err.code === "auth/email-already-in-use") {
    e.message = "An account with this email already exists";
    e.statusCode = 409;
  } else if (err.code === "auth/invalid-email") {
    e.message = "Invalid email address";
  } else if (err.code === "auth/weak-password") {
    e.message = "Password is too weak (use at least 6 characters)";
  }

  return e;
}

module.exports = {
  registerUser,
  loginUser,
};
