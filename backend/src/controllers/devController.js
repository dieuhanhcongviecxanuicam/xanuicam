const pool = require('../db');
const { decrypt } = require('../utils/encryption');
const speakeasy = require('speakeasy');

// Dev-only helpers (only enabled when NODE_ENV !== 'production')
exports.getMfaCodeForUser = async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ message: 'Not allowed' });
    const { username, userId } = req.query || {};
    try {
        let q = 'SELECT id, username, mfa_secret_encrypted FROM users WHERE 1=0';
        const params = [];
        if (userId) { q = 'SELECT id, username, mfa_secret_encrypted FROM users WHERE id = $1'; params.push(userId); }
        else if (username) { q = 'SELECT id, username, mfa_secret_encrypted FROM users WHERE username = $1'; params.push(username); }
        else return res.status(400).json({ message: 'username or userId required' });

        const { rows } = await pool.query(q, params);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'User not found' });
        const u = rows[0];
        if (!u.mfa_secret_encrypted) return res.status(404).json({ message: 'MFA not configured for user' });
        let secret;
        try { secret = decrypt(u.mfa_secret_encrypted); } catch (e) { return res.status(500).json({ message: 'Unable to decrypt secret' }); }
        // accept either raw base32 or url-safe - speakeasy expects base32
        const code = speakeasy.totp({ secret: secret, encoding: 'base32' });
        return res.json({ userId: u.id, username: u.username, code });
    } catch (e) {
        console.error('Dev getMfaCodeForUser error:', e && e.message ? e.message : e);
        return res.status(500).json({ message: 'Server error' });
    }
};
