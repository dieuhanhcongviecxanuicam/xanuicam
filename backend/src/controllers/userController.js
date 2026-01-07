const pool = require('../db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const logActivity = require('../utils/auditLogger');
const { decrypt } = require('../utils/encryption');
const speakeasy = require('speakeasy');

const deleteFile = (filePath) => {
    if (filePath) {
        const fullPath = path.join(__dirname, '..', '..', filePath);
        fs.unlink(fullPath, (err) => {
            if (err) console.error(`Lỗi khi xóa tệp ${filePath}:`, err);
        });
    }
};

exports.getUsers = async (req, res) => {
    const { page = 1, limit = 15, search = '', departmentId = '', created_from = '', mfa_enabled = '', locked = '', no_department = '' } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    // allow `limit=0` to mean "no pagination / return all"
    const pageSize = (req.query.limit !== undefined) ? parseInt(limit, 10) : 15;
    const noPagination = pageSize === 0;
    const offset = noPagination ? 0 : (pageNum - 1) * pageSize;

    try {
        // Ensure helpful Postgres extensions are available locally for improved search
        // (unaccent for diacritics-insensitive search, pg_trgm for fuzzy matching).
        try {
            await pool.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
            await pool.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        } catch (extErr) {
            // Not fatal: extensions may not be creatable in hosted environments.
            // We'll fall back to plain ILIKE if extension creation fails.
        }

        const whereClauses = [];
        const params = [];
        let idx = 1;

        if (search) {
            const cleaned = String(search).trim();
            const isPhrase = /\s|\d/.test(cleaned);
            if (isPhrase) {
                // Phrase-like queries (contains space or digits) -> prefer exact phrase match
                whereClauses.push(`(
                    unaccent(lower(u.full_name)) = unaccent(lower($${idx})) OR
                    unaccent(lower(u.username)) = unaccent(lower($${idx})) OR
                    unaccent(lower(u.email)) = unaccent(lower($${idx}))
                )`);
                params.push(cleaned);
                idx++;
            } else {
                // Use unaccent + ILIKE with pattern for predictable incremental search
                // and include pg_trgm similarity as a fallback for fuzzy matching.
                whereClauses.push(`(
                    unaccent(lower(u.full_name)) LIKE unaccent(lower($${idx})) OR
                    unaccent(lower(u.username)) LIKE unaccent(lower($${idx})) OR
                    unaccent(lower(u.email)) LIKE unaccent(lower($${idx})) OR
                    (similarity(unaccent(lower(u.full_name)), unaccent(lower($${idx}))) > 0.3) OR
                    (similarity(unaccent(lower(u.username)), unaccent(lower($${idx}))) > 0.35)
                )`);
                params.push(`%${cleaned}%`);
                idx++;
            }
        }
        // If no_department is requested, override departmentId filter and show only users without department
        const noDeptTruth = (no_department === true || no_department === '1' || no_department === 'true');
        if (noDeptTruth) {
            whereClauses.push(`u.department_id IS NULL`);
        } else if (departmentId) {
            whereClauses.push(`u.department_id = $${idx}`);
            params.push(parseInt(departmentId, 10));
            idx++;
        }

        if (created_from) {
            // Expecting YYYY-MM-DD format from frontend date input
            whereClauses.push(`u.created_at >= $${idx}`);
            params.push(created_from);
            idx++;
        }

        if (mfa_enabled !== undefined && mfa_enabled !== '') {
            if (mfa_enabled === '1' || mfa_enabled === 'true' || mfa_enabled === true) {
                whereClauses.push(`u.mfa_enabled = true`);
            } else if (mfa_enabled === '0' || mfa_enabled === 'false') {
                whereClauses.push(`u.mfa_enabled = false`);
            }
        }

        if (locked !== undefined && locked !== '') {
            if (locked === '1' || locked === 'true' || locked === true) {
                whereClauses.push(`u.is_active = false`);
            } else if (locked === '0' || locked === 'false') {
                whereClauses.push(`u.is_active = true`);
            }
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Remove noisy file-backed debug logging in production; keep server console logs minimal
        if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_LOGS === 'true') {
            try {
                const logDir = path.join(__dirname, '..', '..', 'logs');
                const logFile = path.join(logDir, 'server.log');
                const timestamp = new Date().toISOString();
                const msg = `${timestamp} DEBUG getUsers: whereSql=${whereSql} params=${JSON.stringify({ page: pageNum, limit: pageSize, search, departmentId })}\n`;
                if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
                fs.appendFileSync(logFile, msg);
            } catch (logErr) {
                // swallow logging errors to avoid impacting response
            }
        }

            const totalRes = await pool.query(`SELECT COUNT(*) FROM users u ${whereSql}`, params);
            const totalItems = parseInt(totalRes.rows[0].count, 10) || 0;
            // total count of all users (no filters) for UI summary
            const totalAllRes = await pool.query('SELECT COUNT(*) FROM users');
            const totalAll = parseInt(totalAllRes.rows[0].count, 10) || 0;

        // compute counts for locked and no-department within the same filtered set
        const lockedWhere = whereSql ? `${whereSql} AND u.is_active = false` : 'WHERE u.is_active = false';
        const lockedRes = await pool.query(`SELECT COUNT(*) FROM users u ${lockedWhere}`, params);
        const lockedCount = parseInt(lockedRes.rows[0].count, 10) || 0;

        const noDeptWhere = whereSql ? `${whereSql} AND u.department_id IS NULL` : 'WHERE u.department_id IS NULL';
        const noDeptRes = await pool.query(`SELECT COUNT(*) FROM users u ${noDeptWhere}`, params);
        const noDeptCount = parseInt(noDeptRes.rows[0].count, 10) || 0;

        // add pagination params (only if using pagination)
        let dataQuery;
        if (!noPagination) {
            params.push(pageSize, offset);
            dataQuery = `
                  SELECT u.id, u.username, u.cccd, u.ma_cong_chuc, u.full_name, u.email, u.phone_number, u.birth_date, u.avatar, u.note, u.is_active, u.is_leader,
                      r.id as role_id, r.role_name, r.color as role_color,
                      d.id as department_id, d.name as department_name, m.full_name as department_manager_name,
                      (SELECT COUNT(*)::int FROM tasks t WHERE t.assignee_id = u.id) as task_count
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                  LEFT JOIN departments d ON u.department_id = d.id
                  LEFT JOIN users m ON d.manager_id = m.id
                ${whereSql}
                ORDER BY u.full_name
                LIMIT $${idx} OFFSET $${idx + 1}
            `;
        } else {
            // no LIMIT/OFFSET when pageSize === 0
            dataQuery = `
                SELECT u.id, u.username, u.cccd, u.ma_cong_chuc, u.full_name, u.email, u.phone_number, u.birth_date, u.avatar, u.note, u.is_active, u.is_leader,
                       r.id as role_id, r.role_name, r.color as role_color,
                       d.id as department_id, d.name as department_name,
                       (SELECT COUNT(*)::int FROM tasks t WHERE t.assignee_id = u.id) as task_count
                FROM users u
                LEFT JOIN roles r ON u.role_id = r.id
                LEFT JOIN departments d ON u.department_id = d.id
                ${whereSql}
                ORDER BY u.full_name
            `;
        }

        const { rows } = await pool.query(dataQuery, params);
            const totalPages = noPagination ? 1 : Math.max(1, Math.ceil(totalItems / (pageSize || 1)));
            res.json({ data: rows, pagination: { currentPage: pageNum, totalItems, totalPages }, meta: { total: totalItems, totalAll, locked: lockedCount, no_department: noDeptCount } });
    } catch (error) {
        console.error('Lỗi khi tải danh sách người dùng:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

exports.createUser = async (req, res) => {
    const { cccd, password, fullName, role_id, department_id, note, username, email, phone_number, birth_date } = req.body || {};
    let { is_leader } = req.body || {};
    // accept HTML checkbox 'on' as true
    if (is_leader === 'on') is_leader = 'true';
    // Require only: fullName, username, password
    if (!fullName || !String(fullName).trim()) return res.status(400).json({ message: 'Họ và Tên là bắt buộc.' });
    if (!username || !String(username).trim()) return res.status(400).json({ message: 'Tên đăng nhập là bắt buộc.' });
    if (!password || !String(password).trim()) return res.status(400).json({ message: 'Mật khẩu là bắt buộc.' });
    const actor = req.user || {};
    const actorId = Number.isInteger(actor.id) && actor.id > 0 ? actor.id : null;
    const actorName = actor.fullName || 'Hệ thống';
    const client = await pool.connect();
    try {
        // Enforce server-side hard cap of active accounts to avoid excessive users
        const cap = Number(process.env.USER_ACCOUNT_CAP || 1000);
        try {
                // Count active users plus archived (deleted_users) to enforce global cap
                const totRes = await pool.query('SELECT (SELECT COUNT(*) FROM users) as active_count, (SELECT COUNT(*) FROM deleted_users) as archived_count');
                const active = parseInt(totRes.rows[0].active_count || '0', 10) || 0;
                const archived = parseInt(totRes.rows[0].archived_count || '0', 10) || 0;
                const totalUsers = active + archived;
                if (totalUsers >= cap) {
                    return res.status(400).json({ message: `Số lượng tài khoản đã đạt giới hạn tối đa (${cap}). Vui lòng xóa bớt tài khoản hoặc xoá vĩnh viễn tài khoản trong phần 'Tài khoản đã xóa' trước khi thêm.` });
                }
        } catch (e) {
            console.error('DEBUG createUser: could not enforce account cap, continuing:', e && (e.stack || e));
        }
    } catch (e) {
        // fall-through to normal flow
    }
    
    try {
        await client.query('BEGIN');
        
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        // Coerce numeric fields to integers or null to avoid PostgreSQL integer parse errors
        const roleId = (role_id !== undefined && role_id !== null && role_id !== '') ? parseInt(role_id, 10) : null;
        const departmentId = (department_id !== undefined && department_id !== null && department_id !== '') ? parseInt(department_id, 10) : null;

        const query = `
            INSERT INTO users (cccd, ma_cong_chuc, password_hash, full_name, role_id, department_id, note, username, email, phone_number, birth_date, is_leader)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, full_name, is_leader
        `;
        const params = [
            (cccd !== undefined && cccd !== null && String(cccd).trim() !== '') ? cccd : null,
            (req.body && req.body.ma_cong_chuc && String(req.body.ma_cong_chuc).trim() !== '') ? String(req.body.ma_cong_chuc).trim() : null,
            password_hash,
            fullName,
            roleId,
            departmentId,
            note || null,
            username || null,
            email || null,
            phone_number || null,
            birth_date || null,
            (is_leader === true || is_leader === '1' || is_leader === 'true')
        ];

        const { rows } = await client.query(query, params);

        // Debug: log insertion result only in non-production debug mode
        try {
            if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_LOGS === 'true') console.debug('userController.createUser: inserted', rows[0]);
        } catch (e) {}

        // Ghi nhật ký nếu có actor hợp lệ. Wrap in try/catch so logging failures
        // do not cause the main user creation transaction to rollback.
        if (actorId) {
            try {
                await logActivity(client, {
                    userId: actorId,
                    module: 'Tài khoản',
                    action: 'Tạo mới',
                    details: `${actorName} đã tạo tài khoản mới cho người dùng "${fullName}".`
                });
            } catch (logErr) {
                console.error('DEBUG userController.createUser: audit log failed, continuing:', logErr && (logErr.stack || logErr));
            }
        }
        // Nếu gán phòng ban khi tạo user, đồng bộ người phụ trách của phòng đó
        const newUser = rows[0];
        if (departmentId) {
            try {
                await client.query('UPDATE departments SET manager_id = $1 WHERE id = $2', [newUser.id, departmentId]);
            } catch (syncErr) {
                console.error('Lỗi khi đồng bộ phòng ban sau khi tạo user:', syncErr);
            }
        }
        
        await client.query('COMMIT');
        try {
            if (process.env.NODE_ENV !== 'production' && process.env.DEBUG_LOGS === 'true') console.debug('userController.createUser: COMMIT success for user', rows[0].id);
        } catch (e) {}
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        
        if (error.code === '23505') {
            if (error.constraint && error.constraint.includes('cccd')) return res.status(400).json({ message: 'Số CCCD này đã tồn tại.' });
            if (error.constraint && error.constraint.includes('username')) return res.status(400).json({ message: 'Tên đăng nhập này đã tồn tại.' });
            if (error.constraint && error.constraint.includes('email')) return res.status(400).json({ message: 'Email này đã được sử dụng.' });
        }
        console.error("Lỗi khi tạo người dùng:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    // Debug helper: log incoming request summary to help diagnose hanging requests
    try {
        if (process.env.NODE_ENV !== 'production') {
            const hdrs = Object.keys(req.headers || {}).reduce((acc, k) => { acc[k] = req.headers[k]; return acc; }, {});
            const bodyKeys = req.body ? Object.keys(req.body) : [];
            const hasFile = !!req.file;
            console.debug(`DEBUG updateUser: incoming request for id=${id} headers=${Object.keys(req.headers).join(',')} bodyKeys=${bodyKeys.join(',')} hasFile=${hasFile}`);
        }
    } catch (e) {
        console.error('DEBUG updateUser: failed to log incoming request summary', e && (e.stack || e));
    }
    // Per-request timeout guard: if the handler takes too long, return 504
    try {
        const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 30000;
        const timeoutId = setTimeout(() => {
            try {
                if (!res.headersSent) {
                    console.error(`DEBUG updateUser: request timed out after ${REQUEST_TIMEOUT_MS}ms for id=${id}`);
                    res.status(504).json({ message: 'Yêu cầu quá lâu, vui lòng thử lại sau.' });
                }
            } catch (e) {
                console.error('DEBUG updateUser: error while sending timeout response', e && (e.stack || e));
            }
        }, REQUEST_TIMEOUT_MS);
        // clear timeout when response finishes normally
        res.on('finish', () => clearTimeout(timeoutId));
    } catch (e) {
        console.error('DEBUG updateUser: failed to install timeout guard', e && (e.stack || e));
    }
    // protect superadmin from being modified by non-superadmins
    try {
        const t_check_start = Date.now();
        const checkRes = await pool.query('SELECT is_superadmin FROM users WHERE id = $1', [id]);
        const t_check = Date.now() - t_check_start;
        console.debug(`DEBUG updateUser: check is_superadmin for id=${id} took ${t_check}ms`);
        if (checkRes.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        const targetIsSuper = checkRes.rows[0].is_superadmin;
        if (targetIsSuper && req.user.id !== Number(id) && !req.user.is_superadmin) {
            return res.status(403).json({ message: 'Không có quyền thay đổi tài khoản Superadmin.' });
        }
    } catch (e) {
        console.error('Lỗi kiểm tra quyền người dùng:', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
    const { cccd, fullName, role_id, department_id, note, is_active, username, email, phone_number, birth_date, password, is_leader } = req.body;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    // Helper to format remaining time (ms -> "X ngày Y giờ Z phút")
    const formatDuration = (ms) => {
        if (!ms || ms <= 0) return '0s';
        const sec = Math.floor(ms / 1000);
        const days = Math.floor(sec / 86400);
        const hours = Math.floor((sec % 86400) / 3600);
        const minutes = Math.floor((sec % 3600) / 60);
        const seconds = sec % 60;
        const parts = [];
        if (days) parts.push(`${days} ngày`);
        if (hours) parts.push(`${hours} giờ`);
        if (minutes) parts.push(`${minutes} phút`);
        if (!days && !hours && !minutes) parts.push(`${seconds} giây`);
        return parts.join(' ');
    };

    // If an admin is editing another user, enforce a daily limit of 3 edits per admin (based on audit_logs history)
    try {
        // Enforce per-target daily limit: an admin may edit a specific target user
        // up to 2 times per day. Use a lightweight `user_update_actions` table to
        // reliably track actor->target updates without depending on `audit_logs`
        // which may have FK constraints (task_id) in some schemas.
        if (req.user && (req.user.is_superadmin || (req.user.permissions && req.user.permissions.includes('user_management'))) && req.user.id !== Number(id)) {
            const targetId = Number(id);
            try {
                // ensure the tracking table exists (no-op if already created)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS user_update_actions (
                        id SERIAL PRIMARY KEY,
                        actor_id INTEGER NOT NULL,
                        target_user_id INTEGER NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                `);

                // Enforce one edit per target per calendar day starting at 07:00 Asia/Ho_Chi_Minh
                const t_count_start = Date.now();
                const countRes = await pool.query(
                    "SELECT COUNT(*) FROM user_update_actions WHERE actor_id = $1 AND target_user_id = $2 AND created_at >= ((date_trunc('day', timezone('Asia/Ho_Chi_Minh', now())) + interval '7 hour') AT TIME ZONE 'Asia/Ho_Chi_Minh')",
                    [actorId, targetId]
                );
                const t_count = Date.now() - t_count_start;
                console.debug(`DEBUG updateUser: user_update_actions count for actor=${actorId} target=${targetId} took ${t_count}ms`);
                const editsTodayForTarget = parseInt(countRes.rows[0].count || '0', 10);
                if (editsTodayForTarget >= 1) {
                    // seconds until next 07:00 Asia/Ho_Chi_Minh
                        // compute next VN 07:00 (Asia/Ho_Chi_Minh) as the next calendar day at 07:00
                        // VN is UTC+7, so VN 07:00 corresponds to UTC 00:00 of that VN day.
                        const nowUtcMs = Date.now();
                        const nowVnMs = nowUtcMs + 7 * 60 * 60 * 1000;
                        const nextVnDay = new Date(nowVnMs + 24 * 60 * 60 * 1000);
                        const nextVnYear = nextVnDay.getUTCFullYear();
                        const nextVnMonth = nextVnDay.getUTCMonth();
                        const nextVnDate = nextVnDay.getUTCDate();

                        // UTC timestamp for VN 07:00 on nextVNDate is Date.UTC(nextVnYear, nextVnMonth, nextVnDate, 0,0,0)
                        const nextVn07UtcMs = Date.UTC(nextVnYear, nextVnMonth, nextVnDate, 0, 0, 0);
                        const secs = Math.max(0, Math.ceil((nextVn07UtcMs - nowUtcMs) / 1000));

                        // Format display date as dd/mm/yyyy for VN local next-day
                        const dd = String(nextVnDate).padStart(2, '0');
                        const mm = String(nextVnMonth + 1).padStart(2, '0');
                        const yyyy = String(nextVnYear);
                        const display = `07 giờ 00 ngày ${dd}/${mm}/${yyyy}`;

                        return res.status(403).json({ message: `Vượt quá số lần chỉnh sửa, bạn có thể chỉnh sửa thông tin sau ${display}`, retry_after_seconds: secs });
                }
            } catch (e) {
                console.error('DEBUG updateUser: user_update_actions check failed, continuing without rate-limit:', e && (e.stack || e));
            }
        }
    } catch (e) {
        console.error('DEBUG updateUser: could not enforce per-target daily edit limit, proceeding:', e && (e.stack || e));
    }

    // If a user is editing their own profile via this endpoint, enforce the 30-day profile lock
    try {
        if (req.user && req.user.id === Number(id)) {
            const t_profile_start = Date.now();
            const tsRes = await pool.query('SELECT profile_last_updated_at FROM users WHERE id = $1', [id]);
            const t_profile = Date.now() - t_profile_start;
            console.debug(`DEBUG updateUser: profile_last_updated_at fetch for id=${id} took ${t_profile}ms`);
            const last = tsRes.rows.length ? tsRes.rows[0].profile_last_updated_at : null;
                if (last) {
                    const diffMs = Date.now() - new Date(last).getTime();
                    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
                    if (diffMs < THIRTY_DAYS_MS) {
                        const remainingMs = THIRTY_DAYS_MS - diffMs;
                        const secs = Math.max(0, Math.ceil(remainingMs / 1000));
                        // Return structured data: last update timestamp and next allowed date (server-side computed)
                        const lastDt = new Date(last);
                        const nextAllowed = new Date(lastDt.getTime() + THIRTY_DAYS_MS);
                        // Format display message as requested by UX
                        const ldd = String(lastDt.getDate()).padStart(2, '0');
                        const lmm = String(lastDt.getMonth() + 1).padStart(2, '0');
                        const lyyyy = lastDt.getFullYear();
                        const ndd = String(nextAllowed.getDate()).padStart(2, '0');
                        const nmm = String(nextAllowed.getMonth() + 1).padStart(2, '0');
                        const nyyyy = nextAllowed.getFullYear();
                        const message = `Bạn đã chỉnh sửa thông tin vào ngày ${ldd}/${lmm}/${lyyyy}, bạn có thể chỉnh sửa lần kế tiếp vào ngày ${ndd}/${nmm}/${nyyyy}!`;
                        return res.status(403).json({ message, last_profile_update: lastDt.toISOString(), next_allowed_date: nextAllowed.toISOString(), retry_after_seconds: secs });
                    }
                }
        }
    } catch (e) {
        console.error('DEBUG updateUser: could not read profile_last_updated_at, continuing:', e && (e.stack || e));
    }

    try {
        await client.query('BEGIN');
        const t_olduser_start = Date.now();
        const oldUserRes = await pool.query('SELECT avatar, full_name, department_id FROM users WHERE id = $1', [id]);
        const t_olduser = Date.now() - t_olduser_start;
        console.debug(`DEBUG updateUser: old user fetch for id=${id} took ${t_olduser}ms`);
        const oldUser = oldUserRes.rows[0];

        if (!oldUser) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        // Build update object only from fields provided to avoid overwriting with nulls
        const fieldsToUpdate = {};
        const addField = (dbKey, value, coerceFn) => {
            if (value !== undefined) {
                fieldsToUpdate[dbKey] = coerceFn ? coerceFn(value) : value;
            }
        };

        // allow admins/superadmins to update cccd and password (password will be hashed)
        const canManageUser = req.user && (req.user.is_superadmin || (req.user.permissions && req.user.permissions.includes('user_management')));
        if (canManageUser) {
            addField('cccd', cccd, v => (v === '' ? null : v));
            addField('ma_cong_chuc', req.body.ma_cong_chuc, v => (v === '' ? null : v));
            if (password !== undefined && password !== null && String(password).trim() !== '') {
                // we'll hash and set password_hash below
            }
        }

        addField('full_name', fullName);
        addField('ma_cong_chuc', req.body.ma_cong_chuc, v => (v === '' ? null : v));
        addField('role_id', role_id, v => (v !== '' && v !== null ? parseInt(v, 10) : null));
        // persisted boolean flag for leadership independent of role
        // Normalize HTML checkbox 'on' to 'true' so forms submit properly
        const rawIsLeader = req.body && req.body.is_leader;
        const normalizedIsLeader = (rawIsLeader === 'on') ? 'true' : rawIsLeader;
        addField('is_leader', normalizedIsLeader, v => (v === true || v === '1' || v === 'true'));
        addField('department_id', department_id, v => (v !== '' && v !== null ? parseInt(v, 10) : null));
        addField('note', note);
        if (Object.prototype.hasOwnProperty.call(req.body, 'is_active')) addField('is_active', is_active);
        addField('username', username);
        addField('email', email);
        addField('phone_number', phone_number);
        addField('birth_date', birth_date, v => (v === '' || v === null) ? null : v);

        // Normalize any empty-string values to null to avoid Postgres type parse
        // errors (for example: invalid input syntax for type date: "").
        try {
            Object.keys(fieldsToUpdate).forEach(k => {
                if (fieldsToUpdate[k] === '') fieldsToUpdate[k] = null;
            });
        } catch (e) {
            // Non-fatal: continue with original values if normalization fails
            console.error('DEBUG updateUser: failed to normalize empty strings', e && (e.stack || e));
        }

        let setClauses = Object.keys(fieldsToUpdate).map((key, index) => `${key} = $${index + 1}`).join(', ');
        const queryParams = [...Object.values(fieldsToUpdate), id];

        // If the update touches profile-like fields, update profile_last_updated_at as well
        try {
            const profileFields = ['full_name', 'email', 'phone_number', 'birth_date', 'avatar'];
            const touched = Object.keys(fieldsToUpdate || {}).some(k => profileFields.includes(k));
            if (touched) {
                setClauses = setClauses && setClauses.length ? `${setClauses}, profile_last_updated_at = NOW()` : `profile_last_updated_at = NOW()`;
            }
        } catch (e) {
            console.error('DEBUG updateUser: error while deciding to set profile_last_updated_at', e && (e.stack || e));
        }

        // Handle reset_avatar flag if provided (admin-only)
        try {
            if (req.body && (req.body.reset_avatar === true || req.body.reset_avatar === 'true' || req.body.reset_avatar === '1')) {
                // set avatar to NULL
                addField('avatar', null);
                // attempt to remove old avatar file after commit
            }
        } catch (e) {}

        // If password provided and allowed, compute hash and include in update
        if (canManageUser && password !== undefined && password !== null && String(password).trim() !== '') {
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(String(password), salt);
            // add to SQL
            setClauses = setClauses ? `${setClauses}, password_hash = $${Object.keys(fieldsToUpdate).length + 1}` : `password_hash = $1`;
            queryParams.splice(Object.keys(fieldsToUpdate).length, 0, password_hash);
        }

        if (!setClauses || String(setClauses).trim().length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Không có trường nào được cung cấp để cập nhật.' });
        }

        const query = `UPDATE users SET ${setClauses} WHERE id = $${queryParams.length} RETURNING *`;
        const t_update_start = Date.now();
        const { rows } = await client.query(query, queryParams);
        const t_update = Date.now() - t_update_start;
        console.debug(`DEBUG updateUser: main UPDATE for id=${id} took ${t_update}ms`);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        
        // After updating user, synchronize departments.manager_id when appropriate
        const updatedUser = rows[0];
        const newDeptId = updatedUser.department_id;
        const oldDeptId = oldUser ? oldUser.department_id : null;

        try {
            if (newDeptId && newDeptId !== oldDeptId) {
                // Set this user as manager for the new department (synchronize assignment)
                await client.query('UPDATE departments SET manager_id = $1 WHERE id = $2', [id, newDeptId]);
            }

            if ((oldDeptId && !newDeptId) || (oldDeptId && oldDeptId !== newDeptId)) {
                // If user was manager of the old department, clear it
                const oldDeptRes = await client.query('SELECT manager_id FROM departments WHERE id = $1', [oldDeptId]);
                if (oldDeptRes.rows.length > 0 && oldDeptRes.rows[0].manager_id === id) {
                    await client.query('UPDATE departments SET manager_id = NULL WHERE id = $1', [oldDeptId]);
                }
            }
        } catch (syncErr) {
            // Non-fatal: log and continue
            console.error('Lỗi khi đồng bộ phòng ban với người dùng:', syncErr);
        }

        // Determine whether password was updated in this request
        const passwordChanged = (password !== undefined && password !== null && String(password).trim() !== '');
        const updatedName = rows[0] && rows[0].full_name ? rows[0].full_name : fullName || '';
        const pwdNote = passwordChanged ? ' Mật khẩu đã được thay đổi.' : ' Mật khẩu không thay đổi.';
                try {
                        // Compute structured changes between old and new user for audit
                        const changes = {};
                        try {
                            const before = oldUser || {};
                            const after = updatedUser || {};
                            const keys = ['full_name','username','email','phone_number','department_id','role_id','is_active'];
                            keys.forEach(k => {
                                const b = before[k] !== undefined ? before[k] : null;
                                const a = after[k] !== undefined ? after[k] : null;
                                // For department/role ids, store readable fallback when possible
                                if (String(b) !== String(a)) {
                                    changes[k] = { old: b, new: a };
                                }
                            });
                        } catch(e) { /* ignore */ }

                        // Build human-friendly details string that includes old->new where available
                        let detailStr = `${actorName} đã cập nhật thông tin cho người dùng "${updatedName}."${pwdNote}`;
                        const changeKeys = Object.keys(changes);
                        if (changeKeys.length > 0) {
                            const changeFragments = changeKeys.map(k => {
                                const c = changes[k];
                                // map key labels for readability
                                const labelMap = { full_name: 'Họ và tên', username: 'Tên đăng nhập', email: 'Email', phone_number: 'SĐT', department_id: 'Phòng ban', role_id: 'Vai trò', is_active: 'Trạng thái' };
                                const lbl = labelMap[k] || k;
                                return `${lbl}: "${c.old ?? '-'}" → "${c.new ?? '-'}"`;
                            });
                            detailStr = `${actorName} đã cập nhật thông tin cho người dùng "${updatedName}". Thay đổi: ${changeFragments.join('; ')}.`;
                        }

                        // Fire-and-forget the audit log write to avoid blocking the
                        // response/commit with potential locks (do not await).
                        (async () => {
                            try {
                                const t_log_start = Date.now();
                                // Use the shared pool in background so audit writing
                                // doesn't hold the caller's transaction.
                                await logActivity(pool, {
                                    userId: actorId,
                                    targetUserId: Number(id),
                                    module: 'Tài khoản',
                                    action: 'Cập nhật',
                                    details: detailStr,
                                    url: `/users/${id}`,
                                    method: 'PUT',
                                    change: changes
                                });
                                const t_log = Date.now() - t_log_start;
                                console.debug(`DEBUG updateUser: audit log write (bg) for actor=${actorId} target=${id} took ${t_log}ms`);
                            } catch (logErr) {
                                console.error('Error writing audit log (bg):', logErr && (logErr.stack || logErr));
                            }
                        })();
                } catch (logErr) {
                        console.error('Error writing audit log (non-fatal):', logErr && (logErr.stack || logErr));
                }

        // Record actor->target update in the lightweight tracking table so the
        // per-target daily limit can be enforced reliably.
        try {
            await client.query('INSERT INTO user_update_actions (actor_id, target_user_id) VALUES ($1, $2)', [actorId, Number(id)]);
        } catch (e) {
            console.error('DEBUG updateUser: could not insert into user_update_actions:', e && (e.stack || e));
        }
        
        await client.query('COMMIT');
        // After successful commit, if reset_avatar was requested, delete file from disk
        try {
            if (req.body && (req.body.reset_avatar === true || req.body.reset_avatar === 'true' || req.body.reset_avatar === '1')) {
                try { deleteFile(oldUser.avatar); } catch (e) { console.warn('Could not delete old avatar file', e); }
            }
        } catch (e) {}

        // If the actor updated their own account, return a fresh token so the
        // frontend's auth context (header: name/role) can be updated immediately.
        if (actorId === Number(id)) {
            try {
                const updatedUserQuery = `
                    SELECT 
                        u.id, u.username, u.full_name, u.avatar,
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
                const ures = await pool.query(updatedUserQuery, [id]);
                const u = ures.rows[0];
                let finalPermissions = u.permissions || [];
                if (finalPermissions.includes('full_access')) {
                    const allPermsRes = await pool.query('SELECT permission_name FROM permissions');
                    finalPermissions = allPermsRes.rows.map(p => p.permission_name);
                }
                const payload = {
                    user: {
                        id: u.id,
                        username: u.username,
                        fullName: u.full_name,
                        avatar: u.avatar,
                        role: u.role_name,
                        department: u.department_name,
                        permissions: [...new Set(finalPermissions)]
                    }
                };
                const token = require('jsonwebtoken').sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });
                return res.json({ token, user: payload.user, ...rows[0] });
            } catch (e) {
                console.error('DEBUG updateUser: failed to build token after self-update:', e && (e.stack || e));
                return res.json(rows[0]);
            }
        }

        res.json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
         if (error.code === '23505') {
            // Map common unique-constraint names to friendly messages
            try {
                const constraint = (error.constraint || '').toLowerCase();
                if (constraint.includes('username')) return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại.' });
                if (constraint.includes('cccd')) return res.status(400).json({ message: 'Số CCCD đã tồn tại.' });
                if (constraint.includes('email')) return res.status(400).json({ message: 'Email đã được sử dụng.' });
            } catch (e) {}
            return res.status(400).json({ message: 'Thông tin (Tên đăng nhập, CCCD, Email) bị trùng lặp.' });
        }
        console.error("Lỗi khi cập nhật người dùng:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

exports.toggleUserStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    const { id: actorId, fullName: actorName } = req.user;
    // Require actor to have MFA enabled and provide valid TOTP to perform lock/unlock
    try {
        const r = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [actorId]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Actor not found' });
        if (!r.rows[0].mfa_enabled) return res.status(403).json({ message: 'Chỉ người dùng đã bật MFA mới có quyền khoá/mở khoá tài khoản.' });
        const token = req.body && req.body.mfaToken ? String(req.body.mfaToken) : null;
        if (!token) return res.status(400).json({ message: 'Thiếu mã xác thực MFA.' });
        try {
            const secret = r.rows[0].mfa_secret_encrypted ? decrypt(r.rows[0].mfa_secret_encrypted) : null;
            const ok = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 }) : false;
            if (!ok) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });
        } catch (e) {
            console.error('toggleUserStatus: MFA verify error', e);
            return res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
        }
    } catch (e) {
        console.error('toggleUserStatus: error checking actor MFA', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
    const client = await pool.connect();
     try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT full_name, is_superadmin FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        if (userRes.rows[0].is_superadmin && req.user.id !== Number(id) && !req.user.is_superadmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Không có quyền thay đổi trạng thái tài khoản Superadmin.' });
        }
        const targetUserName = userRes.rows[0].full_name;

        if (is_active) {
            await client.query('UPDATE users SET is_active = TRUE, failed_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE id = $1', [id]);
        } else {
            await client.query('UPDATE users SET is_active = $1 WHERE id = $2', [is_active, id]);
        }

        const actionText = is_active ? 'mở khóa' : 'khóa';
        await logActivity(client, {
            userId: actorId,
            targetUserId: Number(id),
            module: 'Tài khoản',
            action: 'Cập nhật trạng thái',
            details: `${actorName} đã ${actionText} tài khoản của người dùng "${targetUserName}".`
        });
        
        await client.query('COMMIT');
        res.json({ message: `Tài khoản đã được ${actionText}.` });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi thay đổi trạng thái người dùng:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();
    // Require actor to have MFA enabled and provide valid TOTP to perform delete
    try {
        const r = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [actorId]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Actor not found' });
        if (!r.rows[0].mfa_enabled) return res.status(403).json({ message: 'Chỉ người dùng đã bật MFA mới có quyền xóa tài khoản.' });
        const token = req.body && req.body.mfaToken ? String(req.body.mfaToken) : null;
        if (!token) return res.status(400).json({ message: 'Thiếu mã xác thực MFA.' });
        try {
            const secret = r.rows[0].mfa_secret_encrypted ? decrypt(r.rows[0].mfa_secret_encrypted) : null;
            const ok = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 }) : false;
            if (!ok) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });
        } catch (e) {
            console.error('deleteUser: MFA verify error', e);
            return res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
        }
    } catch (e) {
        console.error('deleteUser: error checking actor MFA', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
    try {
        // protect superadmin from deletion
        const t = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (t.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        if (t.rows[0].is_superadmin && req.user.id !== Number(id) && !req.user.is_superadmin) {
            return res.status(403).json({ message: 'Không có quyền xóa tài khoản Superadmin.' });
        }

        await client.query('BEGIN');

        const taskCheckQuery = 'SELECT COUNT(*) FROM tasks WHERE creator_id = $1 OR assignee_id = $1';
        const taskCheckResult = await pool.query(taskCheckQuery, [id]);
        if (parseInt(taskCheckResult.rows[0].count, 10) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Không thể xóa vì người dùng này đã tạo hoặc đang được giao công việc." });
        }

        // Clear any department manager references to this user before deletion
        await client.query('UPDATE departments SET manager_id = NULL WHERE manager_id = $1', [id]);

        // Archive the user row into deleted_users table before deleting permanently
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS deleted_users (
                    id SERIAL PRIMARY KEY,
                    orig_user_id INTEGER,
                    username TEXT,
                    cccd TEXT,
                    ma_cong_chuc TEXT,
                    full_name TEXT,
                    email TEXT,
                    phone_number TEXT,
                    birth_date TIMESTAMPTZ,
                    avatar TEXT,
                    note TEXT,
                    is_active BOOLEAN,
                    role_id INTEGER,
                    department_id INTEGER,
                    password_hash TEXT,
                    deleted_by INTEGER,
                    deleted_at TIMESTAMPTZ DEFAULT NOW(),
                    extra JSONB
                )
            `);
        } catch (e) {
            console.error('DEBUG deleteUser: could not ensure deleted_users table exists:', e && (e.stack || e));
        }

        // Select full user row to archive
        const userRow = t.rows[0];
        const insertArchiveQuery = `
            INSERT INTO deleted_users (orig_user_id, username, cccd, ma_cong_chuc, full_name, email, phone_number, birth_date, avatar, note, is_active, role_id, department_id, password_hash, deleted_by, extra)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id
        `;
        const archiveParams = [
            userRow.id,
            userRow.username || null,
            userRow.cccd || null,
            userRow.ma_cong_chuc || null,
            userRow.full_name || null,
            userRow.email || null,
            userRow.phone_number || null,
            userRow.birth_date || null,
            userRow.avatar || null,
            userRow.note || null,
            userRow.is_active || false,
            userRow.role_id || null,
            userRow.department_id || null,
            userRow.password_hash || null,
            actorId || null,
            null
        ];

        const archRes = await client.query(insertArchiveQuery, archiveParams);

        // Now delete from users table
        const deleteQuery = 'DELETE FROM users WHERE id = $1 RETURNING full_name, avatar';
        const { rows } = await client.query(deleteQuery, [id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }

        // Do not remove avatar file from disk when archiving; keep asset for potential restore

        await logActivity(client, {
            userId: actorId,
            targetUserId: Number(id),
            module: 'Tài khoản',
            action: 'Xóa (archive)',
            details: `${actorName} đã xoá người dùng "${rows[0].full_name}" và lưu vào kho lưu trữ.`
        });

        await client.query('COMMIT');
        res.json({ message: 'Người dùng đã được lưu trữ (đã xóa tạm thời).' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi xóa người dùng:", error);
        res.status(500).json({ message: 'Không thể xóa người dùng này. Có thể do họ đang liên quan đến các dữ liệu khác.' });
    } finally {
        client.release();
    }
};

// List archived (deleted) users
exports.getDeletedUsers = async (req, res) => {
    const { limit = 100 } = req.query;
    const lim = Math.min(1000, parseInt(limit, 10) || 100);
    try {
        // Ensure table exists and then list
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_users (
            id SERIAL PRIMARY KEY,
            orig_user_id INTEGER,
            username TEXT,
            cccd TEXT,
            ma_cong_chuc TEXT,
            full_name TEXT,
            email TEXT,
            phone_number TEXT,
            birth_date TIMESTAMPTZ,
            avatar TEXT,
            note TEXT,
            is_active BOOLEAN,
            role_id INTEGER,
            department_id INTEGER,
            password_hash TEXT,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW(),
            extra JSONB
        )`);
    } catch (e) {
        // ignore
    }
    try {
        const { rows } = await pool.query('SELECT * FROM deleted_users ORDER BY deleted_at DESC LIMIT $1', [lim]);
        res.json(rows);
    } catch (e) {
        console.error('Failed to list deleted users:', e && (e.stack || e));
        res.status(500).json({ message: 'Lỗi khi tải người dùng đã xóa.' });
    }
};

// Restore archived user by deleted_users.id
exports.restoreDeletedUser = async (req, res) => {
    const { id } = req.params; // id in deleted_users table
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query('SELECT * FROM deleted_users WHERE id = $1', [id]);
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Bản ghi đã lưu trữ không tồn tại.' });
        }
        const archived = sel.rows[0];

        // Ensure username/email are not currently used
        const conflictQ = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2 LIMIT 1', [archived.username, archived.email]);
        if (conflictQ.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Không thể khôi phục vì tên đăng nhập hoặc email đã được sử dụng bởi tài khoản hiện tại.' });
        }

        const insertQ = `
            INSERT INTO users (cccd, ma_cong_chuc, password_hash, full_name, role_id, department_id, note, username, email, phone_number, birth_date, avatar, is_active)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id, full_name
        `;
        const params = [
            archived.cccd || null,
            archived.ma_cong_chuc || null,
            archived.password_hash || null,
            archived.full_name || null,
            archived.role_id || null,
            archived.department_id || null,
            archived.note || null,
            archived.username || null,
            archived.email || null,
            archived.phone_number || null,
            archived.birth_date || null,
            archived.avatar || null,
            archived.is_active || false
        ];

        const ins = await client.query(insertQ, params);

        // Remove from deleted_users archive
        await client.query('DELETE FROM deleted_users WHERE id = $1', [id]);

        await logActivity(client, {
            userId: actorId,
            targetUserId: ins.rows[0].id,
            module: 'Tài khoản',
            action: 'Khôi phục',
            details: `${actorName} đã khôi phục tài khoản "${ins.rows[0].full_name}" từ kho lưu trữ.`
        });

        await client.query('COMMIT');
        res.json({ message: 'Khôi phục tài khoản thành công.', user: ins.rows[0] });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to restore deleted user:', e && (e.stack || e));
        res.status(500).json({ message: 'Lỗi khi khôi phục người dùng.' });
    } finally {
        client.release();
    }
};

exports.getUserTasks = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT id, title, due_date, status
            FROM tasks
            WHERE assignee_id = $1
            ORDER BY due_date DESC
        `;
        const { rows } = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error(`Lỗi khi tải công việc của người dùng ${id}:`, error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Unlock user endpoint: reset failed attempts and unlock account
exports.unlockUser = async (req, res) => {
    const { id } = req.params;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userRes = await client.query('SELECT full_name, is_superadmin FROM users WHERE id = $1', [id]);
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        }
        if (userRes.rows[0].is_superadmin && req.user.id !== Number(id) && !req.user.is_superadmin) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Không có quyền mở khóa tài khoản Superadmin.' });
        }

        await client.query('UPDATE users SET failed_attempts = 0, is_active = TRUE, locked_until = NULL, updated_at = NOW() WHERE id = $1', [id]);

        await logActivity(client, {
            userId: actorId,
            targetUserId: Number(id),
            module: 'Account',
            action: 'Account Unlocked',
            status: 'success',
            details: `${actorName} unlocked account for "${userRes.rows[0].full_name}".`
        });

        await client.query('COMMIT');
        res.json({ message: 'Tài khoản đã được mở khóa.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi mở khóa người dùng:', error);
        res.status(500).json({ message: 'Không thể mở khóa người dùng.' });
    } finally {
        client.release();
    }
};

exports.getUserById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT u.id, u.username, u.cccd, u.ma_cong_chuc, u.full_name, u.email, u.phone_number, u.birth_date, u.avatar, u.note, u.is_active, u.profile_last_updated_at, u.is_leader,
                   r.id as role_id, r.role_name, d.id as department_id, d.name as department_name, m.full_name as department_manager_name
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN users m ON d.manager_id = m.id
            WHERE u.id = $1
        `;
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng.' });
        res.json(rows[0]);
    } catch (error) {
        console.error(`Lỗi khi tải người dùng ID ${id}:`, error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// GET /api/users/unique?username=...&excludeId=123
exports.checkUnique = async (req, res) => {
    const { username, excludeId } = req.query;
    if (!username) return res.status(400).json({ message: 'username query required' });
    try {
        const q = 'SELECT id FROM users WHERE username = $1 LIMIT 1';
        const r = await pool.query(q, [username]);
        if (r.rows.length === 0) return res.json({ unique: true });
        const existingId = r.rows[0].id;
        if (excludeId && Number(excludeId) === Number(existingId)) return res.json({ unique: true });
        return res.json({ unique: false, message: 'Tên đăng nhập đã được sử dụng.' });
    } catch (e) {
        console.error('checkUnique error', e && (e.stack || e));
        res.status(500).json({ message: 'Lỗi máy chủ khi kiểm tra.' });
    }
};

const formatTimestamp = (d = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return { fileDate: `${dd}${mm}${yyyy}${hh}${min}${ss}`, sheetDate: `${dd}${mm}${yyyy}` };
}

// Export users in various formats. Requires body { format, filters, password }
exports.exportUsers = async (req, res) => {
    const { format = 'xlsx', filters = {}, password } = req.body || {};
    const actor = req.user || {};
    const actorId = actor.id;
    if (!actorId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        // Enforce MFA-only export: only users with MFA enabled may export and must provide a valid TOTP code
        const pwRes = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [actorId]);
        if (!pwRes.rows.length) return res.status(404).json({ message: 'User not found' });
        const mfaEnabled = !!pwRes.rows[0].mfa_enabled;
        const secretEnc = pwRes.rows[0].mfa_secret_encrypted;
        if (!mfaEnabled) {
            return res.status(403).json({ message: 'Chỉ người dùng đã bật MFA mới được phép xuất báo cáo. Vui lòng bật MFA trước khi thực hiện.' });
        }
        const token = req.body && req.body.mfaToken ? String(req.body.mfaToken) : null;
        if (!token) return res.status(400).json({ message: 'Thiếu mã xác thực MFA.' });
        try {
            const secret = secretEnc ? decrypt(secretEnc) : null;
            const ok = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 }) : false;
            if (!ok) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });
        } catch (e) {
            console.error('exportUsers: MFA verify error', e);
            return res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
        }

        // MFA succeeded — do not apply daily export limits for MFA-enabled users

        // Build filters - reuse similar logic to getUsers but returning all rows
        const { search = '', departmentId = '', no_department = '' } = filters;
        const whereClauses = [];
        const params = [];
        let idx = 1;
        if (search) {
            const cleaned = String(search).trim();
            const isPhrase = /\s|\d/.test(cleaned);
            if (isPhrase) {
                whereClauses.push(`(
                    unaccent(lower(u.full_name)) = unaccent(lower($${idx})) OR
                    unaccent(lower(u.username)) = unaccent(lower($${idx})) OR
                    unaccent(lower(u.email)) = unaccent(lower($${idx}))
                )`);
                params.push(cleaned);
                idx++;
            } else {
                whereClauses.push(`(
                    unaccent(lower(u.full_name)) LIKE unaccent(lower($${idx})) OR
                    unaccent(lower(u.username)) LIKE unaccent(lower($${idx})) OR
                    unaccent(lower(u.email)) LIKE unaccent(lower($${idx}))
                )`);
                params.push(`%${cleaned}%`);
                idx++;
            }
        }
        const noDeptTruth = (no_department === true || no_department === '1' || no_department === 'true');
        if (noDeptTruth) {
            whereClauses.push(`u.department_id IS NULL`);
        } else if (departmentId) {
            whereClauses.push(`u.department_id = $${idx}`);
            params.push(parseInt(departmentId, 10));
            idx++;
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const dataQuery = `
            SELECT u.id, u.username, u.full_name, u.email, u.phone_number, u.birth_date, u.is_active,
                   d.name as department_name, r.role_name,
                   (SELECT COUNT(*)::int FROM tasks t WHERE t.assignee_id = u.id) as task_count
            FROM users u
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN roles r ON u.role_id = r.id
            ${whereSql}
            ORDER BY u.full_name
        `;

        const { rows } = await pool.query(dataQuery, params);

        // log action
        try { await pool.query('INSERT INTO user_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, format]); } catch(e) {}

        const { fileDate, sheetDate } = formatTimestamp(new Date());
        const filenameBase = `xanuicam_users_${fileDate}`;

        if (format === 'csv') {
            // build CSV
            const headers = ['ID','Username','Full Name','Email','Phone','Birth Date','Active','Department','Role','Task Count'];
            const lines = [headers.join(',')];
            for (const r of rows) {
                const vals = [r.id, r.username, r.full_name, r.email, r.phone_number, r.birth_date ? r.birth_date.toISOString().split('T')[0] : '', r.is_active ? '1' : '0', (r.department_name||''), (r.role_name||''), r.task_count || 0];
                lines.push(vals.map(v => String(v).replace(/"/g,'""')).map(v => `"${v}"`).join(','));
            }
            const csv = lines.join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            return res.send(csv);
        }

        if (format === 'pdf') {
            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            doc.pipe(res);
            doc.fontSize(16).text('Danh sách người dùng', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10);
            rows.forEach((r, i) => {
                doc.text(`${i+1}. ${r.full_name} (@${r.username}) - ${r.email} - ${r.department_name || 'Chưa có'} - ${r.is_active ? 'Hoạt động' : 'Đã khóa'}`);
            });
            doc.end();
            return;
        }

        // default xlsx
        const Excel = require('exceljs');
        const workbook = new Excel.Workbook();
        const sheetName = `xanuicam_users_${sheetDate}`;
        const ws = workbook.addWorksheet(sheetName);
        ws.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Username', key: 'username', width: 20 },
            { header: 'Full Name', key: 'full_name', width: 30 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Phone', key: 'phone_number', width: 15 },
            { header: 'Birth Date', key: 'birth_date', width: 12 },
            { header: 'Active', key: 'is_active', width: 10 },
            { header: 'Department', key: 'department_name', width: 25 },
            { header: 'Role', key: 'role_name', width: 20 },
            { header: 'Task Count', key: 'task_count', width: 12 }
        ];
        rows.forEach(r => {
            ws.addRow({ id: r.id, username: r.username, full_name: r.full_name, email: r.email, phone_number: r.phone_number, birth_date: r.birth_date ? r.birth_date.toISOString().split('T')[0] : '', is_active: r.is_active ? 'Yes' : 'No', department_name: r.department_name || '', role_name: r.role_name || '', task_count: r.task_count || 0 });
        });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
        try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
        await workbook.xlsx.write(res);
        res.end();
        return;
    } catch (error) {
        console.error('exportUsers error', error);
        return res.status(500).json({ message: 'Lỗi khi xuất báo cáo' });
    }
};

// Return daily export quota usage for the authenticated user
// Optional query param: ?module=tasks|users|audit  (default: tasks)
exports.exportQuota = async (req, res) => {
    const actor = req.user || {};
    const actorId = actor.id;
    if (!actorId) return res.status(401).json({ message: 'Unauthorized' });
    const module = (req.query && req.query.module) ? String(req.query.module) : 'tasks';
    try {
        // If user has MFA enabled, report unlimited (no daily limit)
        try {
            const r = await pool.query('SELECT mfa_enabled FROM users WHERE id = $1', [actorId]);
            if (r.rows.length && r.rows[0].mfa_enabled) {
                if (module === 'tasks') return res.json({ module: 'tasks', allowed: true, usedToday: 0, limit: null, remaining: null, last_export_at: null, mfaEnabled: true });
                return res.json({ module: 'users', usedToday: 0, limit: null, remaining: null, last_export_at: null, mfaEnabled: true });
            }
        } catch (e) {
            console.warn('exportQuota: could not determine MFA status', e && e.message ? e.message : e);
        }
        // ensure the export action tables exist
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS user_export_actions (id SERIAL PRIMARY KEY, actor_id INTEGER NOT NULL, format TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        } catch (e) {}
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS tasks_export_actions (id SERIAL PRIMARY KEY, actor_id INTEGER NOT NULL, format TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        } catch (e) {}

        if (module === 'tasks') {
            // tasks export limit: 1 per day
            const todayCountRes = await pool.query("SELECT COUNT(*) FROM tasks_export_actions WHERE actor_id = $1 AND created_at >= date_trunc('day', now())", [actorId]);
            const usedToday = parseInt(todayCountRes.rows[0].count || '0', 10);
            const allowed = usedToday < 1;
            // fetch last export timestamp
            const lastRes = await pool.query("SELECT created_at FROM tasks_export_actions WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 1", [actorId]);
            const last = lastRes.rows[0] ? lastRes.rows[0].created_at : null;
            return res.json({ module: 'tasks', allowed, usedToday, limit: 1, remaining: Math.max(0, 1 - usedToday), last_export_at: last });
        }

        // fallback: return generic user export usage
        const todayCountRes = await pool.query("SELECT COUNT(*) FROM user_export_actions WHERE actor_id = $1 AND created_at >= date_trunc('day', now())", [actorId]);
        const usedToday = parseInt(todayCountRes.rows[0].count || '0', 10);
        const limit = 5;
        const lastRes = await pool.query("SELECT created_at FROM user_export_actions WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 1", [actorId]);
        const last = lastRes.rows[0] ? lastRes.rows[0].created_at : null;
        return res.json({ module: 'users', usedToday, limit, remaining: Math.max(0, limit - usedToday), last_export_at: last });
    } catch (error) {
        console.error('exportQuota error', error);
        return res.status(500).json({ message: 'Lỗi khi lấy thông tin giới hạn xuất báo cáo' });
    }
};

// Permanently remove an archived user by deleted_users.id
exports.permanentlyDeleteUser = async (req, res) => {
    const { id } = req.params; // id in deleted_users table
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    // Require actor to have MFA enabled and provide valid TOTP to perform permanent delete
    try {
        const r = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [actorId]);
        if (r.rows.length === 0) return res.status(404).json({ message: 'Actor not found' });
        if (!r.rows[0].mfa_enabled) return res.status(403).json({ message: 'Chỉ người dùng đã bật MFA mới có quyền xóa vĩnh viễn tài khoản.' });
        const token = req.body && req.body.mfaToken ? String(req.body.mfaToken) : null;
        if (!token) return res.status(400).json({ message: 'Thiếu mã xác thực MFA.' });
        try {
            const secret = r.rows[0].mfa_secret_encrypted ? decrypt(r.rows[0].mfa_secret_encrypted) : null;
            const ok = secret ? speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 }) : false;
            if (!ok) return res.status(401).json({ message: 'Mã MFA không hợp lệ.' });
        } catch (e) {
            console.error('permanentlyDeleteUser: MFA verify error', e);
            return res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
        }
    } catch (e) {
        console.error('permanentlyDeleteUser: error checking actor MFA', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }

    try {
        await client.query('BEGIN');
        const sel = await client.query('SELECT * FROM deleted_users WHERE id = $1', [id]);
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Bản ghi đã lưu trữ không tồn tại.' });
        }
        const archived = sel.rows[0];

        // Remove avatar file if present
        try {
            if (archived.avatar) {
                deleteFile(archived.avatar);
            }
        } catch (e) {
            console.warn('permanentlyDeleteUser: could not delete avatar file', e);
        }

        await client.query('DELETE FROM deleted_users WHERE id = $1', [id]);

        await logActivity(client, {
            userId: actorId,
            module: 'Tài khoản',
            action: 'Xóa vĩnh viễn',
            details: `${actorName} đã xóa vĩnh viễn tài khoản lưu trữ (orig_user_id=${archived.orig_user_id}, username=${archived.username}).`
        });

        await client.query('COMMIT');
        res.json({ message: 'Đã xóa vĩnh viễn tài khoản.' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to permanently delete archived user:', e && (e.stack || e));
        res.status(500).json({ message: 'Lỗi khi xóa vĩnh viễn người dùng.' });
    } finally {
        client.release();
    }
};