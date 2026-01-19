// Utility helpers for integer validation and clamping
function sanitizeDigits(raw) {
  if (raw === null || typeof raw === 'undefined') return '';
  return String(raw).replace(/\D+/g, '');
}

function parseIntegerOrNull(raw) {
  if (raw === '' || raw === null || typeof raw === 'undefined') return null;
  const cleaned = sanitizeDigits(raw);
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

function validateIntegerInRange(n, min, max) {
  if (n === null) return { valid: false, message: `Phải là số nguyên${typeof min !== 'undefined' ? ` ≥ ${min}` : ''}${typeof max !== 'undefined' ? ` và ≤ ${max}` : ''}.` };
  if (!Number.isInteger(n)) return { valid: false, message: 'Phải là số nguyên.' };
  if (typeof min !== 'undefined' && n < min) return { valid: false, message: `Phải là số nguyên ≥ ${min}.` };
  if (typeof max !== 'undefined' && n > max) return { valid: false, message: `Phải là số nguyên ≤ ${max}.` };
  return { valid: true, message: null };
}

function clampInteger(n, min, max, defaultVal) {
  if (n === null) return defaultVal;
  let v = Number(n);
  if (!Number.isFinite(v)) return defaultVal;
  v = Math.floor(v);
  if (typeof min !== 'undefined' && v < min) v = min;
  if (typeof max !== 'undefined' && v > max) v = max;
  return v;
}

module.exports = { sanitizeDigits, parseIntegerOrNull, validateIntegerInRange, clampInteger };
