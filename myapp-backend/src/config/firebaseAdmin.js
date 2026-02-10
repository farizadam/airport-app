const admin = require("firebase-admin");

// Initialize Firebase Admin SDK. Prefer providing credentials via
// GOOGLE_APPLICATION_CREDENTIALS env var (path to service account JSON) or
// FIREBASE_SERVICE_ACCOUNT_JSON (stringified JSON) for containers.
function initFirebaseAdmin() {
  if (admin.apps && admin.apps.length) return admin.app();

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Fix: Railway/cloud env vars convert \n to actual newlines in the JSON string,
    // which corrupts the private_key field. Replace real newlines back to \n first.
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.replace(/\n/g, '\\n');
    const serviceAccount = JSON.parse(rawJson);
    // Restore actual newlines in private_key (PEM format requires them)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // SDK will pick up GOOGLE_APPLICATION_CREDENTIALS if set
    admin.initializeApp();
  }

  return admin.app();
}

module.exports = initFirebaseAdmin();
