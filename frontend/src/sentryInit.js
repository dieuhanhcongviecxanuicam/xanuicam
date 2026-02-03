// sentryInit.js — guarded runtime require to avoid bundler resolution errors
function initSentry(dsn, opts = {}) {
  if (!dsn) return;
  let Sentry, Tracing;
  try {
    const req = eval(require);
    Sentry = req(@sentry/react);
    Tracing = req(@sentry/tracing);
  } catch (e) {
    // Sentry packages not installed — skip initialization in this environment
    if (process.env.NODE_ENV !== production) {
      // eslint-disable-next-line no-console
      console.warn(Sentry
