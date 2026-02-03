const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.resolve(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('.env not found at', envPath);
  process.exit(1);
}

const data = fs.readFileSync(envPath, 'utf8');
const env = {};
data.split(/\r?\n/).forEach(line => {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
});

const old = env.AUDIT_LOG_KEY || null;
if (!old) {
  console.error('No existing AUDIT_LOG_KEY found; use setup_env_keys.js to create one first.');
  process.exit(1);
}

const newKey = crypto.randomBytes(32).toString('base64');
env.AUDIT_LOG_KEY_PREV = old;
env.AUDIT_LOG_KEY = newKey;

// rewrite .env preserving other keys
const outLines = [];
const existing = data.split(/\r?\n/);
const seen = new Set();
for (const l of existing) {
  const m = l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) {
    const k = m[1];
    if (k === 'AUDIT_LOG_KEY') { outLines.push(`AUDIT_LOG_KEY=${env.AUDIT_LOG_KEY}`); seen.add(k); continue; }
    if (k === 'AUDIT_LOG_KEY_PREV') { outLines.push(`AUDIT_LOG_KEY_PREV=${env.AUDIT_LOG_KEY_PREV}`); seen.add(k); continue; }
  }
  outLines.push(l);
}
if (!seen.has('AUDIT_LOG_KEY_PREV')) outLines.push(`AUDIT_LOG_KEY_PREV=${env.AUDIT_LOG_KEY_PREV}`);
if (!seen.has('AUDIT_LOG_KEY')) outLines.push(`AUDIT_LOG_KEY=${env.AUDIT_LOG_KEY}`);
fs.writeFileSync(envPath, outLines.join('\n'));
console.log('Rotated AUDIT_LOG_KEY. Previous key saved to AUDIT_LOG_KEY_PREV in .env');
console.log('New AUDIT_LOG_KEY preview:', env.AUDIT_LOG_KEY.substring(0,16) + '...');
