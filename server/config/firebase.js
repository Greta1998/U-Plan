const admin = require("firebase-admin");

let initialized = false;

function initFirebase() {
  if (!process.env.FIREBASE_CONFIG) {
    throw new Error("FIREBASE_CONFIG is not set");
  }

  const serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);

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