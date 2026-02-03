const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Generate a secure JWT secret and a 32-byte base64 AUDIT_LOG_KEY and persist
// them into backend/.env if not already present. Do not overwrite existing values.

const envPath = path.resolve(__dirname, '..', '.env');
let env = {};
if (fs.existsSync(envPath)) {
  const data = fs.readFileSync(envPath, 'utf8');
  data.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  });
}

let changed = false;
function isPlaceholder(v) {
  if (!v) return true;
  if (v === 'true' || v === '"true"') return true;
  if (typeof v === 'string' && v.trim().startsWith('<') && v.trim().endsWith('>')) return true;
  return false;
}

if (isPlaceholder(env.JWT_SECRET)) {
  // Generate a base64-encoded 32-byte secret (recommended for HS256).
  env.JWT_SECRET = crypto.randomBytes(32).toString('base64');
  changed = true;
}
if (isPlaceholder(env.AUDIT_LOG_KEY)) {
  env.AUDIT_LOG_KEY = crypto.randomBytes(32).toString('base64');
  changed = true;
}

if (changed) {
  // Preserve other existing lines and write back keys (simple serializer)
  const outLines = [];
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
  const seen = new Set();
  for (const l of existing) {
    const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) {
      const k = m[1];
      if (k === 'JWT_SECRET') {
        outLines.push(`JWT_SECRET=${env.JWT_SECRET}`);
        seen.add(k);
        continue;
      }
      if (k === 'AUDIT_LOG_KEY') {
        outLines.push(`AUDIT_LOG_KEY=${env.AUDIT_LOG_KEY}`);
        seen.add(k);
        continue;
      }
    }
    outLines.push(l);
  }
  if (!seen.has('JWT_SECRET')) outLines.push(`JWT_SECRET=${env.JWT_SECRET}`);
  if (!seen.has('AUDIT_LOG_KEY')) outLines.push(`AUDIT_LOG_KEY=${env.AUDIT_LOG_KEY}`);

  fs.writeFileSync(envPath, outLines.join('\n'));
  console.log('Wrote missing secrets to', envPath);
} else {
  console.log('No changes required; secrets already present and valid.');
}

console.log('JWT_SECRET preview:', env.JWT_SECRET ? env.JWT_SECRET.substring(0,16) + '...' : '(none)');
console.log('AUDIT_LOG_KEY preview (base64):', env.AUDIT_LOG_KEY ? env.AUDIT_LOG_KEY.substring(0,16) + '...' : '(none)');
