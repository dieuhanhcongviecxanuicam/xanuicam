const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'requests.jsonl');
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUPS = 5;
const MAX_AGE_DAYS = 30; // remove rotated logs older than 30 days

try {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (e) {
  // ignore
}

function rotateIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_BYTES) return;
    // rotate: rename existing file with timestamp suffix
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = `${LOG_FILE}.${ts}`;
    fs.renameSync(LOG_FILE, rotated);
    // cleanup old backups (keep newest MAX_BACKUPS)
    const files = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('requests.jsonl.'))
      .map(f => ({ f, p: path.join(LOG_DIR, f) }))
      .sort((a,b) => fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs);
    for (let i = MAX_BACKUPS; i < files.length; i++) {
      try { fs.unlinkSync(files[i].p); } catch(e){}
    }
    // also remove rotated files older than MAX_AGE_DAYS
    try {
      const cutoff = Date.now() - (MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      const rotatedFiles = fs.readdirSync(LOG_DIR).filter(f => f.startsWith('requests.jsonl.'));
      for (const rf of rotatedFiles) {
        try {
          const p = path.join(LOG_DIR, rf);
          const st = fs.statSync(p);
          if (st.mtimeMs < cutoff) {
            fs.unlinkSync(p);
          }
        } catch(e) {}
      }
    } catch (e) {}
  } catch (e) {
    // ignore rotation errors
  }
}

function write(obj) {
  try {
    rotateIfNeeded();
    // sanitize object to avoid storing raw IPs/sids/tokens
    const entry = sanitizeEntry(obj);
    const line = JSON.stringify(entry) + '\n';
    fs.appendFile(LOG_FILE, line, (err) => {
      if (err) {
        // fallback to console if file write fails
        console.error('[logger] write failed', err && err.message ? err.message : err);
      }
    });
  } catch (e) {
    console.error('[logger] write exception', e && e.message ? e.message : e);
  }
}

function hashIp(ip) {
  if (!ip) return null;
  try {
    // Normalize common IPv6-mapped IPv4 prefixes
    let normalized = String(ip).trim();
    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.replace('::ffff:', '');
    }
    // Use HMAC-like hashing with server secret if available to reduce rainbow risk
    const secret = process.env.LOG_HASH_SECRET || 'dev-secret';
    const h = crypto.createHmac ? crypto.createHmac('sha256', secret).update(normalized).digest('hex') : crypto.createHash('sha256').update(normalized + secret).digest('hex');
    return `h:${h.slice(0,16)}`;
  } catch (e) { return null; }
}

function maskSid(sid) {
  if (!sid) return null;
  try { return String(sid).slice(0,8) + '...'; } catch (e) { return null; }
}

function sanitizeEntry(obj) {
  const copy = Object.assign({}, obj);
  // hash ip and mask sid
  if (copy.ip) copy.ip = hashIp(copy.ip);
  if (copy.sid) copy.sid = maskSid(copy.sid);
  // remove any token-like fields if present
  if (copy.token) delete copy.token;
  if (copy.tokenPreview) delete copy.tokenPreview;
  // truncate large fields
  if (copy.details && typeof copy.details === 'string' && copy.details.length > 2000) copy.details = copy.details.slice(0,2000) + '...';
  return copy;
}

module.exports = {
  info: (obj) => {
    const entry = Object.assign({ level: 'info', timestamp: new Date().toISOString() }, obj);
    write(entry);
  },
  warn: (obj) => {
    const entry = Object.assign({ level: 'warn', timestamp: new Date().toISOString() }, obj);
    write(entry);
  },
  error: (obj) => {
    const entry = Object.assign({ level: 'error', timestamp: new Date().toISOString() }, obj);
    write(entry);
  }
};
