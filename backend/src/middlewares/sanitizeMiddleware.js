// Lightweight request sanitizer: convert empty date-like fields to null
module.exports = function sanitizeMiddleware(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      const walk = (obj) => {
        for (const k of Object.keys(obj)) {
          const v = obj[k];
          if (v && typeof v === 'object') {
            walk(v);
            continue;
          }
          // Convert empty string for date-like fields to null
          if (typeof v === 'string' && v.trim() === '' && /date|_date|birth_date|profile_last_updated_at/i.test(k)) {
            obj[k] = null;
            continue;
          }
        }
      };
      walk(req.body);
    }
  } catch (e) {
    // Non-fatal: if sanitizer fails, continue without blocking the request
    console.warn('sanitizeMiddleware failed (ignored):', e && (e.stack || e));
  }
  next();
};
