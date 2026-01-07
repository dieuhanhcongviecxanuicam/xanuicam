// ubndxanuicam/backend/src/utils/auditLogger.js
// VERSION 3.0 - Expanded fields and encryption for sensitive data

const { encrypt, sha256Hex } = require('./encryption');
const { broadcaster } = require('./auditBroadcaster');
const bcrypt = require('bcryptjs');
const pool = require('../db');

// Cache whether the optional audit columns (like change_payload_json) exist
// to avoid repeatedly attempting UPDATEs that will fail on older schemas.
let optionalColumnsAvailable = null;
const detectOptionalColumns = async () => {
    if (optionalColumnsAvailable !== null) return optionalColumnsAvailable;
    try {
        const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='change_payload_json' LIMIT 1");
        optionalColumnsAvailable = (r && r.rows && r.rows.length > 0);
    } catch (e) {
        optionalColumnsAvailable = false;
    }
    return optionalColumnsAvailable;
};
/**
 * Centralized audit logger. Accepts either a connected client or the pool (both have .query).
 * logData can include many optional fields useful for tracing login/activity events.
 */
// Make audit logging fire-and-forget: callers may `await logActivity`, but the
// function will resolve immediately while the actual DB work runs asynchronously
// so audit writes never block request handlers or tie up pooled connections.
const logActivity = (clientOrPool, logData = {}) => {
    // schedule async work on the next tick and return a resolved promise
    (async () => {
        try {
        // The canonical `audit_logs` table in the current schema is small and may
        // include only a few columns. To avoid insert failures when migrations
        // are not applied, write a minimal, compatible insert using columns that
        // are guaranteed to exist in the base schema.
        // Base, compatible insert for older schemas
        const qBase = `
            INSERT INTO audit_logs (
                user_id, username, task_id, module, action, details
            ) VALUES (
                $1,$2,$3,$4,$5,$6
            )`;

        // If caller provided a targetUserId we will attempt to persist it as
        // `target_user_id` when the schema supports it. We attempt the richer
        // insert first and fall back to the base insert on failure to remain
        // compatible with older deployments.
        const qWithTarget = `
            INSERT INTO audit_logs (
                user_id, username, target_user_id, task_id, module, action, details
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7
            )`;

        const {
            userId = null, username = null, status = null, reason = null,
            deviceType = null, os = null, userAgent = null, mac = null,
            ip = null, country = null, city = null, isp = null,
            method = null, url = null, sessionId = null, module = null,
            action = null, details = null, taskId = null
        } = logData;

        // To avoid interfering with an ongoing transaction in the caller, perform
        // all lookup/inserts for audit logging using the shared pool (separate connection).
        // This makes audit logging best-effort and non-fatal for the caller.
        let resolvedUsername = username;
        let effectiveUserId = userId || null;
        try {
            if (!resolvedUsername && effectiveUserId) {
                const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [effectiveUserId]);
                if (userRes && userRes.rows && userRes.rows[0]) resolvedUsername = userRes.rows[0].username;
            }
        } catch (e) {
            // ignore
        }

        if (!effectiveUserId) {
            try {
                const names = ['__system__', 'system', 'audit', 'admin'];
                let found = null;
                for (const n of names) {
                    const r = await pool.query('SELECT id, username FROM users WHERE username = $1 LIMIT 1', [n]);
                    if (r && r.rows && r.rows[0]) { found = r.rows[0]; break; }
                }
                if (found) {
                    effectiveUserId = found.id;
                    if (!resolvedUsername) resolvedUsername = found.username;
                } else {
                    const pw = bcrypt.hashSync(Math.random().toString(36), 10);
                    try {
                        const ins = await pool.query("INSERT INTO users (cccd, password_hash, full_name, username, role_id, is_active) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username",
                            ['000000000002', pw, 'System (audit)', '__system__', 1, false]);
                        effectiveUserId = ins.rows[0].id;
                        resolvedUsername = ins.rows[0].username;
                    } catch (ie) {
                        const rr = await pool.query('SELECT id, username FROM users WHERE username = $1 LIMIT 1', ['__system__']);
                        if (rr && rr.rows && rr.rows[0]) { effectiveUserId = rr.rows[0].id; resolvedUsername = rr.rows[0].username; }
                    }
                }
            } catch (e) {
                // best-effort
            }
        }

        const uaEnc = userAgent ? encrypt(userAgent) : null;
        const uaHash = userAgent ? sha256Hex(userAgent) : null;
        const macEnc = mac ? encrypt(mac) : null;
        const macHash = mac ? sha256Hex(mac) : null;
        const ipEnc = ip ? encrypt(ip) : null;
        const ipHash = ip ? sha256Hex(ip) : null;

        // DO NOT enrich geo here; worker will enrich asynchronously.
        // Use a minimal param set matching the reduced INSERT above. We avoid
        // failing when the database schema is older by only inserting fields we
        // know exist. This preserves core audit behavior (who, what, when).
        let insertRes = null;
        const paramsBase = [effectiveUserId, resolvedUsername || '__unknown__', taskId, module, action, details];
        // If we do not have a valid effectiveUserId (e.g. anonymous / failed lookup),
        // some schemas may have user_id NOT NULL which causes insert errors. In that
        // case fall back to inserting without the user_id column (store username only)
        // to avoid constraint violations and keep audit logging best-effort.
        const qWithoutUserId = `
            INSERT INTO audit_logs (
                username, task_id, module, action, details
            ) VALUES ($1,$2,$3,$4,$5)
        `;
        try {
            if (logData && logData.targetUserId && effectiveUserId) {
                // attempt richer insert with target_user_id (requires user_id present)
                const paramsWithTarget = [effectiveUserId, resolvedUsername || '__unknown__', Number(logData.targetUserId), taskId, module, action, details];
                const qReturn = qWithTarget + ' RETURNING id, user_id, module, action, created_at, task_id';
                insertRes = await pool.query(qReturn, paramsWithTarget);
            } else if (effectiveUserId) {
                const qReturn = qBase + ' RETURNING id, user_id, module, action, created_at, task_id';
                insertRes = await pool.query(qReturn, paramsBase);
            } else {
                // No effective user id available: insert without user_id to avoid
                // NOT NULL constraint violations on some schemas.
                const qReturn = qWithoutUserId + ' RETURNING id, NULL::integer as user_id, module, action, created_at, task_id';
                const paramsNoUser = [resolvedUsername || '__unknown__', taskId, module, action, details];
                insertRes = await pool.query(qReturn, paramsNoUser);
            }
        } catch (e) {
            // Best-effort only: if the insert fails (e.g., column missing or constraint),
            // try the minimal insert(s) and do not propagate errors further. We must never throw
            // from the audit logger because audit failures must not break application flows.
            try {
                if (effectiveUserId) {
                    insertRes = await pool.query(qBase + ' RETURNING id, user_id, module, action, created_at, task_id', paramsBase);
                } else {
                    const paramsNoUser = [resolvedUsername || '__unknown__', taskId, module, action, details];
                    insertRes = await pool.query(qWithoutUserId + ' RETURNING id, NULL::integer as user_id, module, action, created_at, task_id', paramsNoUser);
                }
            } catch (ie) {
                console.warn('Audit logger: insert failed (ignored):', ie && ie.message ? ie.message : ie);
                insertRes = null;
            }
        }

        // Publish SSE event with non-sensitive fields
        try {
            const row = insertRes && insertRes.rows && insertRes.rows[0] ? insertRes.rows[0] : null;
            if (row) {
                broadcaster.emit('new_audit', {
                    id: row.id,
                    user_id: row.user_id,
                    module: row.module,
                    action: row.action,
                    created_at: row.created_at,
                    task_id: row.task_id
                });
            }
        } catch (e) {
            // non-fatal: broadcasting failure should not affect caller
            console.warn('Audit logger: broadcaster emit failed (ignored):', e && e.message ? e.message : e);
        }
        // Attempt to persist any optional/enriched fields to the audit_logs row we just created.
        // This is best-effort: if the deployment schema doesn't include these columns the UPDATE will fail and we ignore it.
        try {
            if (insertRes && insertRes.rows && insertRes.rows[0]) {
                const hasOptional = await detectOptionalColumns();
                if (!hasOptional) {
                    // Schema does not support optional columns; skip update to avoid noise
                } else {
                    const auditId = insertRes.rows[0].id;
                    const uaEnc = userAgent ? encrypt(userAgent) : null;
                    const uaHash = userAgent ? sha256Hex(userAgent) : null;
                    const macEnc = mac ? encrypt(mac) : null;
                    const macHash = mac ? sha256Hex(mac) : null;
                    const ipEnc = ip ? encrypt(ip) : null;
                    const ipHash = ip ? sha256Hex(ip) : null;
                    const updQ = `UPDATE audit_logs SET user_agent_encrypted = $1, ua_hash = $2, mac_encrypted = $3, mac_hash = $4, ip_encrypted = $5, ip_hash = $6, device_type = $7, os = $8, country = $9, city = $10, isp = $11, latitude = $12, longitude = $13, session_id = $14, method = $15, url = $16, change_payload_json = $17 WHERE id = $18`;
                    const updParams = [uaEnc, uaHash, macEnc, macHash, ipEnc, ipHash, deviceType, os, country, city, isp, logData.latitude || null, logData.longitude || null, sessionId, logData.method || null, logData.url || null, logData.change ? JSON.stringify(logData.change) : null, auditId];
                    try {
                        await pool.query(updQ, updParams);
                    } catch (ue) {
                        // ignore update errors even if optionalColumnsAvailable was true (race or partial migrations)
                        console.warn('Audit logger: optional update failed (ignored):', ue && ue.message ? ue.message : ue);
                    }
                }
            }
        } catch (e) {
            // non-fatal
        }
        } catch (error) {
            console.warn('Audit logger error (ignored):', error && error.message ? error.message : error);
        }
    })();
    return Promise.resolve();
};

module.exports = logActivity;