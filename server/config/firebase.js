const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

let initialized = false;

/** Pasted JSON in env often has literal `\n` in private_key; OpenSSL needs real newlines. */
function normalizePrivateKey(serviceAccount) {
  const key = serviceAccount?.private_key;
  if (typeof key === "string" && key.includes("\\n")) {
    serviceAccount.private_key = key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
}

function parseServiceAccountJson(raw) {
  const parsed = JSON.parse(raw);
  return normalizePrivateKey(parsed);
}

/** Service account: `FIREBASE_CONFIG` (JSON string, e.g. Render) or `GOOGLE_APPLICATION_CREDENTIALS` (file path). */
function resolveServiceAccount() {
  const inline = process.env.FIREBASE_CONFIG;
  if (typeof inline === "string" && inline.trim()) {
    return parseServiceAccountJson(inline.trim());
  }

  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof gac === "string" && gac.trim()) {
    const filePath = path.isAbsolute(gac.trim()) ? gac.trim() : path.join(process.cwd(), gac.trim());
    if (fs.existsSync(filePath)) {
      return parseServiceAccountJson(fs.readFileSync(filePath, "utf8"));
    }
  }

  throw new Error(
    "Set FIREBASE_CONFIG to your Firebase service account JSON string, or GOOGLE_APPLICATION_CREDENTIALS to a JSON file path.",
  );
}

function initFirebase() {
  const serviceAccount = resolveServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  initialized = true;
  return admin;
}

/**
 * Returns the firebase-admin module after initFirebase() has run.
 */
function getFirebaseAdmin() {
  if (!initialized) {
    initFirebase();
  }
  return admin;
}

module.exports = {
  initFirebase,
  getFirebaseAdmin,
  admin,
};
