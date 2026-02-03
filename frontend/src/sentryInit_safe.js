// sentryInit_safe.js — guarded dynamic require without using eval
function initSentry(dsn, opts = {}) {
  if (!dsn) return;
  try {
    // Prefer __non_webpack_require__ when available to avoid bundler static resolution.
      const SentryModule = await import('@sentry/react');
      const TracingModule = await import('@sentry/tracing');
      const Sentry = SentryModule && SentryModule.default ? SentryModule.default : SentryModule;
      const Tracing = TracingModule && TracingModule.BrowserTracing ? TracingModule : TracingModule;

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
  (function(){
    try {
      const dsn = process.env.REACT_APP_SENTRY_DSN || process.env.SENTRY_DSN;
      if (dsn) initSentry(dsn).catch(()=>{});
    } catch (e) {
      // ignore
    }
  })();

  export default initSentry;

module.exports = initSentry;
