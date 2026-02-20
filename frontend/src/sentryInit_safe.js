// frontend/src/sentryInit_safe.js
// Safe Sentry initializer that avoids top-level `await` to be compatible
// with stricter ESLint/parser setups used in CI builds.
function initSentry(dsn, opts = {}) {
  if (!dsn) return Promise.resolve();
  try {
    // Use dynamic import without `await` to avoid parser/runtime issues.
    return import('@sentry/react')
      .then((SentryModule) => {
        return import('@sentry/tracing').then((TracingModule) => {
          const Sentry = SentryModule && SentryModule.default ? SentryModule.default : SentryModule;
          const BrowserTracing = TracingModule && TracingModule.BrowserTracing ? TracingModule.BrowserTracing : undefined;
          try {
            const integrations = [];
            if (BrowserTracing) integrations.push(new BrowserTracing());
            Sentry.init(Object.assign({ dsn, integrations, tracesSampleRate: 0.05 }, opts));
            // best-effort console message (harmless)
            // eslint-disable-next-line no-console
            console.log('Frontend Sentry initialized (safe)');
          } catch (e) {
            // swallow Sentry init errors
          }
        });
      })
      .catch(() => {
        // ignore import/init failures — Sentry is optional
      });
  } catch (e) {
    return Promise.resolve();
  }
}

// Auto-init using environment var used in this project
(function () {
  try {
    const dsn = process.env.REACT_APP_SENTRY_DSN || process.env.SENTRY_DSN;
    if (dsn) initSentry(dsn).catch(() => {});
  } catch (e) {
    // ignore
  }
})();

export default initSentry;
