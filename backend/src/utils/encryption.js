const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY_ENV = 'AUDIT_LOG_KEY';
const PREV_KEY_ENV = 'AUDIT_LOG_KEY_PREV';

let _keys = null;

function _resolveKeys() {
    if (_keys !== null) return _keys;
    _keys = [];
    const addIfValid = (raw) => {
        if (!raw) return;
        let buf = null;
        try { buf = Buffer.from(raw, 'base64'); } catch (e) { buf = null; }
        if (!buf || buf.length !== 32) buf = Buffer.from(raw).slice(0, 32);
        if (buf && buf.length === 32) _keys.push(buf);
    };
    addIfValid(process.env[KEY_ENV]);
    addIfValid(process.env[PREV_KEY_ENV]);
    return _keys;
}

function encrypt(plain) {
    if (plain == null) return null;
    const keys = _resolveKeys();
    if (!keys || keys.length === 0) {
        // Encryption not available; return null for encrypted field but still allow hashing
        return null;
    }
    const key = keys[0];
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGO, key, iv, { authTagLength: 16 });
    const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(encText) {
    if (!encText) return null;
    const keys = _resolveKeys();
    if (!keys || keys.length === 0) return null; // can't decrypt if no keys
    const data = Buffer.from(encText, 'base64');
    const iv = data.slice(0, 12);
    const tag = data.slice(12, 28);
    const cipherText = data.slice(28);
    // Try each key (primary first), return on first successful decrypt
    for (const key of keys) {
        try {
            const decipher = crypto.createDecipheriv(ALGO, key, iv, { authTagLength: 16 });
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
            return decrypted.toString('utf8');
        } catch (e) {
            // try next key
        }
    }
    return null;
}

function sha256Hex(text) {
    if (text == null) return null;
    return crypto.createHash('sha256').update(String(text)).digest('hex');
}

module.exports = { encrypt, decrypt, sha256Hex };
