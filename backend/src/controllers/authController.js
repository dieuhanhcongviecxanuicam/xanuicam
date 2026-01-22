// ubndxanuicam/backend/src/controllers/authController.js
// VERSION 2.1 - INTEGRATED AUDIT LOGGER

const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logActivity = require('../utils/auditLogger'); // Tích hợp tiện ích ghi nhật ký
const { encrypt, decrypt, sha256Hex } = require('../utils/encryption');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../utils/logger');

// Login debug log helper (dev/troubleshooting)
const LOGIN_DEBUG_PATH = path.join(__dirname, '..', '..', 'logs', 'login_debug.log');
const writeLoginDebug = (entry) => {
    try {
        const line = JSON.stringify(Object.assign({ ts: new Date().toISOString() }, entry)) + '\n';
        fs.appendFileSync(LOGIN_DEBUG_PATH, line, { encoding: 'utf8' });
    } catch (e) {
        try { console.warn('Could not write login_debug.log', e && e.message ? e.message : e); } catch (e2) {}
    }
};

// Rate limiter configuration (can use Redis for multi-instance safety)
const { getClient } = require('../utils/redisClient');
// In-memory fallback map when Redis is not configured/available
const logoutOtherAttempts = new Map();
const LOGOUT_OTHER_MAX_ATTEMPTS = Number(process.env.LOGOUT_OTHER_MAX_ATTEMPTS || 5);
const LOGOUT_OTHER_WINDOW_MS = Number(process.env.LOGOUT_OTHER_WINDOW_MS || (10 * 60 * 1000)); // 10 minutes default
const LOGOUT_OTHER_BLOCK_MS = Number(process.env.LOGOUT_OTHER_BLOCK_MS || (15 * 60 * 1000)); // 15 minutes default

// In-memory attempts tracker for session credential endpoints (fallback if Redis not configured)
const sessionCredentialAttempts = new Map();
const SESSION_CRED_MAX_ATTEMPTS = Number(process.env.SESSION_CRED_MAX_ATTEMPTS || 6);
const SESSION_CRED_WINDOW_MS = Number(process.env.SESSION_CRED_WINDOW_MS || (10 * 60 * 1000));
const SESSION_CRED_BLOCK_MS = Number(process.env.SESSION_CRED_BLOCK_MS || (15 * 60 * 1000));

// Helper functions to use Redis when available, with in-memory fallback
const checkSessionCredentialBlocked = async (rawKey) => {
    const key = `session_cred:${String(rawKey).toLowerCase()}`;
    try {
        const rclient = getClient();
        if (rclient) {
            const blockedVal = await rclient.get(`${key}:blocked`);
            if (blockedVal) {
                const blockedUntil = Number(blockedVal) || 0;
                const now = Date.now();
                if (now < blockedUntil) return Math.ceil((blockedUntil - now) / 1000);
                // expired -> cleanup
                await rclient.del(`${key}:blocked`);
                await rclient.del(key);
            }
            return 0;
        }
    } catch (e) {
        console.warn('checkSessionCredentialBlocked: redis error, falling back to in-memory', e && e.message ? e.message : e);
    }
    // fallback
    try {
        const entry = sessionCredentialAttempts.get(String(rawKey).toLowerCase()) || { count: 0, firstAt: Date.now(), blockedUntil: 0 };
        const now = Date.now();
        if (entry.blockedUntil && now < entry.blockedUntil) return Math.ceil((entry.blockedUntil - now) / 1000);
    } catch (e) {}
    return 0;
};

const recordSessionCredentialFailure = async (rawKey) => {
    const key = `session_cred:${String(rawKey).toLowerCase()}`;
    const now = Date.now();
    try {
        const rclient = getClient();
        if (rclient) {
            const count = await rclient.incr(key);
            const ttl = await rclient.pttl(key);
            if (ttl === -1 || ttl === -2) {
                await rclient.pexpire(key, SESSION_CRED_WINDOW_MS);
            }
            if (Number(count) >= SESSION_CRED_MAX_ATTEMPTS) {
                const blockedUntil = now + SESSION_CRED_BLOCK_MS;
                await rclient.set(`${key}:blocked`, String(blockedUntil), 'PX', SESSION_CRED_BLOCK_MS);
            }
            const blockedVal = await rclient.get(`${key}:blocked`);
            if (blockedVal) {
                const blockedUntil = Number(blockedVal) || 0;
                if (now < blockedUntil) return Math.ceil((blockedUntil - now) / 1000);
            }
            return 0;
        }
    } catch (e) {
        console.warn('recordSessionCredentialFailure: redis error, falling back to in-memory', e && e.message ? e.message : e);
    }
    // fallback in-memory logic
    try {
        const keySimple = String(rawKey).toLowerCase();
        const entry = sessionCredentialAttempts.get(keySimple) || { count: 0, firstAt: now, blockedUntil: 0 };
        if (now - (entry.firstAt || now) > SESSION_CRED_WINDOW_MS) {
            entry.count = 0; entry.firstAt = now; entry.blockedUntil = 0;
        }
        entry.count = (entry.count || 0) + 1;
        if (entry.count >= SESSION_CRED_MAX_ATTEMPTS) entry.blockedUntil = now + SESSION_CRED_BLOCK_MS;
        sessionCredentialAttempts.set(keySimple, entry);
        if (entry.blockedUntil && now < entry.blockedUntil) return Math.ceil((entry.blockedUntil - now) / 1000);
    } catch (e) {}
    return 0;
};

const clearSessionCredentialAttempts = async (rawKey) => {
    const key = `session_cred:${String(rawKey).toLowerCase()}`;
    try {
        const rclient = getClient();
        if (rclient) {
            await rclient.del(key);
            await rclient.del(`${key}:blocked`);
            return;
        }
    } catch (e) {
        console.warn('clearSessionCredentialAttempts: redis error, falling back to in-memory', e && e.message ? e.message : e);
    }
    try { sessionCredentialAttempts.delete(String(rawKey).toLowerCase()); } catch (e) {}
};

/**
 * @description Xóa tệp một cách an toàn.
 * @param {string} filePath - Đường dẫn tương đối của tệp từ thư mục gốc backend.
 */
const deleteFile = (filePath) => {
    if (filePath) {
        const fullPath = path.join(__dirname, '..', '..', filePath);
        fs.unlink(fullPath, (err) => {
            if (err) console.error(`Lỗi khi xóa tệp ${filePath}:`, err);
        });
    }
};

/**
 * @description Chuyển đổi số sang chữ số La Mã để hiển thị cấp bậc vai trò.
 * @param {number} num - Số nguyên cần chuyển đổi.
 * @returns {string} - Chuỗi La Mã tương ứng.
 */
const toRoman = (num) => {
    if (isNaN(num) || num < 1) return '';
    const map = { M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1 };
    let result = '';
    for (const key in map) {
        result += key.repeat(Math.floor(num / map[key]));
        num %= map[key];
    }
    return result;
};

/**
 * @route   POST /api/auth/login
 * @desc    Xác thực người dùng và trả về token
 * @access  Public
 */
