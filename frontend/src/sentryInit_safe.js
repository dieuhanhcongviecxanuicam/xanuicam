// sentryInit_safe.js — guarded dynamic require without using eval
function initSentry(dsn, opts = {}) {
  if (!dsn) return;
  try {
    // Prefer __non_webpack_require__ when available to avoid bundler static resolution.
    const maybeRequire = (typeof __non_webpack_require__ === 'function') ? __non_webpack_require__ : require;
    const Sentry = maybeRequire('@sentry/react');
    const Tracing = maybeRequire('@sentry/tracing');

    const integrations = [];
    if (Tracing && Tracing.BrowserTracing) integrations.push(new Tracing.BrowserTracing());

    if (Sentry && Sentry.init) {
      Sentry.init(Object.assign({
        dsn,
        integrations,
        tracesSampleRate: 1.0,
      }, opts));
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Sentry init skipped:', err && err.message ? err.message : err);
    }
  }
}

// Auto-init using environment var used in this project
try {
  initSentry(process.env.REACT_APP_SENTRY_DSN || process.env.SENTRY_DSN);
} catch (e) {
  // ignore
}

module.exports = initSentry;
