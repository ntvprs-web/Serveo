const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

let admin = null;
let initialized = false;
let certCache = { certs: null, expiresAt: 0 };

function tryInitServiceAccount() {
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

  return null;
}

async function getGooglePublicCerts() {
  if (certCache.certs && Date.now() < certCache.expiresAt) {
    return certCache.certs;
  }
  const url = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to fetch Google Firebase public certificates.');
  }
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const ttlMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  const certs = await res.json();
  certCache = { certs, expiresAt: Date.now() + ttlMs };
  return certs;
}

async function verifyFirebaseIdToken(idToken) {
  const token = String(idToken || '').trim();
  if (!token) throw new Error('Firebase ID token is required.');

  // Use Admin SDK if service account credentials are provided
  const fbAdmin = tryInitServiceAccount();
  if (fbAdmin) {
    return fbAdmin.auth().verifyIdToken(token, true);
  }

  // Otherwise verify RS256 Firebase ID token directly using Google's official public X.509 certs
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) {
    const err = new Error('FIREBASE_PROJECT_ID is not configured in .env.');
    err.code = 'FIREBASE_ADMIN_NOT_CONFIGURED';
    throw err;
  }

  const decodedHeader = jwt.decode(token, { complete: true });
  const kid = decodedHeader?.header?.kid;
  if (!kid || decodedHeader?.header?.alg !== 'RS256') {
    throw new Error('Invalid Firebase token header.');
  }

  const certs = await getGooglePublicCerts();
  const publicCert = certs[kid];
  if (!publicCert) {
    throw new Error('Firebase signing key not found. Please sign in again.');
  }

  const payload = jwt.verify(token, publicCert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`
  });

  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid Firebase token subject.');
  }

  return payload;
}

module.exports = { verifyFirebaseIdToken };