exports.login = async (req, res) => {
    const { identifier, password } = req.body;
    
    try {
        const userQuery = `
            SELECT 
            u.id, u.password_hash, u.is_active, u.failed_attempts,
            u.is_superadmin, u.must_reset_password,
            u.mfa_enabled, u.mfa_secret_encrypted,
            u.full_name, u.username, u.cccd, u.birth_date, 
                u.phone_number, u.email, u.avatar,
                r.id as role_id, r.role_name, r.color as role_color, r.level as role_level,
                d.name as department_name,
                ARRAY_AGG(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL) as permissions
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE (u.cccd = $1 OR u.username = $1)
            GROUP BY u.id, r.id, d.id, u.failed_attempts
        `;
        const { rows } = await pool.query(userQuery, [identifier]);
        const user = rows[0];

        if (!user) {
            // Log failed attempt without userId (username provided)
            try { await logActivity(pool, { username: identifier, status: 'failure', reason: 'User not found', module: 'Auth', action: 'Login' }); } catch(e){}
            return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác.' });
        }

            if (!user.is_active) {
                // log the failing request for diagnostics
                try { writeLoginDebug({ reason: 'user_inactive', identifier, headers: req.headers, body: req.body }); } catch (e) {}
                return res.status(403).json({ message: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên để mở khóa.' });
            }

            // Defensive: if account is active but failed_attempts is unexpectedly high
            // (e.g. > =5) due to prior state, reset it to 0 so the user doesn't get
            // immediately re-locked on the next failed attempt after an admin unlock.
            if (user.is_active && Number(user.failed_attempts || 0) >= 5) {
                try {
                    await pool.query('UPDATE users SET failed_attempts = 0, updated_at = NOW() WHERE id = $1', [user.id]);
                    user.failed_attempts = 0;
                } catch (e) {
                    console.error('Could not reset stale failed_attempts for user on login:', e && e.message ? e.message : e);
                }
            }

        // MFA-only flow: verify TOTP without password. The client must provide identifier + mfaToken.
        // Also treat requests that include `mfaToken` but no `password` as MFA-only (some clients omit a flag).
        if (req.body && (req.body.mfaOnly || (req.body.mfaToken && !password))) {
            const tokenMfa = req.body?.mfaToken || null;
            if (!user.mfa_enabled) {
                return res.status(400).json({ message: 'Tài khoản chưa kích hoạt MFA.' });
            }
            if (!tokenMfa) {
                return res.status(400).json({ message: 'Thiếu mã MFA.' });
            }
            try {
                const secretEnc = user.mfa_secret_encrypted;
                const secret = secretEnc ? decrypt(secretEnc) : null;
                // accept small clock skew; window=1 is already permissive; keep it but safeguard types
                const verified = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token: String(tokenMfa), window: 1 }) : false;
                if (!verified) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });

                // Reset failed attempts on success
                if (user.failed_attempts && user.failed_attempts > 0) {
                    try { await pool.query('UPDATE users SET failed_attempts = 0, updated_at = NOW() WHERE id = $1', [user.id]); } catch(e){}
                }

                // Create session and token (reuse logic below)
                const sessionId = crypto.randomUUID();
                try {
                    const clientDevice = req.body?.device || {};
                    const uaRaw = clientDevice.userAgent || req.headers['user-agent'] || null;
                    const platform = clientDevice.platform || null;
                    const screenInfo = clientDevice.screen || null;
                    const ipRaw = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection?.remoteAddress || null;
                    const uaEnc = uaRaw ? encrypt(uaRaw) : null;
                    const uaHash = uaRaw ? sha256Hex(uaRaw) : null;
                    const ipEnc = ipRaw ? encrypt(ipRaw) : null;
                    const ipHash = ipRaw ? sha256Hex(ipRaw) : null;
                    await pool.query(
                        `INSERT INTO sessions (session_id, user_id, user_agent_encrypted, ua_hash, ip_encrypted, ip_hash, device_type, os)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                        [sessionId, user.id, uaEnc, uaHash, ipEnc, ipHash, clientDevice.deviceType || (platform ? (platform.includes('Win') ? 'Desktop' : 'Unknown') : null), clientDevice.platform || platform]
                    );
                    // Attempt to enrich IP -> geo/ISP info and persist to session
                    try {
                        const { enrichIp } = require('../utils/geo');
                        const geoInfo = await enrichIp(ipRaw);
                        if (geoInfo) {
                            try { await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_geo_json TEXT"); } catch(e){}
                            try { await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_isp TEXT"); } catch(e){}
                            await pool.query('UPDATE sessions SET device_geo_json = $1, device_isp = $2 WHERE session_id = $3', [JSON.stringify(geoInfo), geoInfo.isp || null, sessionId]);
                        }
                    } catch (geoErr) {
                        console.warn('Could not enrich IP/geo for session:', geoErr && geoErr.message ? geoErr.message : geoErr);
                    }
                    // store optional fingerprint and metadata if client provided richer metadata
                    try {
                        if (clientDevice && clientDevice.metadata && typeof clientDevice.metadata === 'object') {
                            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT");
                            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_metadata_json TEXT");
                            const ordered = Object.keys(clientDevice.metadata).sort().reduce((o,k)=>{o[k]=clientDevice.metadata[k];return o;},{ });
                            // Prefer client-provided fingerprint (already sha256 hex of ordered metadata) if present
                            const fpHash = clientDevice.fingerprint && typeof clientDevice.fingerprint === 'string' ? String(clientDevice.fingerprint) : sha256Hex(JSON.stringify(ordered));
                            await pool.query('UPDATE sessions SET device_fingerprint_hash = $1, device_metadata_json = $2 WHERE session_id = $3', [fpHash, JSON.stringify(ordered), sessionId]);
                        } else if (clientDevice && clientDevice.fingerprint) {
                            // store fingerprint even if metadata absent
                            try { await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT"); } catch(e){}
                            await pool.query('UPDATE sessions SET device_fingerprint_hash = $1 WHERE session_id = $2', [String(clientDevice.fingerprint), sessionId]);
                        }
                    } catch (fpErr) {
                        console.warn('Could not store device fingerprint/metadata (mfa-only):', fpErr && fpErr.message ? fpErr.message : fpErr);
                    }
                } catch (err) {
                    console.error('Không thể tạo session (MFA-only):', err && err.message ? err.message : err);
                }

                let finalPermissions = user.permissions || [];
                if (finalPermissions.includes('full_access')) {
                    const allPermsRes = await pool.query('SELECT permission_name FROM permissions');
                    finalPermissions = allPermsRes.rows.map(p => p.permission_name);
                }

                const payload = {
                    user: {
                        id: user.id,
                        username: user.username,
                        fullName: user.full_name,
                        avatar: user.avatar,
                        role: user.role_name,
                        department: user.department_name,
                        permissions: [...new Set(finalPermissions)]
                    },
                    sid: sessionId
                };
                payload.user.is_superadmin = !!user.is_superadmin;
                payload.user.must_reset_password = !!user.must_reset_password;

                const jwtHelper = require('../utils/jwtHelper');
                const token = jwtHelper.sign(payload, { expiresIn: '24h' });
                try { await logActivity(pool, { userId: user.id, username: user.username, status: 'success', module: 'Auth', action: 'MFA Login', sessionId, ip: ipRaw }); } catch(e){}
                return res.json({ token, user: payload.user, sessionId });
            } catch (e) {
                console.error('Lỗi khi xử lý MFA-only login:', e);
                return res.status(500).json({ message: 'Lỗi xác thực MFA.' });
            }
        }

        // If the request does not contain a password or an MFA token, reject early
        if (!password && !req.body?.mfaToken && !req.body?.mfaOnly) {
            console.warn('Login attempt missing password and MFA token for identifier:', identifier);
            return res.status(400).json({ message: 'Thiếu mật khẩu hoặc mã MFA.' });
        }

        // Allow superadmin secret login when configured
        const SUPERADMIN_SECRET = process.env.SUPERADMIN_SECRET || null;
        let usedSecret = false;

        // Defensive bcrypt.compare: ensure password and hash are defined and strings
        let isMatch = false;
        try {
            if (user.is_superadmin && SUPERADMIN_SECRET && password && password === SUPERADMIN_SECRET) {
                isMatch = true;
                usedSecret = true;
                try { await pool.query('UPDATE users SET must_reset_password = TRUE WHERE id = $1', [user.id]); } catch(e){}
            } else if (typeof password === 'string' && user.password_hash) {
                isMatch = await bcrypt.compare(password, user.password_hash);
            } else {
                // missing password or hash; do not throw, treat as non-match
                isMatch = false;
            }
        } catch (bcryptErr) {
            console.error('Error during bcrypt.compare:', bcryptErr && (bcryptErr.stack || bcryptErr));
            isMatch = false;
        }

        if (!isMatch) {
            try {
                const newFailed = (user.failed_attempts || 0) + 1;
                if (newFailed >= 5) {
                    // lock account permanently until admin unlocks
                    try { writeLoginDebug({ reason: 'account_locked_due_to_failed_attempts', identifier, headers: req.headers, body: req.body, failedAttempts: newFailed }); } catch (e) {}
                    await pool.query('UPDATE users SET failed_attempts = $1, is_active = FALSE, updated_at = NOW() WHERE id = $2', [newFailed, user.id]);
                    try { await logActivity(pool, { userId: user.id, username: user.username, status: 'locked', reason: 'Too many failed attempts', module: 'Auth', action: 'Account Locked' }); } catch(e){}
                    return res.status(403).json({ message: 'Tài khoản đã bị khóa do đăng nhập sai 5 lần. Vui lòng liên hệ quản trị viên.' });
                } else {
                    await pool.query('UPDATE users SET failed_attempts = $1, updated_at = NOW() WHERE id = $2', [newFailed, user.id]);
                    try { await logActivity(pool, { userId: user.id, username: user.username, status: 'failure', reason: 'Wrong password', module: 'Auth', action: 'Login' }); } catch(e){}
                    return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác.', attemptsLeft: 5 - newFailed });
                }
            } catch (err) {
                console.error('Lỗi khi cập nhật số lần đăng nhập thất bại:', err.message);
            }
            return res.status(401).json({ message: 'Thông tin đăng nhập không chính xác.' });
        }

        // Successful login: reset failed attempts
        if (user.failed_attempts && user.failed_attempts > 0) {
            await pool.query('UPDATE users SET failed_attempts = 0, updated_at = NOW() WHERE id = $1', [user.id]);
        }

        let finalPermissions = user.permissions || [];
        if (finalPermissions.includes('full_access')) {
            const allPermsRes = await pool.query('SELECT permission_name FROM permissions');
            finalPermissions = allPermsRes.rows.map(p => p.permission_name);
        }

        // Only verify MFA when the client supplies an MFA token (or uses MFA-only flow).
        // This allows password-only logins to succeed without forcing a second factor.
        if (req.body?.mfaToken) {
            try {
                const secretEnc = user.mfa_secret_encrypted;
                const secret = secretEnc ? decrypt(secretEnc) : null;
                const verified = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token: String(req.body.mfaToken), window: 1 }) : false;
                if (!verified) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });
            } catch (e) {
                console.error('Lỗi kiểm tra MFA:', e);
                return res.status(500).json({ message: 'Lỗi xác thực MFA.' });
            }
        }

        // Successful login: expire old sessions (30 days) and enforce device limit, then create a session record
        const sessionId = crypto.randomUUID();
        try {
            // expire sessions older than 30 days so they don't count towards device limit
            await pool.query("UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE created_at < NOW() - INTERVAL '30 days' AND is_active = TRUE");
        } catch (e) {
            console.error('Could not expire old sessions:', e && (e.stack || e));
        }
        try {
            const cntRes = await pool.query('SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND is_active = TRUE', [user.id]);
            // Prefer counting unique device fingerprints where available to avoid counting
            // multiple browser instances on the same physical device as separate devices.
            // Ensure optional column exists (safe to run repeatedly).
            try { await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT"); } catch(e){}

            const sessRows = await pool.query('SELECT session_id, ua_hash, ip_hash, device_fingerprint_hash FROM sessions WHERE user_id = $1 AND is_active = TRUE', [user.id]);
            const seen = new Set();
            for (const sr of sessRows.rows) {
                if (sr.device_fingerprint_hash) {
                    seen.add(String(sr.device_fingerprint_hash));
                } else {
                    // fallback fingerprint: combine ua_hash + ip_hash
                    const fp = `${sr.ua_hash||''}|${sr.ip_hash||''}`;
                    seen.add(fp);
                }
            }
            const activeCount = seen.size;
            const MAX_DEVICES = 3;
            // Allow tests/local runs to bypass device limit when SKIP_DEVICE_LIMIT=1
            if (activeCount >= MAX_DEVICES && process.env.SKIP_DEVICE_LIMIT !== '1') {
                // Log the event for audit and diagnostics
                try {
                    await logActivity(pool, { userId: user.id, username: user.username, module: 'Auth', action: 'Device limit reached', details: `activeDevices=${activeCount}, max=${MAX_DEVICES}` });
                } catch (e) {
                    // ignore logging errors
                }
                try { writeLoginDebug({ reason: 'device_limit_reached', identifier, headers: req.headers, body: req.body, activeDevices: activeCount, maxDevices: MAX_DEVICES }); } catch (e) {}
                // Return a helpful message to the client so the login UI can show a dialog
                // Include explicit flag to allow the client to open device-management UI
                return res.status(403).json({ 
                    message: `Bạn đã đăng nhập trên ${MAX_DEVICES}/${MAX_DEVICES} thiết bị, vui lòng đăng xuất thiết bị không còn sử dụng.`, 
                    activeDevices: activeCount,
                    maxDevices: MAX_DEVICES,
                    allowDeviceManagement: true
                });
            }
        } catch (e) {
            console.error('Could not check active sessions count:', e && (e.stack || e));
        }
        try {
                // Prefer device info sent from client, fallback to headers
                const clientDevice = req.body?.device || {};
                const uaRaw = clientDevice.userAgent || req.headers['user-agent'] || null;
                const platform = clientDevice.platform || null;
                const screenInfo = clientDevice.screen || null;
                const ipRaw = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.connection?.remoteAddress || null;

                const uaEnc = uaRaw ? encrypt(uaRaw) : null;
                const uaHash = uaRaw ? sha256Hex(uaRaw) : null;
                const ipEnc = ipRaw ? encrypt(ipRaw) : null;
                const ipHash = ipRaw ? sha256Hex(ipRaw) : null;
            await pool.query(
                `INSERT INTO sessions (session_id, user_id, user_agent_encrypted, ua_hash, ip_encrypted, ip_hash, device_type, os)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [sessionId, user.id, uaEnc, uaHash, ipEnc, ipHash, clientDevice.deviceType || (platform ? (platform.includes('Win') ? 'Desktop' : 'Unknown') : null), clientDevice.platform || platform]
            );
            // If client provided richer device metadata, compute a fingerprint and store it.
            try {
                if (clientDevice && clientDevice.metadata && typeof clientDevice.metadata === 'object') {
                    await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT");
                    await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_metadata_json TEXT");
                    const meta = clientDevice.metadata;
                    const ordered = Object.keys(meta).sort().reduce((o,k)=>{o[k]=meta[k];return o;},{ });
                    const fpHash = clientDevice.fingerprint && typeof clientDevice.fingerprint === 'string' ? String(clientDevice.fingerprint) : sha256Hex(JSON.stringify(ordered));
                    await pool.query('UPDATE sessions SET device_fingerprint_hash = $1, device_metadata_json = $2 WHERE session_id = $3', [fpHash, JSON.stringify(ordered), sessionId]);
                } else if (clientDevice && clientDevice.fingerprint) {
                    try { await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT"); } catch(e){}
                    await pool.query('UPDATE sessions SET device_fingerprint_hash = $1 WHERE session_id = $2', [String(clientDevice.fingerprint), sessionId]);
                }
            } catch (fpErr) {
                console.warn('Could not store device fingerprint/metadata:', fpErr && fpErr.message ? fpErr.message : fpErr);
            }
        } catch (err) {
            console.error('Không thể tạo session:', err.message);
        }

        const payload = {
            user: {
                id: user.id,
                username: user.username,
                fullName: user.full_name,
                avatar: user.avatar,
                role: user.role_name,
                department: user.department_name,
                permissions: [...new Set(finalPermissions)]
            },
            sid: sessionId
        };

        // expose is_superadmin and must_reset_password flags to client
        payload.user.is_superadmin = !!user.is_superadmin;
        payload.user.must_reset_password = !!user.must_reset_password;

        // expose is_superadmin and must_reset_password flags to client
        payload.user.is_superadmin = !!user.is_superadmin;
        payload.user.must_reset_password = !!user.must_reset_password;

        const jwtHelper = require('../utils/jwtHelper');
        const token = jwtHelper.sign(payload, { expiresIn: '24h' });
        // Log success
        try {
            await logActivity(pool, { userId: user.id, username: user.username, status: 'success', module: 'Auth', action: usedSecret ? 'Superadmin Secret Login' : 'Login', sessionId, ip: ipRaw, userAgent: uaRaw, deviceType: clientDevice.deviceType || null, os: clientDevice.platform || platform, details: JSON.stringify({ screen: screenInfo, language: clientDevice.language, timezone: clientDevice.timezone }) });
        } catch(e){}

        res.json({ token, user: payload.user, sessionId });

    } catch (error) {
        // Log error server-side but avoid leaking sensitive stack traces to clients.
        console.error('Lỗi đăng nhập:', error && (error.stack || error));

        // If database is not available (invalid catalog name), return 503 with friendly message
        if (error && (error.code === '3D000' || (String(error).toLowerCase().includes('database') && String(error).toLowerCase().includes('does not exist')))) {
            return res.status(503).json({ message: 'Lỗi kết nối cơ sở dữ liệu. Vui lòng thử lại sau.' });
        }

        // Generic server error
        if (process.env.NODE_ENV === 'production') {
            return res.status(500).json({ message: 'Lỗi máy chủ nội bộ. Vui lòng thử lại.' });
        }

        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.', error: String(error && (error.stack || error)) });
    }
};

/**
 * @route POST /api/auth/mfa/setup
 * @desc  Generate TOTP secret and store encrypted (not enabled until verified)
 * @access Private
 */
exports.mfaSetup = async (req, res) => {
    const { id, username } = req.user;
    try {
        const secret = speakeasy.generateSecret({ length: 20, name: `xanuicam.vn (${username})` });
        // store encrypted secret; mfa_enabled remains false until user verifies
        await pool.query('UPDATE users SET mfa_secret_encrypted = $1 WHERE id = $2', [encrypt(secret.base32), id]);
        res.json({ otpauth_url: secret.otpauth_url, base32: secret.base32 });
    } catch (e) {
        console.error('Lỗi khi tạo MFA secret:', e);
        res.status(500).json({ message: 'Không thể tạo mã MFA.' });
    }
};

/**
 * @route POST /api/auth/mfa/verify
 * @desc  Verify provided TOTP and enable MFA for user
 * @access Private
 */
exports.mfaVerify = async (req, res) => {
    const { id } = req.user;
    const { token, device } = req.body || {};
    if (!token) return res.status(400).json({ message: 'Thiếu mã OTP.' });
    try {
        const r = await pool.query('SELECT mfa_secret_encrypted FROM users WHERE id = $1', [id]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const enc = r.rows[0].mfa_secret_encrypted;
        if (!enc) return res.status(400).json({ message: 'Chưa có secret MFA để xác thực.' });
        // Decrypt stored secret and verify TOTP
        const secret = decrypt(enc);
        const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 });
        if (!verified) return res.status(401).json({ message: 'Mã OTP không hợp lệ.' });

        // Update DB, session device metadata and audit log; perform asynchronously so response is quick.
        (async () => {
            try {
                await pool.query('UPDATE users SET mfa_enabled = TRUE, mfa_enabled_at = NOW() WHERE id = $1', [id]);
            } catch (errUpdate) {
                console.error('mfaVerify: error updating user mfa flags:', errUpdate && errUpdate.stack ? errUpdate.stack : errUpdate);
            }
            // If client provided device metadata during activation, persist it to the current session
            try {
                if (device && req.user && req.user.sid) {
                    const metaStr = JSON.stringify(device.metadata || device);
                    const fp = device.fingerprint || null;
                    await pool.query('UPDATE sessions SET device_metadata_json = $1, device_fingerprint_hash = $2 WHERE session_id = $3', [metaStr, fp, req.user.sid]);
                }
            } catch (errMeta) {
                console.error('mfaVerify: could not persist device metadata to session:', errMeta && errMeta.stack ? errMeta.stack : errMeta);
            }
            try {
                await logActivity(pool, { userId: id, module: 'Auth', action: 'MFA Enabled', status: 'success', details: 'User enabled MFA' });
            } catch (e) {
                console.error('Không thể ghi nhật ký MFA enable:', e);
            }
        })();

        res.json({ message: 'MFA đã được kích hoạt.' });
    } catch (e) {
        console.error('Lỗi verify MFA:', e);
        res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
    }
};

