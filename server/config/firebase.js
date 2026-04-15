const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

let initialized = false;

/**
 * Initializes firebase-admin with a service account JSON file.
 * Set GOOGLE_APPLICATION_CREDENTIALS in .env to the path of that file.
 */
function initFirebase() {
  if (initialized) {
    return admin;
  }

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!credPath) {
    throw new Error(
      "GOOGLE_APPLICATION_CREDENTIALS is not set. Add it to .env pointing at your Firebase service account JSON."
    );
  }

  const resolved = path.isAbsolute(credPath)
    ? credPath
    : path.join(__dirname, "..", credPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Firebase credentials file not found: ${resolved}`);
  }

  const serviceAccount = require(resolved);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

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
