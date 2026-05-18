export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const isDevelopmentHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isDevMode = process.env.NODE_ENV !== 'production' || isDevelopmentHost;

  if (isDevMode) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {
        // Dev cleanup should never block the app.
      });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Keep offline support best-effort and never block the app shell.
    });
  });
};
