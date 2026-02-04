// frontend/src/sentryInit.js
// Initialize Sentry for the frontend if SENTRY_DSN is provided at build/runtime.
try {
  if (process.env.REACT_APP_SENTRY_DSN) {
    // eslint-disable-next-line global-require
    const Sentry = require('@sentry/react');
    const { BrowserTracing } = require('@sentry/tracing');
    Sentry.init({
      dsn: process.env.REACT_APP_SENTRY_DSN,
      integrations: [new BrowserTracing()],
      tracesSampleRate: 0.05,
    });
    console.log('Frontend Sentry initialized');
  }
} catch (e) {
  // best-effort
}
