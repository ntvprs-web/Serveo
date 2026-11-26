const fs = require('fs');
const path = require('path');

let admin = null;
let initialized = false;

function getFirebaseAdmin() {
  if (initialized && admin) return admin;
  const firebaseAdmin = require('firebase-admin');

  if (firebaseAdmin.apps.length > 0) {
    admin = firebaseAdmin;
    initialized = true;
    return admin;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    ? path.resolve(path.join(__dirname, '..'), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
    : path.join(__dirname, 'firebase-service-account.json');

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
    admin = firebaseAdmin;
    initialized = true;
    return admin;
  }

  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    admin = firebaseAdmin;
    initialized = true;
    return admin;
  }

  const err = new Error(
    'Firebase Admin service account is not configured. Save your service account JSON at backend/firebase-service-account.json.'
  );
  err.code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
  throw err;
}

async function verifyFirebaseIdToken(idToken) {
  const fbAdmin = getFirebaseAdmin();
  return fbAdmin.auth().verifyIdToken(String(idToken || '').trim(), true);
}

module.exports = { verifyFirebaseIdToken };
