const { sanitizeDigits, parseIntegerOrNull, validateIntegerInRange, clampInteger } = require('./numberValidation');

describe('numberValidation', () => {
  test('sanitizeDigits removes non-digits', () => {
    expect(sanitizeDigits('123')).toBe('123');
    expect(sanitizeDigits('12a3b')).toBe('123');
    expect(sanitizeDigits('abc')).toBe('');
    expect(sanitizeDigits('')).toBe('');
  });

  test('parseIntegerOrNull returns integer or null', () => {
    expect(parseIntegerOrNull('123')).toBe(123);
    expect(parseIntegerOrNull('0123')).toBe(123);
    expect(parseIntegerOrNull('')).toBeNull();
    expect(parseIntegerOrNull(null)).toBeNull();
    expect(parseIntegerOrNull('abc')).toBeNull();
  });

  test('validateIntegerInRange enforces min and max', () => {
    expect(validateIntegerInRange(5, 1, 10).valid).toBe(true);
    expect(validateIntegerInRange(0, 1, 10).valid).toBe(false);
    expect(validateIntegerInRange(11, 1, 10).valid).toBe(false);
    expect(validateIntegerInRange(null, 1, 10).valid).toBe(false);
  });

  test('clampInteger clamps and defaults correctly', () => {
    expect(clampInteger(5, 1, 10, 1)).toBe(5);
    expect(clampInteger(0, 1, 10, 1)).toBe(1);
    expect(clampInteger(11, 1, 10, 1)).toBe(10);
    expect(clampInteger(null, 1, 10, 1)).toBe(1);
  });
});
