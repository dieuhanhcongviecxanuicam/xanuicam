const jwt = require('jsonwebtoken');

// Allow configurable algorithm via environment variable. Default to HS256.
// HS256 (HMAC-SHA256) is recommended for symmetric secrets; choose HS512
// only if you use appropriately long secrets. Defaulting to HS256 to
// standardize production deployments.
const DEFAULT_ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';

function ensureSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('JWT_SECRET not set — generate one for production and set it in environment.');
    return null;
  }
  // Recommend secret length according to algorithm
  try {
    const buf = Buffer.from(secret, 'base64');
    const alg = (process.env.JWT_ALGORITHM || DEFAULT_ALGORITHM).toUpperCase();
    // Recommend secret sizes (bytes): HS256 -> 32, HS384 -> 48, HS512 -> 64
    const recommended = alg === 'HS256' ? 32 : (alg === 'HS384' ? 48 : 64);
    if (buf.length < recommended) {
      console.warn(`JWT_SECRET appears shorter than recommended for ${alg} — use a ${recommended}+ byte secret encoded in base64.`);
    }
  } catch (e) {
    // ignore parsing errors (secret not base64) but still warn below
  }
  return secret;
}

function getAlgorithm() {
  return (process.env.JWT_ALGORITHM || DEFAULT_ALGORITHM).toUpperCase();
}

function sign(payload, opts = {}) {
  const secret = ensureSecret() || process.env.JWT_SECRET || undefined;
  const algorithm = opts.algorithm || getAlgorithm();
  const signOpts = Object.assign({}, opts, { algorithm });
  return jwt.sign(payload, secret, signOpts);
}

function verify(token) {
  const secret = ensureSecret() || process.env.JWT_SECRET || undefined;
  const algorithm = getAlgorithm();
  return jwt.verify(token, secret, { algorithms: [algorithm] });
}

module.exports = { sign, verify, getAlgorithm };
