// ubndxanuicam/backend/src/controllers/auditLogController.js
// VERSION 3.0 - Decrypts sensitive fields for admin responses and adds session management

const pool = require('../db');
const { decrypt } = require('../utils/encryption');
const UAParser = require('ua-parser-js');
const logActivity = require('../utils/auditLogger');
const { broadcaster } = require('../utils/auditBroadcaster');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

exports.getAuditLogs = async (req, res) => {
    const { page = 1, limit = 15, user, action, module, startDate, endDate } = req.query;
    const offset = (page - 1) * limit;

    try {
        let baseQuery = `
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN tasks t ON al.task_id = t.id
        `;
        const params = [];
        let paramIndex = 1;
        const whereClauses = ['1=1'];

        if (user) {
            whereClauses.push(`(u.full_name ILIKE $${paramIndex} OR al.username ILIKE $${paramIndex})`);
            params.push(`%${user}%`);
            paramIndex++;
        }
        if (action) {
            whereClauses.push(`al.action ILIKE $${paramIndex++}`);
            params.push(`%${action}%`);
        }
        // convenience preset filter: ?event=lock|unlock maps to action keywords
        if (req.query.event) {
            const ev = String(req.query.event).toLowerCase();
            if (ev === 'lock') {
                whereClauses.push(`(al.action ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex+1})`);
                params.push('%lock%', '%khóa%');
                paramIndex += 2;
            } else if (ev === 'unlock') {
                whereClauses.push(`(al.action ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex+1})`);
                params.push('%unlock%', '%mở khóa%');
                paramIndex += 2;
            }
        }
        if (module) {
            whereClauses.push(`al.module = $${paramIndex++}`);
            params.push(module);
        }
        if (startDate) {
            whereClauses.push(`al.created_at >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereClauses.push(`al.created_at <= $${paramIndex++}`);
            params.push(endOfDay);
        }

        const whereClauseString = `WHERE ${whereClauses.join(' AND ')}`;

        const totalCountQuery = `SELECT COUNT(al.id) ${baseQuery} ${whereClauseString}`;
        const totalCountRes = await pool.query(totalCountQuery, params);
        const totalItems = parseInt(totalCountRes.rows[0].count, 10);

        const dataQuery = `
            SELECT 
                al.id, al.action, al.details, al.created_at, al.module,
                u.id as user_id, u.full_name as user_name, u.username as username, t.title as task_title
            ${baseQuery} ${whereClauseString}
            ORDER BY al.created_at DESC 
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        params.push(limit, offset);

        const { rows } = await pool.query(dataQuery, params);

        // Decrypt sensitive fields for admin display and parse UA
        const decrypted = rows.map(r => {
            const user_agent = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return null; } })() : null;
            const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return null; } })() : null;
            const mac = r.mac_encrypted ? (() => { try { return decrypt(r.mac_encrypted); } catch(e){ return null; } })() : null;
            const parser = new UAParser(user_agent || '');
            const uaParsed = parser.getResult();
            const ip_version = ip ? (ip.includes(':') ? 'IPv6' : 'IPv4') : null;
            return {
                ...r,
                user_agent,
                ip,
                mac,
                ua_browser: uaParsed.browser?.name || null,
                ua_version: uaParsed.browser?.version || null,
                ua_os: uaParsed.os?.name || r.os || null,
                ua_device: uaParsed.device?.model || r.device_type || null,
                ip_version
            };
        });

        // Export to CSV if requested
        if (req.query.export && req.query.export.toLowerCase() === 'csv') {
            const columns = [
                'id','created_at','user_name','username','status','reason','action','module',
                'ip','ip_version','country','city','isp','latitude','longitude',
                'device_type','ua_device','ua_os','ua_browser','ua_version','user_agent','mac',
                'session_id','url','details'
            ];
            const csvRows = [columns.join(',')];
            for (const r of decrypted) {
                const row = columns.map(c => {
                    const v = r[c] !== undefined && r[c] !== null ? String(r[c]).replace(/\r|\n|,/g, ' ') : '';
                    return `"${v.replace(/"/g,'""')}"`;
                }).join(',');
                csvRows.push(row);
            }
            const bom = '\uFEFF';
            const csvContent = bom + csvRows.join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
            // secure download headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
            res.setHeader('X-Download-Options', 'noopen');
            return res.send(csvContent);
        }

        res.json({
            logs: decrypted,
            totalPages: Math.ceil(totalItems / limit),
            currentPage: parseInt(page, 10),
            totalItems
        });

    } catch (error) {
        console.error("Lỗi khi tải nhật ký hệ thống:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// List active sessions (with decrypted UA/IP for admin)
exports.getSessions = async (req, res) => {
    try {
        const q = `
            SELECT s.session_id, s.user_id, s.user_agent_encrypted, s.ip_encrypted, s.last_seen_at, s.created_at, s.is_active,
                   u.full_name, u.username
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            ORDER BY s.last_seen_at DESC
        `;
        const { rows } = await pool.query(q);
        const data = rows.map(r => ({
            session_id: r.session_id,
            user_id: r.user_id,
            user_name: r.full_name,
            username: r.username,
            user_agent: r.user_agent_encrypted ? decrypt(r.user_agent_encrypted) : null,
            ip: r.ip_encrypted ? decrypt(r.ip_encrypted) : null,
            last_seen_at: r.last_seen_at,
            created_at: r.created_at,
            is_active: r.is_active
        }));
        res.json({ sessions: data });
    } catch (error) {
        console.error('Lỗi khi lấy sessions:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Remote logout a single session
exports.logoutSession = async (req, res) => {
    const { id } = req.user; // admin actor
    const { sid } = req.params;
    const { password } = req.body || {};
    // Require password confirmation from the admin performing the destructive action
    if (!password) return res.status(400).json({ message: 'Password confirmation is required.' });
    try {
        const u = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
        if (!u || !u.rows || !u.rows[0]) return res.status(403).json({ message: 'Unable to validate user.' });
        const hash = u.rows[0].password_hash;
        const ok = await bcrypt.compare(String(password), String(hash));
        if (!ok) return res.status(403).json({ message: 'Xác thực mật khẩu thất bại.' });
    } catch (err) {
        console.error('Error verifying password for destructive action:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
    try {
        const upd = await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE session_id = $1 RETURNING user_id', [sid]);
        if (upd.rowCount === 0) return res.status(404).json({ message: 'Session không tồn tại.' });
        await logActivity(pool, { userId: id, module: 'Security', action: 'Remote logout', details: `Đăng xuất từ xa session ${sid}`, sessionId: sid });
        res.json({ message: 'Đã đăng xuất session.' });
    } catch (error) {
        console.error('Lỗi khi đăng xuất session:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Logout all sessions for a user
exports.logoutAllSessions = async (req, res) => {
    const { id } = req.user; // admin actor
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId là bắt buộc.' });
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: 'Password confirmation is required.' });
    try {
        const u = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
        if (!u || !u.rows || !u.rows[0]) return res.status(403).json({ message: 'Unable to validate user.' });
        const hash = u.rows[0].password_hash;
        const ok = await bcrypt.compare(String(password), String(hash));
        if (!ok) return res.status(403).json({ message: 'Xác thực mật khẩu thất bại.' });
    } catch (err) {
        console.error('Error verifying password for destructive action:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
    try {
        await pool.query('UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE user_id = $1', [userId]);
        await logActivity(pool, { userId: id, module: 'Security', action: 'Logout all sessions', details: `Đăng xuất tất cả session của user ${userId}` });
        res.json({ message: 'Đã đăng xuất tất cả session của người dùng.' });
    } catch (error) {
        console.error('Lỗi khi đăng xuất tất cả session:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Notify SSE clients about updates (used by internal worker)
exports.notifyUpdate = async (req, res) => {
    try {
        const payload = req.body;
        broadcaster.emit('update_audit', payload);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ ok: false });
    }
};

// Export decrypted CSV for super-admins (sensitive fields decrypted)
exports.exportDecryptedCsv = async (req, res) => {
    const { page = 1, limit = 1000, user, action, module, startDate, endDate, status } = req.query;
    const offset = (page - 1) * limit;
    try {
        let baseQuery = `
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN tasks t ON al.task_id = t.id
        `;
        const params = [];
        let paramIndex = 1;
        const whereClauses = ['1=1'];

        if (user) {
            whereClauses.push(`(u.full_name ILIKE $${paramIndex} OR al.username ILIKE $${paramIndex})`);
            params.push(`%${user}%`);
            paramIndex++;
        }
        if (action) {
            whereClauses.push(`al.action ILIKE $${paramIndex++}`);
            params.push(`%${action}%`);
        }
        if (module) {
            whereClauses.push(`al.module = $${paramIndex++}`);
            params.push(module);
        }
        if (status) {
            whereClauses.push(`al.status = $${paramIndex++}`);
            params.push(status);
        }
        if (startDate) {
            whereClauses.push(`al.created_at >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereClauses.push(`al.created_at <= $${paramIndex++}`);
            params.push(endOfDay);
        }

        const whereClauseString = `WHERE ${whereClauses.join(' AND ')}`;

        const dataQuery = `
            SELECT 
                al.id, al.action, al.details, al.created_at, al.module, al.status, al.reason,
                al.username, al.device_type, al.os, al.user_agent_encrypted, al.mac_encrypted, al.ip_encrypted,
                al.country, al.city, al.isp, al.latitude, al.longitude, al.method, al.url, al.session_id,
                u.full_name as user_name, t.title as task_title
            ${baseQuery} ${whereClauseString}
            ORDER BY al.created_at DESC 
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        params.push(limit, offset);

        const { rows } = await pool.query(dataQuery, params);

        // Decrypt sensitive fields and parse UA for richer CSV
        const decrypted = rows.map(r => {
            const user_agent = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return null; } })() : null;
            const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return null; } })() : null;
            const mac = r.mac_encrypted ? (() => { try { return decrypt(r.mac_encrypted); } catch(e){ return null; } })() : null;
            const ip_version = ip ? (ip.includes(':') ? 'IPv6' : 'IPv4') : null;
            // parse UA
            let ua_browser = null, ua_version = null, ua_os = r.os || null, ua_device = r.device_type || null;
            try {
                const parser = new UAParser(user_agent || '');
                const uaRes = parser.getResult();
                ua_browser = uaRes.browser?.name || null;
                ua_version = uaRes.browser?.version || null;
                ua_os = uaRes.os?.name || ua_os;
                ua_device = uaRes.device?.model || uaRes.device?.type || ua_device;
            } catch (e) {}
            return {
                ...r,
                user_agent,
                ip,
                mac,
                ip_version,
                ua_browser,
                ua_version,
                ua_os,
                ua_device
            };
        });

        const columns = [
            'id','created_at','user_id','user_name','username','status','reason','action','module',
            'ip','ip_version','country','city','isp','latitude','longitude',
            'device_type','ua_device','ua_os','ua_browser','ua_version','user_agent','mac','session_id','url','details'
        ];
        const csvRows = [columns.join(',')];
        for (const r of decrypted) {
            const row = columns.map(c => {
                const v = r[c] !== undefined && r[c] !== null ? String(r[c]).replace(/\r|\n|,/g, ' ') : '';
                return `"${v.replace(/"/g,'""')}"`;
            }).join(',');
            csvRows.push(row);
        }
        const csvContent = csvRows.join('\n');

        // Record that an export of decrypted data was performed (for accountability)
        try {
            const count = decrypted.length || 0;
            const actorId = req.user && req.user.id ? req.user.id : null;
            const actorName = req.user && req.user.username ? req.user.username : null;
            const actorSession = req.user && req.user.sid ? req.user.sid : (req.headers['x-session-id'] || null);
            const actorIp = (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim();
            await logActivity(pool, {
                userId: actorId,
                username: actorName,
                sessionId: actorSession,
                ip: actorIp || null,
                module: 'Audit',
                action: 'Export decrypted CSV',
                details: `Exported ${count} rows; filters: ${JSON.stringify(req.query || {})}`
            });
        } catch (e) {
            // don't block export on logging failure
            console.error('Failed to write export audit entry:', e);
        }

        const bom = '\uFEFF';
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit_logs_decrypted_${Date.now()}.csv"`);
        // secure download headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
        res.setHeader('X-Download-Options', 'noopen');
        return res.send(bom + csvContent);
    } catch (error) {
        console.error('Lỗi khi export decrypted CSV:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

        

// Get single audit log by id with decrypted fields and light UA/IP parsing
exports.getAuditLogById = async (req, res) => {
    const { id } = req.params;
    try {
        const q = `SELECT al.*, u.full_name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.id = $1`;
        const { rows } = await pool.query(q, [id]);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'Not found' });
        const r = rows[0];
        const user_agent = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return null; } })() : null;
        const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return null; } })() : null;

        // simple UA parsing
        const parseUA = (ua) => {
            if (!ua) return { raw: null, browser: null, version: null, os: r.os || null, device: r.device_type || null };
            let browser = 'Unknown', version = null;
            if (/Chrome\/(\d+)/i.test(ua) && !/Edg\//i.test(ua)) {
                browser = 'Chrome'; version = ua.match(/Chrome\/(\d+(?:\.\d+)*)/i)?.[1] || null;
            } else if (/Firefox\/(\d+)/i.test(ua)) {
                browser = 'Firefox'; version = ua.match(/Firefox\/(\d+(?:\.\d+)*)/i)?.[1] || null;
            } else if (/Edg\/(\d+)/i.test(ua)) {
                browser = 'Edge'; version = ua.match(/Edg\/(\d+(?:\.\d+)*)/i)?.[1] || null;
            } else if (/Safari\/(\d+)/i.test(ua) && /Version\/(\d+)/i.test(ua)) {
                browser = 'Safari'; version = ua.match(/Version\/(\d+(?:\.\d+)*)/i)?.[1] || null;
            } else if (/OPR\//i.test(ua)) {
                browser = 'Opera'; version = ua.match(/OPR\/(\d+(?:\.\d+)*)/i)?.[1] || null;
            }
            return { raw: ua, browser, version, os: r.os || null, device: r.device_type || null };
        };

        
        const uaInfo = parseUA(user_agent);

        const ipVersion = (ipStr) => {
            if (!ipStr) return null;
            return ipStr.includes(':') ? 'IPv6' : 'IPv4';
        };

        const payload = {
            id: r.id,
            user_id: r.user_id,
            user_name: r.user_name,
            username: r.username,
            status: r.status,
            reason: r.reason,
            action: r.action,
            module: r.module,
            details: r.details,
            session_id: r.session_id,
            created_at: r.created_at,
            ip: ip,
            ip_version: ipVersion(ip),
            country: r.country,
            city: r.city,
            isp: r.isp,
            latitude: r.latitude,
            longitude: r.longitude,
            ua: uaInfo,
            mac: r.mac_encrypted ? (() => { try { return decrypt(r.mac_encrypted); } catch(e){ return null; } })() : null,
            method: r.method,
            url: r.url
        };
        // If there is a related session_id, attempt to attach stored session device metadata and fingerprint
        try {
            // Ensure optional session columns exist (idempotent) so SELECTs below won't fail on older schemas
            try {
                await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_fingerprint_hash TEXT");
                await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_metadata_json TEXT");
                await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_geo_json TEXT");
                await pool.query("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_isp TEXT");
            } catch (ensureErr) {
                // non-fatal: continue and attempt to read (catch will handle missing columns)
            }
            if (r.session_id) {
                const sres = await pool.query('SELECT device_fingerprint_hash, device_metadata_json, device_geo_json, device_isp FROM sessions WHERE session_id = $1 LIMIT 1', [r.session_id]);
                if (sres.rows && sres.rows[0]) {
                    const srow = sres.rows[0];
                    try { payload.metadata = srow.device_metadata_json ? JSON.parse(srow.device_metadata_json) : null; } catch(e) { payload.metadata = null; }
                    payload.fingerprint = srow.device_fingerprint_hash || null;
                    try { payload.device_geo = srow.device_geo_json ? JSON.parse(srow.device_geo_json) : null; } catch(e) { payload.device_geo = null; }
                    payload.device_isp = srow.device_isp || null;
                }
            }
        } catch (e) {
            console.warn('Could not attach session metadata to audit payload:', e && e.message ? e.message : e);
        }

        // If there is no rich session metadata attached, build a best-effort metadata object
        // from available audit_log columns so the UI can show useful values instead of '-'.
        try {
            if (!payload.metadata) {
                const meta = {};
                // common fingerprint/hash fallbacks
                meta.fingerprint = payload.fingerprint || r.device_fingerprint_hash || r.ua_hash || null;
                meta.timezone = r.timezone || null;
                meta.connectionType = r.connection_type || null;
                meta.canvasHash = r.canvas_hash || null;
                meta.webglHash = r.webgl_hash || null;
                meta.audioHash = r.audio_hash || null;
                try { meta.fonts = r.fonts ? JSON.parse(r.fonts) : null; } catch(e) { meta.fonts = r.fonts || null; }
                try { meta.webrtcLocalIps = r.webrtc_local_ips ? JSON.parse(r.webrtc_local_ips) : null; } catch(e) { meta.webrtcLocalIps = r.webrtc_local_ips || null; }
                meta.hardwareUUID = r.hardware_uuid || null;
                meta.compositeHash = r.composite_hash || null;
                meta.incognito = typeof r.incognito !== 'undefined' ? r.incognito : null;
                meta.webauthn = typeof r.webauthn !== 'undefined' ? r.webauthn : null;
                meta.hardwareConcurrency = r.hardware_concurrency || null;
                meta.deviceMemory = r.device_memory || null;
                meta.battery = (typeof r.battery_level !== 'undefined' || typeof r.battery_charging !== 'undefined') ? { level: r.battery_level || null, charging: r.battery_charging || null } : null;
                // screen
                if (r.screen_width || r.screen_height || r.pixel_ratio) {
                    meta.screen = { width: r.screen_width || null, height: r.screen_height || null, pixelRatio: r.pixel_ratio || null };
                }
                // language/plugins
                try { meta.plugins = r.plugins ? JSON.parse(r.plugins) : null; } catch(e) { meta.plugins = r.plugins || null; }
                meta.language = r.language || null;
                meta.isp = payload.device_isp || r.isp || null;
                // attach if any meaningful key present
                if (Object.keys(meta).some(k => meta[k] !== null && meta[k] !== undefined)) payload.metadata = meta;
            }
        } catch (e) {
            // ignore
        }

        res.json(payload);
    } catch (error) {
        console.error('Lỗi khi lấy audit log by id:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Export a single audit log entry (CSV or JSON) with decrypted fields
exports.exportAuditById = async (req, res) => {
    const { id } = req.params;
    const format = (req.query.format || 'json').toLowerCase();
    try {
        const q = `SELECT al.*, u.full_name as user_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id WHERE al.id = $1`;
        const { rows } = await pool.query(q, [id]);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'Not found' });
        const r = rows[0];
        const user_agent = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return null; } })() : null;
        const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return null; } })() : null;
        const mac = r.mac_encrypted ? (() => { try { return decrypt(r.mac_encrypted); } catch(e){ return null; } })() : null;

        // parse UA
        let ua_browser = null, ua_version = null, ua_os = r.os || null, ua_device = r.device_type || null;
        try {
            const parser = new UAParser(user_agent || '');
            const uaRes = parser.getResult();
            ua_browser = uaRes.browser?.name || null;
            ua_version = uaRes.browser?.version || null;
            ua_os = uaRes.os?.name || ua_os;
            ua_device = uaRes.device?.model || uaRes.device?.type || ua_device;
        } catch (e) {}

        const payload = {
            id: r.id,
            created_at: r.created_at,
            user_id: r.user_id,
            user_name: r.user_name,
            username: r.username,
            status: r.status,
            reason: r.reason,
            action: r.action,
            module: r.module,
            details: r.details,
            session_id: r.session_id,
            ip,
            ip_version: ip ? (ip.includes(':') ? 'IPv6' : 'IPv4') : null,
            country: r.country,
            city: r.city,
            isp: r.isp,
            latitude: r.latitude,
            longitude: r.longitude,
            ua: { raw: user_agent, browser: ua_browser, version: ua_version, os: ua_os, device: ua_device },
            mac,
            method: r.method,
            url: r.url
        };

        // Attach available session metadata if present
        try {
            if (r.session_id) {
                const sres = await pool.query('SELECT device_fingerprint_hash, device_metadata_json, device_geo_json, device_isp FROM sessions WHERE session_id = $1 LIMIT 1', [r.session_id]);
                if (sres.rows && sres.rows[0]) {
                    const srow = sres.rows[0];
                    try { payload.metadata = srow.device_metadata_json ? JSON.parse(srow.device_metadata_json) : null; } catch(e) { payload.metadata = null; }
                    payload.fingerprint = srow.device_fingerprint_hash || null;
                    try { payload.device_geo = srow.device_geo_json ? JSON.parse(srow.device_geo_json) : null; } catch(e) { payload.device_geo = null; }
                    payload.device_isp = srow.device_isp || null;
                }
            }
        } catch (e) {
            console.warn('Could not attach session metadata for export payload:', e && e.message ? e.message : e);
        }

        // If no session metadata, construct a best-effort metadata object from audit row columns
        try {
            if (!payload.metadata) {
                const meta = {};
                meta.fingerprint = payload.fingerprint || r.device_fingerprint_hash || r.ua_hash || null;
                meta.timezone = r.timezone || null;
                meta.connectionType = r.connection_type || null;
                meta.canvasHash = r.canvas_hash || null;
                meta.webglHash = r.webgl_hash || null;
                meta.audioHash = r.audio_hash || null;
                try { meta.fonts = r.fonts ? JSON.parse(r.fonts) : null; } catch(e) { meta.fonts = r.fonts || null; }
                try { meta.webrtcLocalIps = r.webrtc_local_ips ? JSON.parse(r.webrtc_local_ips) : null; } catch(e) { meta.webrtcLocalIps = r.webrtc_local_ips || null; }
                meta.hardwareUUID = r.hardware_uuid || null;
                meta.compositeHash = r.composite_hash || null;
                meta.incognito = typeof r.incognito !== 'undefined' ? r.incognito : null;
                meta.webauthn = typeof r.webauthn !== 'undefined' ? r.webauthn : null;
                meta.hardwareConcurrency = r.hardware_concurrency || null;
                meta.deviceMemory = r.device_memory || null;
                meta.battery = (typeof r.battery_level !== 'undefined' || typeof r.battery_charging !== 'undefined') ? { level: r.battery_level || null, charging: r.battery_charging || null } : null;
                if (r.screen_width || r.screen_height || r.pixel_ratio) {
                    meta.screen = { width: r.screen_width || null, height: r.screen_height || null, pixelRatio: r.pixel_ratio || null };
                }
                try { meta.plugins = r.plugins ? JSON.parse(r.plugins) : null; } catch(e) { meta.plugins = r.plugins || null; }
                meta.language = r.language || null;
                meta.isp = payload.device_isp || r.isp || null;
                if (Object.keys(meta).some(k => meta[k] !== null && meta[k] !== undefined)) payload.metadata = meta;
            }
        } catch (e) {
            // ignore
        }

        // If PDF requested, generate server-side PDF using pdfkit
        if (format === 'pdf') {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const chunks = [];
                doc.on('data', (c) => chunks.push(c));
                doc.on('end', () => {
                    const result = Buffer.concat(chunks);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="audit_${id}.pdf"`);
                    // secure download headers
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
                    res.setHeader('X-Download-Options', 'noopen');
                    return res.send(result);
                });
                const siteTitle = process.env.SITE_TITLE || 'UBND xã Núi Cấm';
                const exporterName = (req.user && (req.user.fullName || req.user.username)) ? (req.user.fullName || req.user.username) : 'Hệ thống';

                // Attempt to register a Unicode-capable font so Vietnamese characters render correctly in the PDF.
                try {
                    const fontCandidates = [
                        path.join(__dirname, '..', '..', 'fonts', 'NotoSans-Regular.ttf'),
                        path.join(__dirname, '..', '..', 'fonts', 'DejaVuSans.ttf'),
                        path.join(__dirname, '..', '..', 'frontend', 'build', 'static', 'media', 'NotoSans-Regular.ttf')
                    ];
                    let fontPath = null;
                    for (const p of fontCandidates) {
                        if (fs.existsSync(p)) { fontPath = p; break; }
                    }
                    if (fontPath) {
                        try {
                            doc.registerFont('UnicodeFont', fontPath);
                        } catch (e) {}
                    }
                } catch (e) {}

                // Header with optional logo
                try {
                    const buildStatic = path.resolve(__dirname, '..', '..', 'frontend', 'build', 'static', 'media');
                    const logoCandidates = ['logo.png','logo.jpg','logo.svg'];
                    let logoPath = null;
                    for (const fn of logoCandidates) {
                        const p = path.join(buildStatic, fn);
                        if (fs.existsSync(p)) { logoPath = p; break; }
                    }
                    if (logoPath) {
                        try { doc.image(logoPath, doc.page.margins.left, doc.y, { width: 60 }); } catch(e) {}
                    }
                } catch(e) {}
                doc.fillColor('#000').fontSize(16).text(siteTitle, { align: 'center' });
                doc.moveDown(0.2);
                doc.fontSize(12).text(`Audit #${id} — Chi tiết`, { align: 'center' });
                doc.moveDown(0.4);
                doc.fontSize(9).fillColor('#444').text(`Exported by: ${exporterName}    Exported at: ${new Date().toLocaleString()}`, { align: 'center' });
                doc.moveDown();

                const labels = {
                    id: 'ID', created_at: 'Thời gian', user_id: 'User ID', user_name: 'Tên người thao tác', username: 'Tên đăng nhập',
                    status: 'Trạng thái', reason: 'Lý do', action: 'Hành động', module: 'Module', details: 'Chi tiết',
                    session_id: 'Session ID', ip: 'IP', ip_version: 'IP Version', country: 'Quốc gia', city: 'Thành phố', isp: 'ISP',
                    latitude: 'Vĩ độ', longitude: 'Kinh độ', ua: 'User Agent', mac: 'MAC', method: 'Method', url: 'URL'
                };

                const ordered = ['id','created_at','user_id','user_name','username','action','module','status','reason','session_id','ip','ip_version','country','city','isp','latitude','longitude','ua','mac','method','url','details'];
                // formatted table-like section
                doc.moveDown(0.3);
                for (const key of ordered) {
                    const label = labels[key] || key;
                    let value = payload[key];
                    if (key === 'ua' && typeof value === 'object') {
                        value = `${value.browser || ''} ${value.version || ''} — ${value.os || ''} ${value.device || ''} (${value.raw || ''})`.trim();
                    }
                    if (value === null || value === undefined || value === '') value = '-';
                    if (typeof value === 'object') value = JSON.stringify(value, null, 2);
                    // Use registered Unicode font if available
                    try {
                        if (doc._registeredFonts && doc._registeredFonts['UnicodeFont']) {
                            doc.font('UnicodeFont').fontSize(10).fillColor('#000').text(label + ':', { continued: true, width: 140 });
                            doc.font('UnicodeFont').fontSize(10).text(String(value));
                        } else {
                            doc.font('Helvetica-Bold').fontSize(10).text(label + ':', { continued: true, width: 140 });
                            doc.font('Helvetica').fontSize(10).text(String(value));
                        }
                    } catch (e) {
                        doc.font('Helvetica-Bold').fontSize(10).text(label + ':', { continued: true, width: 140 });
                        doc.font('Helvetica').fontSize(10).text(String(value));
                    }
                    doc.moveDown(0.2);
                }
                doc.end();
                return;
            } catch (e) {
                console.error('Failed to generate PDF:', e);
                // fallthrough to JSON response
            }
        }

        // Record export action for accountability if user present
        try {
            const actorId = req.user && req.user.id ? req.user.id : null;
            await logActivity(pool, { userId: actorId, module: 'Audit', action: 'Export decrypted single', details: `Exported audit id ${id}`, taskId: null, sessionId: req.user && req.user.sid ? req.user.sid : null });
        } catch (e) {}

        if (format === 'csv') {
            const cols = ['id','created_at','user_id','user_name','username','status','reason','action','module','ip','ip_version','country','city','isp','latitude','longitude','device','ua_browser','ua_version','ua_os','user_agent','mac','session_id','url','details'];
            const row = cols.map(c => {
                const v = payload[c] !== undefined && payload[c] !== null ? String(payload[c]) : '';
                return `"${v.replace(/"/g,'""')}"`;
            }).join(',');
            const csv = cols.join(',') + '\n' + row;
            const bom = '\uFEFF';
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="audit_${id}.csv"`);
            // secure download headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
            res.setHeader('X-Download-Options', 'noopen');
            return res.send(bom + csv);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="audit_${id}.json"`);
        // secure download headers for JSON exports
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
        res.setHeader('X-Download-Options', 'noopen');
        return res.json(payload);
    } catch (error) {
        console.error('Lỗi khi export audit by id:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Return daily export quota for audit logs (per-account limit)
exports.exportAuditQuota = async (req, res) => {
    const actor = req.user || {};
    const actorId = actor.id;
    if (!actorId) return res.status(401).json({ message: 'Unauthorized' });
    try {
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS audit_export_actions (
                    id SERIAL PRIMARY KEY,
                    actor_id INTEGER NOT NULL,
                    format TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            `);
        } catch (e) {}
        const limit = 1;
        const todayCountRes = await pool.query("SELECT COUNT(*) FROM audit_export_actions WHERE actor_id = $1 AND created_at >= date_trunc('day', now())", [actorId]);
        const usedToday = parseInt(todayCountRes.rows[0].count || '0', 10);
        return res.json({ usedToday, limit, remaining: Math.max(0, limit - usedToday) });
    } catch (error) {
        console.error('exportAuditQuota error', error);
        return res.status(500).json({ message: 'Lỗi khi lấy thông tin giới hạn xuất báo cáo' });
    }
};

// Bulk export audit logs (xlsx/pdf/csv) with password confirmation and per-account daily limit
exports.exportAuditBulk = async (req, res) => {
    const actor = req.user || {};
    const actorId = actor.id;
    if (!actorId) return res.status(401).json({ message: 'Unauthorized' });
    const { format = 'xlsx', page = 1, limit = 100, filters = {}, password } = req.body || {};
    // verify password
    if (!password) return res.status(400).json({ message: 'Password confirmation is required.' });
    try {
        const u = await pool.query('SELECT password_hash FROM users WHERE id = $1', [actorId]);
        if (!u || !u.rows || !u.rows[0]) return res.status(403).json({ message: 'Unable to validate user.' });
        const hash = u.rows[0].password_hash;
        const ok = await bcrypt.compare(String(password), String(hash));
        if (!ok) return res.status(403).json({ message: 'Xác thực mật khẩu thất bại.' });
    } catch (err) {
        console.error('Error verifying password for export:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }

    // enforce per-account daily limit
    try {
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS audit_export_actions (id SERIAL PRIMARY KEY, actor_id INTEGER NOT NULL, format TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        } catch (e) {}
        const todayCountRes = await pool.query("SELECT COUNT(*) FROM audit_export_actions WHERE actor_id = $1 AND created_at >= date_trunc('day', now())", [actorId]);
        const usedToday = parseInt(todayCountRes.rows[0].count || '0', 10);
        if (usedToday >= 1) return res.status(403).json({ message: 'Mỗi tài khoản chỉ được xuất báo cáo audit mỗi ngày 1 lần.' });
    } catch (e) {
        console.error('Quota check failed', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }

    // Build query with same filter logic as getAuditLogs
    const { user, action, module: mod, startDate, endDate, event } = filters || {};
    const offset = (page - 1) * limit;
    try {
        let baseQuery = `
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN tasks t ON al.task_id = t.id
        `;
        const params = [];
        let paramIndex = 1;
        const whereClauses = ['1=1'];

        if (user) {
            whereClauses.push(`(u.full_name ILIKE $${paramIndex} OR al.username ILIKE $${paramIndex})`);
            params.push(`%${user}%`);
            paramIndex++;
        }
        if (action) {
            whereClauses.push(`al.action ILIKE $${paramIndex++}`);
            params.push(`%${action}%`);
        }
        if (event) {
            const ev = String(event).toLowerCase();
            if (ev === 'lock') {
                whereClauses.push(`(al.action ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex+1})`);
                params.push('%lock%', '%khóa%');
                paramIndex += 2;
            } else if (ev === 'unlock') {
                whereClauses.push(`(al.action ILIKE $${paramIndex} OR al.action ILIKE $${paramIndex+1})`);
                params.push('%unlock%', '%mở khóa%');
                paramIndex += 2;
            }
        }
        if (mod) {
            whereClauses.push(`al.module = $${paramIndex++}`);
            params.push(mod);
        }
        if (startDate) {
            whereClauses.push(`al.created_at >= $${paramIndex++}`);
            params.push(startDate);
        }
        if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            whereClauses.push(`al.created_at <= $${paramIndex++}`);
            params.push(endOfDay);
        }
        const whereClauseString = `WHERE ${whereClauses.join(' AND ')}`;

        const dataQuery = `
            SELECT 
                al.id, al.action, al.details, al.created_at, al.module, al.status, al.reason,
                al.username, al.device_type, al.os, al.user_agent_encrypted, al.mac_encrypted, al.ip_encrypted,
                al.country, al.city, al.isp, al.latitude, al.longitude, al.method, al.url, al.session_id,
                u.full_name as user_name, t.title as task_title
            ${baseQuery} ${whereClauseString}
            ORDER BY al.created_at DESC 
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        params.push(limit, offset);
        const { rows } = await pool.query(dataQuery, params);

        const decrypted = rows.map(r => {
            const user_agent = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return null; } })() : null;
            const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return null; } })() : null;
            const mac = r.mac_encrypted ? (() => { try { return decrypt(r.mac_encrypted); } catch(e){ return null; } })() : null;
            const ip_version = ip ? (ip.includes(':') ? 'IPv6' : 'IPv4') : null;
            return {
                ...r,
                user_agent,
                ip,
                mac,
                ip_version
            };
        });

        // Prepare filename and timestamp
        const pad = (n) => String(n).padStart(2, '0');
        const d = new Date();
        const dd = pad(d.getDate()); const mm = pad(d.getMonth()+1); const yyyy = d.getFullYear();
        const hh = pad(d.getHours()); const min = pad(d.getMinutes()); const ss = pad(d.getSeconds());
        const dateOnly = `${dd}${mm}${yyyy}`;
        const datetime = `${dd}${mm}${yyyy}${hh}${min}${ss}`;
        const filenameBase = `xanuicam_audit_${datetime}`;

        if (String(format).toLowerCase() === 'csv') {
            const columns = [
                'id','created_at','user_name','username','status','reason','action','module',
                'ip','ip_version','country','city','isp','latitude','longitude',
                'device_type','user_agent','mac','session_id','url','details'
            ];
            const csvRows = [columns.join(',')];
            for (const r of decrypted) {
                const row = columns.map(c => {
                    const v = r[c] !== undefined && r[c] !== null ? String(r[c]).replace(/\r|\n|,/g, ' ') : '';
                    return `"${v.replace(/"/g,'""')}"`;
                }).join(',');
                csvRows.push(row);
            }
            const bom = '\uFEFF';
            const csvContent = bom + csvRows.join('\n');
            // record action
            try { await pool.query('INSERT INTO audit_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'csv']); } catch(e){}
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
            res.setHeader('X-Download-Options', 'noopen');
            return res.send(csvContent);
        }

        if (String(format).toLowerCase() === 'pdf') {
            try {
                const PDFDocument = require('pdfkit');
                const doc = new PDFDocument({ size: 'A4', margin: 40 });
                const chunks = [];
                doc.on('data', (c) => chunks.push(c));
                doc.on('end', async () => {
                    const result = Buffer.concat(chunks);
                    try { await pool.query('INSERT INTO audit_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'pdf']); } catch(e){}
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
                    res.setHeader('X-Download-Options', 'noopen');
                    return res.send(result);
                });
                doc.fontSize(14).text(`Nhật ký hệ thống - Xuất ${decrypted.length} bản ghi`, { align: 'center' });
                doc.moveDown();
                doc.fontSize(9);
                for (const r of decrypted) {
                    const time = (r.created_at ? new Date(r.created_at).toLocaleString() : '');
                    doc.text(`ID: ${r.id}  Thời gian: ${time}`);
                    doc.text(`Người: ${r.user_name || r.username || '-'}  Module: ${r.module || '-'}  Hành động: ${r.action || '-'} `);
                    doc.text(`Chi tiết: ${r.details ? String(r.details).slice(0, 300) : '-'} `);
                    doc.moveDown(0.5);
                }
                doc.end();
                return;
            } catch (e) {
                console.error('Failed to generate PDF bulk export', e);
                return res.status(500).json({ message: 'Lỗi khi tạo PDF' });
            }
        }

        // Default: xlsx
        try {
            const wb = new ExcelJS.Workbook();
            const sheetName = (`xanuicam_audit_${dateOnly}`).substring(0,31);
            const ws = wb.addWorksheet(sheetName);
            const columns = [
                { header: 'ID', key: 'id' }, { header: 'Thời gian', key: 'created_at' }, { header: 'Tên người thao tác', key: 'user_name' },
                { header: 'Tên đăng nhập', key: 'username' }, { header: 'Hành động', key: 'action' }, { header: 'Module', key: 'module' },
                { header: 'IP', key: 'ip' }, { header: 'IP Version', key: 'ip_version' }, { header: 'Quốc gia', key: 'country' }, { header: 'Thành phố', key: 'city' },
                { header: 'ISP', key: 'isp' }, { header: 'Thiết bị', key: 'device_type' }, { header: 'UserAgent', key: 'user_agent' }, { header: 'MAC', key: 'mac' }, { header: 'URL', key: 'url' }, { header: 'Chi tiết', key: 'details' }
            ];
            ws.columns = columns;
            for (const r of decrypted) {
                ws.addRow({
                    id: r.id,
                    created_at: r.created_at ? r.created_at.toISOString() : '',
                    user_name: r.user_name || '',
                    username: r.username || '',
                    action: r.action || '',
                    module: r.module || '',
                    ip: r.ip || '',
                    ip_version: r.ip_version || '',
                    country: r.country || '',
                    city: r.city || '',
                    isp: r.isp || '',
                    device_type: r.device_type || '',
                    user_agent: r.user_agent || '',
                    mac: r.mac || '',
                    url: r.url || '',
                    details: r.details || ''
                });
            }
            // write and send
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            await wb.xlsx.write(res);
            res.end();
            try { await pool.query('INSERT INTO audit_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'xlsx']); } catch(e){}
            return;
        } catch (e) {
            console.error('Failed to create XLSX', e);
            return res.status(500).json({ message: 'Lỗi khi tạo file Excel' });
        }

    } catch (error) {
        console.error('exportAuditBulk error', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Accept an audit event from authenticated frontend clients and write to audit_logs
exports.createAuditEntry = async (req, res) => {
    try {
        const body = req.body || {};
        // Accept flexible shape from frontend: prefer action/module/details, allow resource_type/resource_id
        const action = body.action || body.event || 'frontend.event';
        const module = body.module || body.resource_type || body.module_name || null;
        const details = body.details || body.message || (body.meta ? JSON.stringify(body.meta) : null);
        const resourceType = body.resource_type || null;
        const resourceId = body.resource_id || body.id || null;
        const userId = req.user && req.user.id ? req.user.id : null;

        const logData = {
            userId: userId || null,
            username: req.user && req.user.username ? req.user.username : null,
            module: module || (resourceType ? String(resourceType) : null),
            action: action,
            details: details,
            taskId: resourceType === 'task' ? resourceId : null,
            deviceType: req.headers['x-device-type'] || null,
            userAgent: req.headers['user-agent'] || null,
            ip: (req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress || '').split(',')[0].trim(),
            sessionId: req.user && req.user.sid ? req.user.sid : (req.headers['x-session-id'] || null),
            change: body.change || null
        };

        try {
            const logActivity = require('../utils/auditLogger');
            await logActivity(require('../db'), logData);
        } catch (e) {
            // non-fatal
            console.warn('createAuditEntry: logActivity failed (ignored):', e && e.message ? e.message : e);
        }

        return res.status(204).send();
    } catch (error) {
        console.error('Error creating audit entry:', error);
        return res.status(500).json({ message: 'Lỗi khi ghi nhật ký hoạt động.' });
    }
};

// Lightweight endpoint for frontend to create an audit entry.
// This accepts a minimal payload and delegates to the centralized `logActivity` helper.
exports.createAuditEntry = async (req, res) => {
    try {
        const body = req.body || {};
        const actor = req.user || {};
        const logData = {
            userId: actor.id || null,
            username: actor.username || null,
            module: body.module || body.moduleName || 'Frontend',
            action: body.action || body.event || 'unknown',
            details: body.details || body.message || null,
            taskId: body.task_id || body.taskId || null,
            targetUserId: body.target_user_id || body.targetUserId || null,
            ip: req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (req.ip || null),
            method: req.method,
            url: req.originalUrl
        };
        // fire-and-forget; do not await so caller isn't blocked by audit writes
        try { logActivity(pool, logData); } catch (e) { /* swallow */ }
        res.json({ ok: true });
    } catch (error) {
        console.error('Failed to create audit entry:', error);
        res.status(500).json({ ok: false });
    }
};