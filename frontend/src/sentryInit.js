// sentryInit.js — compatibility wrapper
try {
  // Prefer the safe initializer if present
  module.exports = require('./sentryInit_safe');
} catch (e) {
  // Fall back to a no-op initializer if safe file unavailable
  module.exports = function initSentry() {};
}