/**
 * @route POST /api/auth/mfa/fallback-request
 * @desc  Dev helper: generate a one-time fallback code and log it server-side.
 *       Intended for local/dev environments only. In production this should
 *       send a code via SMS/email and be rate-limited.
 * @access Public
 */
exports.mfaFallbackRequest = async (req, res) => {
    const { identifier } = req.body || {};
    if (!identifier) return res.status(400).json({ message: 'Thiếu identifier.' });
    try {
        const r = await pool.query(`SELECT id, username, email, phone_number, mfa_enabled FROM users WHERE (cccd = $1 OR username = $1)`, [identifier]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const user = r.rows[0];
        if (!user.mfa_enabled) return res.status(400).json({ message: 'Tài khoản chưa kích hoạt MFA.' });

        // Generate a 6-digit fallback code (dev-only). In production, deliver via SMS/Email.
        const fallback = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`MFA fallback code for user ${user.username} (${user.id}): ${fallback}`);
        try { await logActivity(pool, { userId: user.id, username: user.username, module: 'Auth', action: 'MFA Fallback Requested', status: 'info', details: 'Dev fallback code generated and logged' }); } catch(e){}

        return res.json({ message: 'Mã dự phòng đã được tạo (dev). Kiểm tra nhật ký server.' });
    } catch (e) {
        console.error('mfaFallbackRequest error:', e);
        return res.status(500).json({ message: 'Lỗi tạo mã dự phòng.' });
    }
};

