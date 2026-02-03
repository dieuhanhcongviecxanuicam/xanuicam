// frontend/src/sentryInit.js
// Initialize Sentry for the frontend if REACT_APP_SENTRY_DSN is provided at build/runtime.
if (process.env.REACT_APP_SENTRY_DSN) {
  (async () => {
    try {
      // Use dynamic import so bundlers don't include Sentry in the main bundle
      const SentryModule = await import('@sentry/react');
      const TracingModule = await import('@sentry/tracing');

      // Normalize exports for different bundlers
      const Sentry = SentryModule && SentryModule.default ? SentryModule.default : SentryModule;
      const BrowserTracing = TracingModule && TracingModule.BrowserTracing ? TracingModule.BrowserTracing : TracingModule.BrowserTracing;

      if (Sentry && BrowserTracing) {
        Sentry.init({
          dsn: process.env.REACT_APP_SENTRY_DSN,
          integrations: [new BrowserTracing()],
          tracesSampleRate: 0.05,
        });
        // Optional: reduce noise in CI logs
        // console.log('Frontend Sentry initialized');
      }
    } catch (err) {
      // best-effort: if import or init fails, don't break the app
      // console.warn('Sentry init failed', err);
    }
  })();
}