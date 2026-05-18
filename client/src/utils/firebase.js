import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

let app;
let auth;
let recaptchaVerifier;
let recaptchaWidgetId = null;

const formatFirebaseError = (error) => {
  const code = String(error?.code || '').replace(/^auth\//, '').replace(/-/g, ' ');
  const responseMessage = error?.customData?._tokenResponse?.error?.message;
  const rawMessage = error?.message || responseMessage || 'Failed to send OTP';
  const cleanedMessage = String(rawMessage)
    .replace(/^Firebase:\s*Error\s*\((.+?)\)\.?$/i, '$1')
    .replace(/^auth\//, '')
    .replace(/-/g, ' ');

  return {
    code: error?.code || null,
    message: cleanedMessage || code || 'Failed to send OTP',
  };
};

export const isFirebaseConfigured = () => {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);
};

const ensureRecaptchaContainer = (containerId) => {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(containerId);
  if (!el) {
    el = document.createElement('div');
    el.id = containerId;
    el.setAttribute('data-managed-by', 'firebase-phone-auth');
    document.body.appendChild(el);
  }
  el.style.position = 'fixed';
  el.style.left = '-10000px';
  el.style.top = '0';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.opacity = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '-1';
  return el;
};

const getFirebaseAuth = () => {
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
};

const clearRecaptcha = () => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {}
  }
  recaptchaVerifier = null;
  recaptchaWidgetId = null;
};

export const setupRecaptcha = (containerId) => {
  const authInstance = getFirebaseAuth();
  const containerEl = ensureRecaptchaContainer(containerId);
  if (!containerEl) return null;
  clearRecaptcha();
  containerEl.innerHTML = '';
  // Firebase v10 expects (auth, container, params)
  recaptchaVerifier = new RecaptchaVerifier(authInstance, containerEl, { size: 'invisible' });
  return recaptchaVerifier;
};

export const sendFirebaseOtp = async (phone, containerId) => {
  const authInstance = getFirebaseAuth();
  const verifier = setupRecaptcha(containerId);
  if (!verifier) {
    throw new Error('Recaptcha not ready');
  }
  try {
    recaptchaWidgetId = await verifier.render();
    return await signInWithPhoneNumber(authInstance, phone, verifier);
  } catch (error) {
    if (typeof window !== 'undefined' && window.grecaptcha && recaptchaWidgetId !== null) {
      try {
        window.grecaptcha.reset(recaptchaWidgetId);
      } catch {}
    }
    throw formatFirebaseError(error);
  }
};

export const confirmFirebaseOtp = async (confirmationResult, code) => {
  try {
    const result = await confirmationResult.confirm(code);
    const token = await result.user.getIdToken();
    return { token, phone: result.user.phoneNumber };
  } catch (error) {
    throw formatFirebaseError(error);
  }
};