/**
 * @route GET /api/auth/mfa/info
 * @desc  Return MFA setup info and current sessions/devices for the logged-in user
 * @access Private
 */
exports.mfaInfo = async (req, res) => {
    const { id } = req.user;
    try {
        // ensure expired sessions older than 30 days are cleaned up before returning
        try {
            await pool.query("UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE created_at < NOW() - INTERVAL '30 days' AND is_active = TRUE");
        } catch (ee) {
            console.error('Could not expire old sessions during mfaInfo:', ee && (ee.stack || ee));
        }
        // Attempt to create optional session columns where possible, but don't rely on it.
        // Some production DBs may run with different privileges or older schemas; to be
        // robust we will detect which optional columns actually exist and only
        // SELECT them when present to avoid parse-time errors like "column does not exist".
        try {
            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT");
            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_metadata_json TEXT");
            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_geo_json TEXT");
            await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_isp TEXT");
        } catch (ee) {
            console.warn('Could not ensure session optional columns exist (continuing):', ee && ee.message ? ee.message : ee);
        }

        // Discover which optional columns actually exist so we can build a safe SELECT.
        let selectCols = ['session_id', 'is_active', 'created_at', 'last_seen_at', 'user_agent_encrypted', 'ip_encrypted', 'device_type', 'os'];
        try {
            const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND table_schema = current_schema()");
            const cols = new Set(colRes.rows.map(r => r.column_name));
            if (cols.has('device_fingerprint_hash')) selectCols.push('device_fingerprint_hash');
            if (cols.has('device_metadata_json')) selectCols.push('device_metadata_json');
            if (cols.has('device_geo_json')) selectCols.push('device_geo_json');
            if (cols.has('device_isp')) selectCols.push('device_isp');
        } catch (ee) {
            console.warn('Could not query session columns (continuing):', ee && ee.message ? ee.message : ee);
        }

        // Discover which columns exist on audit_logs so geo lookup is safe
        let auditSelect = 'country, city, created_at';
        try {
            const auditColsRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'audit_logs' AND table_schema = current_schema()");
            const auditCols = new Set(auditColsRes.rows.map(r => r.column_name));
            const auditParts = ['country', 'city'];
            if (auditCols.has('latitude')) auditParts.push('latitude');
            if (auditCols.has('longitude')) auditParts.push('longitude');
            auditParts.push('created_at');
            auditSelect = auditParts.join(', ');
        } catch (ee) {
            console.warn('Could not query audit_logs columns (continuing):', ee && ee.message ? ee.message : ee);
        }

        // user MFA flags
        const u = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [id]);
        if (u.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const user = u.rows[0];

        // Only return active sessions so that "Đăng xuất" removes them from the UI
        const sessionsRes = await pool.query(`SELECT ${selectCols.join(', ')} FROM sessions WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC`, [id]);
        const sessions = [];
        const UAParser = require('ua-parser-js');
        for (const s of sessionsRes.rows) {
            let ip = null;
            let userAgent = null;
            let mac = null;
            try { ip = s.ip_encrypted ? decrypt(s.ip_encrypted) : null; } catch (e) { ip = null; }
            try { userAgent = s.user_agent_encrypted ? decrypt(s.user_agent_encrypted) : null; } catch (e) { userAgent = null; }
            try { mac = s.mac_encrypted ? decrypt(s.mac_encrypted) : null; } catch (e) { mac = null; }

            // parse UA for friendly device/browser names
            let uaInfo = { raw: userAgent || null, browser: null, version: null, os: s.os || null, device: s.device_type || null };
            try {
                const parser = new UAParser(userAgent || '');
                const r = parser.getResult();
                uaInfo.browser = r.browser?.name || null;
                uaInfo.version = r.browser?.version || null;
                uaInfo.os = r.os?.name || uaInfo.os;
                uaInfo.device = r.device?.model || r.device?.type || uaInfo.device;
            } catch (e) {}

            // if we have stored device metadata JSON, merge more client-provided fields
            let clientMetadata = null;
            try {
                if (s.device_metadata_json) {
                    clientMetadata = typeof s.device_metadata_json === 'string' ? JSON.parse(s.device_metadata_json) : s.device_metadata_json;
                    // overlay common fields
                    if (clientMetadata.language) uaInfo.language = clientMetadata.language;
                    if (clientMetadata.browserName) uaInfo.browser = uaInfo.browser || clientMetadata.browserName;
                    if (clientMetadata.browserVersion) uaInfo.version = uaInfo.version || clientMetadata.browserVersion;
                }
            } catch (e) {
                clientMetadata = null;
            }

            // prefer stored device_geo_json (from server-side enrichment) otherwise fallback to audit_logs
            let geo = null;
            try {
                if (s.device_geo_json) geo = typeof s.device_geo_json === 'string' ? JSON.parse(s.device_geo_json) : s.device_geo_json;
            } catch (e) { geo = null; }
            if (!geo) {
                try {
                    const geoRes = await pool.query(`SELECT ${auditSelect} FROM audit_logs WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1`, [s.session_id]);
                    geo = geoRes.rows[0] || null;
                } catch (geoErr) {
                    console.warn('Could not query audit_logs for geo (continuing):', geoErr && geoErr.message ? geoErr.message : geoErr);
                    geo = null;
                }
            }

            const isCurrent = req.user && req.user.sid === s.session_id;

            sessions.push({
                sessionId: s.session_id,
                isActive: s.is_active,
                createdAt: s.created_at,
                lastSeenAt: s.last_seen_at,
                ip,
                mac,
                ua: uaInfo,
                deviceType: s.device_type,
                os: s.os,
                geo,
                metadata: clientMetadata || null,
                fingerprint: s.device_fingerprint_hash || null,
                isCurrent
            });
        }

        // find earliest MFA Enabled audit entry for this user (if any)
        const mfaEnableRes = await pool.query("SELECT created_at FROM audit_logs WHERE user_id = $1 AND action = 'MFA Enabled' ORDER BY created_at ASC LIMIT 1", [id]);
        const mfaEnabledAt = mfaEnableRes.rows.length ? mfaEnableRes.rows[0].created_at : null;

        res.json({ mfaEnabled: !!user.mfa_enabled, hasSecret: !!user.mfa_secret_encrypted, mfaEnabledAt, sessions });
    } catch (e) {
        console.error('Lỗi khi lấy thông tin MFA:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

/**
 * @route POST /api/auth/mfa/rotate
 * @desc  Rotate MFA secret (generate new secret and store encrypted)
 * @access Private
 */
exports.mfaRotate = async (req, res) => {
    const { id, username } = req.user;
    try {
        const secret = speakeasy.generateSecret({ length: 20, name: `xanuicam.vn (${username})` });
        await pool.query('UPDATE users SET mfa_secret_encrypted = $1 WHERE id = $2', [encrypt(secret.base32), id]);
        try { await logActivity(pool, { userId: id, module: 'Auth', action: 'MFA Rotated', status: 'success', details: 'User rotated MFA secret' }); } catch(e){}
        res.json({ otpauth_url: secret.otpauth_url, base32: secret.base32 });
    } catch (e) {
        console.error('Lỗi khi xoay secret MFA:', e);
        res.status(500).json({ message: 'Không thể xoay secret MFA.' });
    }
};

/**
 * @route GET /api/auth/mfa/qr
 * @desc  Generate QR PNG server-side for given otpauth URL (query param `data`).
 * @access Private
 */
exports.mfaQR = async (req, res) => {
    const data = req.query.data || req.body.data || '';
    if (!data) return res.status(400).json({ message: 'Thiếu dữ liệu QR.' });
    try {
        const buf = await QRCode.toBuffer(String(data), { type: 'png', width: 400, errorCorrectionLevel: 'M' });
                res.setHeader('Content-Type', 'image/png');
                res.setHeader('Content-Disposition', 'attachment; filename="mfa-qr.png"');
                try {
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
                    res.setHeader('X-Download-Options', 'noopen');
                } catch (e) {}
                return res.send(buf);
    } catch (e) {
        console.error('Error generating QR PNG:', e && (e.stack || e));
        return res.status(500).json({ message: 'Không thể tạo hình QR.' });
    }
};

/**
 * @route GET /api/auth/sessions/:sid/export
 * @desc  Return session details as JSON or CSV (admin or owner)
 * @access Private
 */
exports.exportSession = async (req, res) => {
    const { sid } = req.params;
    const requester = req.user && req.user.id ? req.user : null;
    try {
        const sRes = await pool.query('SELECT session_id, user_id, is_active, created_at, last_seen_at, user_agent_encrypted, ip_encrypted, device_type, os, device_fingerprint_hash, device_metadata_json, device_geo_json, device_isp FROM sessions WHERE session_id = $1', [sid]);
        if (sRes.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy phiên.' });
        const row = sRes.rows[0];
        // Authorization: owner or superadmin
        if (!(requester && (requester.is_superadmin || requester.id === row.user_id))) {
            return res.status(403).json({ message: 'Không có quyền truy cập.' });
        }
        let ip = null, ua = null;
        try { ip = row.ip_encrypted ? decrypt(row.ip_encrypted) : null; } catch(e){ ip = null; }
        try { ua = row.user_agent_encrypted ? decrypt(row.user_agent_encrypted) : null; } catch(e){ ua = null; }
        let metadata = null; try { metadata = row.device_metadata_json ? (typeof row.device_metadata_json === 'string' ? JSON.parse(row.device_metadata_json) : row.device_metadata_json) : null; } catch(e){ metadata = null; }
        let geo = null; try { geo = row.device_geo_json ? (typeof row.device_geo_json === 'string' ? JSON.parse(row.device_geo_json) : row.device_geo_json) : null; } catch(e){ geo = null; }
        const payload = {
            sessionId: row.session_id,
            userId: row.user_id,
            isActive: row.is_active,
            createdAt: row.created_at,
            lastSeenAt: row.last_seen_at,
            ip, ua, deviceType: row.device_type, os: row.os, fingerprint: row.device_fingerprint_hash, metadata, geo, isp: row.device_isp
        };
        if (req.query.format === 'csv') {
            const cols = Object.keys(payload);
            const rowVals = cols.map(c => {
                const v = payload[c] !== undefined && payload[c] !== null ? String(payload[c]).replace(/"/g,'""') : '';
                return `"${v}"`;
            }).join(',');
            res.setHeader('Content-Type','text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="session_${sid}.csv"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            return res.send('\uFEFF' + cols.join(',') + '\n' + rowVals);
        }
        res.setHeader('Content-Type','application/json');
        res.setHeader('Content-Disposition', `attachment; filename="session_${sid}.json"`);
        try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
        return res.json(payload);
    } catch (e) {
        console.error('exportSession error:', e && (e.stack || e));
        return res.status(500).json({ message: 'Lỗi khi xuất phiên.' });
    }
};

/**
 * @route POST /api/auth/mfa/disable
 * @desc  Disable MFA after verifying a code
 * @access Private
 */
exports.mfaDisable = async (req, res) => {
    const { id } = req.user;
    const { token, password } = req.body || {};
    try {
        const sid = req.user && req.user.sid ? req.user.sid : null;
        const ip = req.headers && (req.headers['x-forwarded-for'] || req.ip) ? (req.headers['x-forwarded-for'] || req.ip) : null;
        // Do NOT log token fragments. Only record whether token was provided.
        logger.info({ event: 'mfa_disable_called', userId: req.user ? req.user.id : null, username: req.user ? req.user.username : null, hasPassword: !!password, hasToken: !!token, path: req.originalUrl || null, sid, ip });
    } catch (e) {}

    if (!token && !password) {
        try { logger.warn({ event: 'mfa_disable_failed', userId: id, reason: 'missing_token_and_password' }); } catch (e) {}
        return res.status(400).json({ message: 'Cần cung cấp mã OTP hoặc mật khẩu để tắt MFA.' });
    }
    try {
        const r = await pool.query('SELECT mfa_secret_encrypted, password_hash FROM users WHERE id = $1', [id]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const enc = r.rows[0].mfa_secret_encrypted;

        // If password provided, verify it and proceed
        if (password) {
            const pwHash = r.rows[0].password_hash;
            const match = await bcrypt.compare(String(password), pwHash || '');
            if (!match) {
                try { logger.warn({ event: 'mfa_disable_failed', userId: id, reason: 'password_mismatch', passwordLength: String(password).length, ip: req.headers && (req.headers['x-forwarded-for'] || req.ip) ? (req.headers['x-forwarded-for'] || req.ip) : null, sid: req.user && req.user.sid ? req.user.sid : null }); } catch(e){}
                return res.status(401).json({ message: 'Mật khẩu không đúng.' });
            }
        } else {
            // else verify TOTP token
            const secret = enc ? decrypt(enc) : null;
            const verified = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token: String(token), window: 1 }) : false;
            if (!verified) {
                try { logger.warn({ event: 'mfa_disable_failed', userId: id, reason: 'invalid_totp', tokenProvided: !!token, ip: req.headers && (req.headers['x-forwarded-for'] || req.ip) ? (req.headers['x-forwarded-for'] || req.ip) : null, sid: req.user && req.user.sid ? req.user.sid : null }); } catch(e){}
                return res.status(401).json({ message: 'Mã OTP không hợp lệ.' });
            }
        }

        // Disable MFA and remove stored secret
        await pool.query('UPDATE users SET mfa_enabled = FALSE, mfa_secret_encrypted = NULL WHERE id = $1', [id]);

        // Invalidate all sessions for this user so device info is removed
        await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE user_id = $1', [id]);

        try { logger.info({ event: 'mfa_disable_success', userId: id, details: 'MFA disabled and sessions invalidated', ip: req.headers && (req.headers['x-forwarded-for'] || req.ip) ? (req.headers['x-forwarded-for'] || req.ip) : null, sid: req.user && req.user.sid ? req.user.sid : null }); } catch(e){}
        try { await logActivity(pool, { userId: id, module: 'Auth', action: 'MFA Disabled', status: 'success', details: 'User disabled MFA and sessions removed' }); } catch(e){}
        res.json({ message: 'MFA đã được vô hiệu hóa và các thiết bị đã bị xóa.' });
    } catch (e) {
        console.error('Lỗi disable MFA:', e && (e.stack || e));
        res.status(500).json({ message: 'Lỗi khi tắt MFA.' });
    }
};

exports.updateProfile = async (req, res) => {
    const { id, fullName: actorName } = req.user;
    const { phone_number, email, birth_date, fullName } = req.body;
    const avatarPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const client = await pool.connect();

    try {
        // Enforce 30-day lock: users can only update their own profile every 30 days
        try {
            const tsRes = await pool.query('SELECT profile_last_updated_at FROM users WHERE id = $1', [id]);
            const last = tsRes.rows.length ? tsRes.rows[0].profile_last_updated_at : null;
            if (last) {
                const lastMs = new Date(last).getTime();
                const diffMs = Date.now() - lastMs;
                const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
                if (diffMs < THIRTY_DAYS_MS) {
                    // compute next allowed date (30 days after last)
                    const nextAllowed = new Date(lastMs + THIRTY_DAYS_MS);
                    const dd = String(nextAllowed.getDate()).padStart(2, '0');
                    const mm = String(nextAllowed.getMonth() + 1).padStart(2, '0');
                    const yyyy = String(nextAllowed.getFullYear());

                    const lastDt = new Date(lastMs);
                    const ldd = String(lastDt.getDate()).padStart(2, '0');
                    const lmm = String(lastDt.getMonth() + 1).padStart(2, '0');
                    const lyyyy = String(lastDt.getFullYear());

                    const message = `Bạn đã chỉnh sửa thông tin vào ngày ${ldd}/${lmm}/${lyyyy}, bạn có thể chỉnh sửa lần kế tiếp vào ngày ${dd}/${mm}/${yyyy}!`;
                    return res.status(403).json({ message, last_profile_update: last, next_allowed_date: nextAllowed.toISOString() });
                }
            }
        } catch (e) {
            // If reading the column fails (older schema), allow update and continue
            console.error('DEBUG updateProfile: could not read profile_last_updated_at, continuing:', e && (e.stack || e));
        }

        await client.query('BEGIN');

        const currentUserRes = await client.query('SELECT avatar FROM users WHERE id = $1', [id]);
        const oldAvatar = currentUserRes.rows[0]?.avatar;

        const fieldsToUpdate = { phone_number, email, birth_date: birth_date || null };
        if (req.user.permissions.includes('user_management') && fullName) {
            fieldsToUpdate.full_name = fullName;
        }
        if (avatarPath) {
            fieldsToUpdate.avatar = avatarPath;
        }

        const setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const queryParams = [...Object.values(fieldsToUpdate), id];

        // Always update profile_last_updated_at when a profile update succeeds
        const updateSql = setClauses && setClauses.length ? `UPDATE users SET ${setClauses}, profile_last_updated_at = NOW(), updated_at = NOW() WHERE id = $${queryParams.length}` : `UPDATE users SET profile_last_updated_at = NOW(), updated_at = NOW() WHERE id = $${queryParams.length}`;
        await client.query(updateSql, queryParams);
        
        if (avatarPath && oldAvatar) {
            deleteFile(oldAvatar);
        }
        
        // Ghi nhật ký hành động cập nhật hồ sơ
        await logActivity(client, {
            userId: id,
            module: 'Tài khoản',
            action: 'Cập nhật hồ sơ',
            details: `${actorName} đã tự cập nhật thông tin hồ sơ cá nhân.`
        });

        const updatedUserQuery = `
            SELECT 
                u.id, u.full_name, u.avatar,
                r.role_name, r.level as role_level,
                d.name as department_name,
                ARRAY_AGG(p.permission_name) FILTER (WHERE p.permission_name IS NOT NULL) as permissions
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE u.id = $1
            GROUP BY u.id, r.id, d.id
        `;
        const updatedUserRes = await client.query(updatedUserQuery, [id]);
        const updatedUser = updatedUserRes.rows[0];

        let finalPermissions = updatedUser.permissions || [];
        if (finalPermissions.includes('full_access')) {
            const allPermsRes = await client.query('SELECT permission_name FROM permissions');
            finalPermissions = allPermsRes.rows.map(p => p.permission_name);
        }

        const newPayload = {
            user: {
                id: updatedUser.id,
                fullName: updatedUser.full_name,
                avatar: updatedUser.avatar,
                // Show role name without the "Cấp ..." suffix for cleaner UI
                role: updatedUser.role_name,
                department: updatedUser.department_name,
                permissions: [...new Set(finalPermissions)]
            }
        };

        const jwtHelper = require('../utils/jwtHelper');
        const newToken = jwtHelper.sign(newPayload, { expiresIn: '24h' });
        
        // Attempt to persist a profile last-update timestamp if the column exists.
        try {
            await client.query('UPDATE users SET profile_last_updated_at = NOW() WHERE id = $1', [id]);
        } catch (e) {
            // If the column doesn't exist (older schema), ignore this non-fatal error.
            if (e && e.code !== '42703') console.error('DEBUG updateProfile: failed to set profile_last_updated_at', e && (e.stack || e));
        }

        await client.query('COMMIT');

        // Try to read profile_last_updated_at if available (non-fatal)
        try {
            const tsRes = await pool.query('SELECT profile_last_updated_at FROM users WHERE id = $1', [id]);
            if (tsRes.rows.length > 0) {
                newPayload.user.profile_last_updated_at = tsRes.rows[0].profile_last_updated_at || null;
            }
        } catch (e) {
            // ignore if column missing
        }

        res.json({ message: 'Cập nhật thông tin thành công!', token: newToken, user: newPayload.user });

    } catch (error) {
        await client.query('ROLLBACK');
        if (avatarPath) deleteFile(avatarPath);
        if (error.code === '23505' && error.constraint.includes('email')) {
            return res.status(400).json({ message: 'Email này đã được sử dụng.' });
        }
        console.error("Lỗi khi cập nhật hồ sơ:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    } finally {
        client.release();
    }
};

/**
 * @route   POST /api/auth/change-password
 * @desc    Thay đổi mật khẩu của người dùng đã đăng nhập
 * @access  Private
 */
exports.changePassword = async (req, res) => {
    const { id } = req.user;
    const { oldPassword, newPassword } = req.body;

    try {
        const userRes = await pool.query('SELECT password_hash, must_reset_password FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        const user = userRes.rows[0];
        // If user is flagged to reset password (e.g., secret-login), allow password change without oldPassword
        if (!user.must_reset_password) {
            const isMatch = await bcrypt.compare(oldPassword || '', user.password_hash);
            if (!isMatch) {
                return res.status(400).json({ message: 'Mật khẩu cũ không đúng.' });
            }
        }

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(newPassword, salt);

        await pool.query('UPDATE users SET password_hash = $1, must_reset_password = FALSE, updated_at = NOW() WHERE id = $2', [newPasswordHash, id]);

        res.json({ message: 'Đổi mật khẩu thành công.' });
    } catch (error) {
        console.error("Lỗi khi đổi mật khẩu:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

/**
 * @route POST /api/auth/sessions/:sid/logout
 * @desc  Invalidate a session belonging to the logged-in user
 * @access Private
 */
exports.logoutOwnSession = async (req, res) => {
    const { id } = req.user;
    const { sid } = req.params;
    try {
        const s = await pool.query('SELECT user_id FROM sessions WHERE session_id = $1', [sid]);
        if (s.rows.length === 0) return res.status(404).json({ message: 'Session không tồn tại.' });
        if (s.rows[0].user_id !== id) return res.status(403).json({ message: 'Không có quyền đăng xuất session này.' });
        await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE session_id = $1', [sid]);
        try { await logActivity(pool, { userId: id, module: 'Security', action: 'Logout session', details: `User logged out session ${sid}`, sessionId: sid }); } catch(e){}
        res.json({ message: 'Đã đăng xuất session.' });
    } catch (e) {
        console.error('Lỗi khi đăng xuất session:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

/**
 * @route POST /api/auth/sessions/logout-others
 * @desc  Given identifier + password, invalidate all sessions for that account.
 * @access Public (requires credential verification)
 */
exports.logoutOtherDevices = async (req, res) => {
    try {
        const { identifier, password } = req.body || {};
        const isAuthed = req.user && req.user.id;
        if (!isAuthed && (!identifier || !password)) {
            return res.status(400).json({ message: 'identifier và password là bắt buộc.' });
        }

        const limiterKey = `logout_other:${String(identifier || req.ip || 'unknown').toLowerCase()}`;

        // Verify user
        let user;
        if (isAuthed) {
            const r = await pool.query('SELECT id, username FROM users WHERE id = $1 LIMIT 1', [req.user.id]);
            if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            user = r.rows[0];
        } else {
            const r = await pool.query('SELECT id, password_hash, username FROM users WHERE (cccd = $1 OR username = $1) LIMIT 1', [identifier]);
            if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
            user = r.rows[0];
            const ok = await bcrypt.compare(String(password), user.password_hash);
            if (!ok) {
                try { console.warn(`logoutOtherDevices: password verification failed for identifier='${String(identifier).slice(0,50)}', userId=${user.id}, username='${user.username}'`); } catch(e){}
                return res.status(401).json({ message: 'Mật khẩu không đúng.' });
            }
        }

        // Clear limiter state (best-effort)
        try {
            const rclient = getClient();
            if (rclient) {
                await rclient.del(limiterKey);
                await rclient.del(`${limiterKey}:blocked`);
            } else {
                logoutOtherAttempts.delete(String(identifier || req.ip || 'unknown').toLowerCase());
            }
        } catch (e) {
            // ignore limiter clear errors
        }

        // Invalidate all sessions
        await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE user_id = $1', [user.id]);
        try {
            await logActivity(pool, { userId: user.id, username: user.username, module: 'Auth', action: 'Logout other devices', details: 'User requested logout of other devices via login UI' });
        } catch (e) {
            // ignore logging errors
        }

        return res.json({ message: 'Đã đăng xuất tất cả thiết bị khác. Vui lòng đăng nhập lại.' });
    } catch (e) {
        console.error('logoutOtherDevices error:', e && (e.stack || e));
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

/**
 * @route POST /api/auth/sessions/list
 * @desc  Given identifier+password (pre-login) return active sessions for that user
 * @access Public (credential-verified)
 */
exports.listSessionsByCredentials = async (req, res) => {
    try {
        const { identifier, password } = req.body || {};
        if (!identifier || !password) return res.status(400).json({ message: 'identifier và password là bắt buộc.' });

        // Rate limit pre-check (Redis when available, otherwise in-memory fallback)
        try {
            const retryAfter = await checkSessionCredentialBlocked(identifier);
            if (retryAfter) return res.status(429).json({ message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', retryAfterSeconds: retryAfter });
        } catch (e) {}

        const r = await pool.query('SELECT id, password_hash, username FROM users WHERE (cccd = $1 OR username = $1) LIMIT 1', [identifier]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const user = r.rows[0];
        const ok = await bcrypt.compare(String(password), user.password_hash);
        if (!ok) {
            try {
                const retryAfter = await recordSessionCredentialFailure(identifier);
                if (retryAfter) return res.status(429).json({ message: 'Quá nhiều lần thử nhập mật khẩu. Vui lòng thử lại sau.', retryAfterSeconds: retryAfter });
            } catch (e) {}
            return res.status(401).json({ message: 'Mật khẩu không đúng.' });
        }

        // mirror logic from mfaInfo to assemble sessions safely
        try {
            await pool.query("UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE created_at < NOW() - INTERVAL '30 days' AND is_active = TRUE");
        } catch (ee) {}

        let selectCols = ['session_id', 'is_active', 'created_at', 'last_seen_at', 'user_agent_encrypted', 'ip_encrypted', 'device_type', 'os'];
        try {
            const colRes = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND table_schema = current_schema()");
            const cols = new Set(colRes.rows.map(r => r.column_name));
            if (cols.has('device_fingerprint_hash')) selectCols.push('device_fingerprint_hash');
            if (cols.has('device_metadata_json')) selectCols.push('device_metadata_json');
            if (cols.has('device_geo_json')) selectCols.push('device_geo_json');
            if (cols.has('device_isp')) selectCols.push('device_isp');
        } catch (ee) {}

        const sessionsRes = await pool.query(`SELECT ${selectCols.join(', ')} FROM sessions WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC`, [user.id]);
        const sessions = [];
        const UAParser = require('ua-parser-js');
        for (const s of sessionsRes.rows) {
            let ip = null; let userAgent = null; let mac = null;
            try { ip = s.ip_encrypted ? decrypt(s.ip_encrypted) : null; } catch (e) { ip = null; }
            try { userAgent = s.user_agent_encrypted ? decrypt(s.user_agent_encrypted) : null; } catch (e) { userAgent = null; }
            try { mac = s.mac_encrypted ? decrypt(s.mac_encrypted) : null; } catch (e) { mac = null; }

            let uaInfo = { raw: userAgent || null, browser: null, version: null, os: s.os || null, device: s.device_type || null };
            try {
                const parser = new UAParser(userAgent || '');
                const r2 = parser.getResult();
                uaInfo.browser = r2.browser?.name || null;
                uaInfo.version = r2.browser?.version || null;
                uaInfo.os = r2.os?.name || uaInfo.os;
                uaInfo.device = r2.device?.model || r2.device?.type || uaInfo.device;
            } catch (e) {}

            let clientMetadata = null;
            try { if (s.device_metadata_json) clientMetadata = typeof s.device_metadata_json === 'string' ? JSON.parse(s.device_metadata_json) : s.device_metadata_json; } catch(e) { clientMetadata = null; }

            let geo = null;
            try { if (s.device_geo_json) geo = typeof s.device_geo_json === 'string' ? JSON.parse(s.device_geo_json) : s.device_geo_json; } catch(e) { geo = null; }
            if (!geo) {
                try {
                    const geoRes = await pool.query('SELECT country, city, latitude, longitude, created_at FROM audit_logs WHERE session_id = $1 ORDER BY created_at DESC LIMIT 1', [s.session_id]);
                    geo = geoRes.rows[0] || null;
                } catch(e) { geo = null; }
            }

            sessions.push({
                sessionId: s.session_id,
                isActive: s.is_active,
                createdAt: s.created_at,
                lastSeenAt: s.last_seen_at,
                ip,
                mac,
                ua: uaInfo,
                deviceType: s.device_type,
                os: s.os,
                geo,
                metadata: clientMetadata || null,
                fingerprint: s.device_fingerprint_hash || null,
            });
        }

        // Success -> clear attempt state for identifier (Redis or in-memory)
        try { await clearSessionCredentialAttempts(identifier); } catch (e) {}

        return res.json({ sessions });
    } catch (e) {
        console.error('listSessionsByCredentials error:', e && (e.stack || e));
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

/**
 * @route POST /api/auth/sessions/:sid/logout-credential
 * @desc  Given identifier+password, invalidate a specific session if it belongs to the user
 * @access Public (credential-verified)
 */
exports.logoutSessionWithCredentials = async (req, res) => {
    try {
        const { sid } = req.params;
        const { identifier, password } = req.body || {};
        if (!identifier || !password) return res.status(400).json({ message: 'identifier và password là bắt buộc.' });

        // Rate limit pre-check (Redis when available, otherwise in-memory fallback)
        try {
            const retryAfter = await checkSessionCredentialBlocked(identifier);
            if (retryAfter) return res.status(429).json({ message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', retryAfterSeconds: retryAfter });
        } catch (e) {}

        const r = await pool.query('SELECT id, password_hash, username FROM users WHERE (cccd = $1 OR username = $1) LIMIT 1', [identifier]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const user = r.rows[0];
        const ok = await bcrypt.compare(String(password), user.password_hash);
        if (!ok) {
            try {
                const retryAfter = await recordSessionCredentialFailure(identifier);
                if (retryAfter) return res.status(429).json({ message: 'Quá nhiều lần thử nhập mật khẩu. Vui lòng thử lại sau.', retryAfterSeconds: retryAfter });
            } catch (e) {}
            return res.status(401).json({ message: 'Mật khẩu không đúng.' });
        }

        // verify session ownership
        const s = await pool.query('SELECT user_id FROM sessions WHERE session_id = $1', [sid]);
        if (s.rows.length === 0) return res.status(404).json({ message: 'Session không tồn tại.' });
        if (s.rows[0].user_id !== user.id) return res.status(403).json({ message: 'Không có quyền đăng xuất session này.' });

        await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE session_id = $1', [sid]);
        try { await logActivity(pool, { userId: user.id, module: 'Security', action: 'Logout session (credential)', details: `User logged out session ${sid} via credential UI`, sessionId: sid }); } catch(e){}
        return res.json({ message: 'Đã đăng xuất session.' });
    } catch (e) {
        console.error('logoutSessionWithCredentials error:', e && (e.stack || e));
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

/**
 * Development debug: return decrypted mfa secret for the authenticated user.
 * Only enabled in non-production environments.
 */
exports.debugMfaSecret = async (req, res) => {
    if (process.env.NODE_ENV === 'production') return res.status(404).end();
    const { id } = req.user;
    try {
        const r = await pool.query('SELECT mfa_secret_encrypted FROM users WHERE id = $1', [id]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const enc = r.rows[0].mfa_secret_encrypted;
        const secret = enc ? decrypt(enc) : null;
        res.json({ secret, encLen: enc ? enc.length : 0 });
    } catch (e) {
        console.error('debugMfaSecret error:', e && e.stack ? e.stack : e);
        res.status(500).json({ message: 'Lỗi nội bộ.' });
    }
};
