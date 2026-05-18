const admin = require('firebase-admin');

let initialized = false;

const isFirebaseEnabled = () => {
  return Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    process.env.FIREBASE_PROJECT_ID
  );
};

const initFirebase = () => {
  if (initialized || !isFirebaseEnabled()) return;
  let credential = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const service = JSON.parse(raw);
    if (service.private_key && service.private_key.includes('\\n')) {
      service.private_key = service.private_key.replace(/\\n/g, '\n');
    }
    credential = admin.credential.cert(service);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    credential = admin.credential.cert(require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
  } else if (process.env.FIREBASE_PROJECT_ID) {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential,
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
  initialized = true;
};

const verifyFirebaseIdToken = async (idToken) => {
  if (!idToken) return null;
  initFirebase();
  if (!initialized) return null;
  return admin.auth().verifyIdToken(idToken);
};

module.exports = { verifyFirebaseIdToken, isFirebaseEnabled };
