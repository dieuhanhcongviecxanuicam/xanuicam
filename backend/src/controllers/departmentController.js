const pool = require('../db');
const fs = require('fs');
const logActivity = require('../utils/auditLogger');
const speakeasy = require('speakeasy');
const { decrypt } = require('../utils/encryption');

const deleteFile = (filePath) => {
    if (filePath) {
        fs.unlink(filePath, (err) => {
            if (err) console.error(`Lỗi khi xóa tệp ${filePath}:`, err);
        });
    }
};

exports.getDepartments = async (req, res) => {
    const { page = 1, limit = 15 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    try {
        const totalQuery = `SELECT COUNT(*) FROM departments`;
        const totalResult = await pool.query(totalQuery);
        const totalItems = parseInt(totalResult.rows[0].count, 10);

        const dataQuery = `
            SELECT 
                d.id, d.name, d.description, d.avatar, d.address, d.phone_number, d.manager_id,
                u.full_name as manager_name,
                u.username as manager_username,
                u.avatar as manager_avatar
            FROM departments d
            LEFT JOIN users u ON d.manager_id = u.id
            ORDER BY d.name
            LIMIT $1 OFFSET $2
        `;
        const { rows } = await pool.query(dataQuery, [parseInt(limit, 10), offset]);
        
        res.json({
            data: rows,
            pagination: {
                currentPage: parseInt(page, 10),
                totalPages: Math.ceil(totalItems / limit),
                totalItems,
            }
        });
    } catch (error) {
        console.error("Lỗi khi tải phòng ban:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.getDeletedDepartments = async (req, res) => {
    try {
        // return archived/deleted departments for UI
        const q = `SELECT id, name, description, avatar, deleted_by, deleted_at, address, phone_number, manager_id FROM deleted_departments ORDER BY deleted_at DESC`;
        const { rows } = await pool.query(q);
        res.json(rows);
    } catch (e) {
        console.error('Lỗi khi lấy phòng ban đã xóa:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

exports.restoreDeletedDepartment = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query('SELECT * FROM deleted_departments WHERE id = $1', [id]);
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy phòng ban đã xóa.' });
        }
        const row = sel.rows[0];
        // Ensure cap not exceeded
        const capRes = await client.query('SELECT (SELECT COUNT(*) FROM departments) as active_count, (SELECT COUNT(*) FROM deleted_departments) as archived_count');
        const active = parseInt(capRes.rows[0].active_count || '0', 10) || 0;
        const archived = parseInt(capRes.rows[0].archived_count || '0', 10) || 0;
        const total = active + archived;
        const CAP = Number(process.env.DEPARTMENT_CAP || 100);
        if (total >= CAP) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Không thể khôi phục: đã đạt giới hạn ${CAP} phòng ban (bao gồm phòng ban đã xóa).` });
        }

        const insertQ = `INSERT INTO departments (id, name, description, avatar, address, phone_number, manager_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
        await client.query(insertQ, [row.id, row.name, row.description, row.avatar, row.address, row.phone_number, row.manager_id]);
        await client.query('DELETE FROM deleted_departments WHERE id = $1', [id]);
        await logActivity(client, { userId: req.user.id, module: 'Phòng ban', action: 'Khôi phục', details: `${req.user.fullName} đã khôi phục phòng ban ${row.name}` });
        await client.query('COMMIT');
        res.json({ message: 'Khôi phục thành công.' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi khôi phục phòng ban:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

exports.permanentlyDeleteDepartment = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const sel = await client.query('SELECT avatar FROM deleted_departments WHERE id = $1', [id]);
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy mục đã xóa.' });
        }
        const avatar = sel.rows[0].avatar;
        if (avatar) deleteFile(avatar);
        await client.query('DELETE FROM deleted_departments WHERE id = $1', [id]);
        await logActivity(client, { userId: req.user.id, module: 'Phòng ban', action: 'Xóa vĩnh viễn', details: `${req.user.fullName} đã xóa vĩnh viễn phòng ban id=${id}` });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa vĩnh viễn.' });
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi xóa vĩnh viễn phòng ban:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

exports.exportDepartments = async (req, res) => {
    // format: csv|xlsx|pdf
    const { format = 'csv', totp = null } = req.body || {};
    try {
        // If user's account has MFA enabled, require a valid TOTP code for export
        try {
            const userId = req.user && req.user.id;
            if (userId) {
                const r = await pool.query('SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1', [userId]);
                if (r.rows.length > 0 && r.rows[0].mfa_enabled) {
                    const secretEnc = r.rows[0].mfa_secret_encrypted;
                    const secret = secretEnc ? decrypt(secretEnc) : null;
                    if (!totp || !secret || !speakeasy.totp.verify({ secret, encoding: 'base32', token: String(totp), window: 1 })) {
                        return res.status(401).json({ message: 'Yêu cầu xác thực MFA (TOTP) để xuất dữ liệu.' });
                    }
                }
            }
        } catch (authErr) {
            console.error('Error verifying TOTP for export:', authErr);
            return res.status(500).json({ message: 'Lỗi khi xác thực MFA.' });
        }

        const q = `SELECT id, name, description, address, phone_number FROM departments ORDER BY name`;
        const { rows } = await pool.query(q);
        // simple CSV export
        if (format === 'csv') {
            const lines = [];
            lines.push('id,name,description,address,phone_number');
            for (const r of rows) {
                const safe = (v) => String(v || '').replace(/"/g, '""');
                const fields = [r.id, `"${safe(r.name)}"`, `"${safe(r.description)}"`, `"${safe(r.address)}"`, `"${safe(r.phone_number)}"`];
                lines.push(fields.join(','));
            }
            const now = new Date();
            const pad = (n) => String(n).padStart(2,'0');
            const fname = `xanuicam_departments_${pad(now.getDate())}${pad(now.getMonth()+1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.csv`;
            res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            return res.send(lines.join('\n'));
        }
        // fallback: return JSON
        res.json({ data: rows });
    } catch (e) {
        console.error('Lỗi khi xuất phòng ban:', e);
        res.status(500).json({ message: 'Lỗi khi xuất dữ liệu' });
    }
};

exports.createDepartment = async (req, res) => {
    const { name, description, address, phone_number, manager_id } = req.body;
    const avatarPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const query = 'INSERT INTO departments (name, description, avatar, address, phone_number, manager_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
        const params = [name, description, avatarPath, address, phone_number, manager_id || null];
        const { rows } = await client.query(query, params);
        const newDept = rows[0];

        // Nếu gán người phụ trách, cập nhật trường department_id cho user đó
        if (manager_id) {
            await client.query('UPDATE users SET department_id = $1 WHERE id = $2', [newDept.id, manager_id]);
        }
        
        await logActivity(client, {
            userId: actorId,
            module: 'Phòng ban',
            action: 'Tạo mới',
            details: `${actorName} đã tạo phòng ban mới: "${name}".`
        });
        
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (avatarPath) deleteFile(avatarPath);
        if (error.code === '23505') {
            return res.status(400).json({ message: "Tên phòng ban này đã tồn tại." });
        }
        console.error("Lỗi khi tạo phòng ban:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    } finally {
        client.release();
    }
};

exports.updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { name, description, address, phone_number, manager_id } = req.body;
    const avatarPath = req.file ? req.file.path.replace(/\\/g, '/') : null;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const oldDeptRes = await client.query('SELECT name, avatar, manager_id FROM departments WHERE id = $1', [id]);
        const oldName = oldDeptRes.rows[0]?.name;
        const oldAvatar = oldDeptRes.rows[0]?.avatar;
        const oldManagerId = oldDeptRes.rows[0]?.manager_id;

        let query;
        let params;
        
        if (avatarPath) {
            query = 'UPDATE departments SET name = $1, description = $2, avatar = $3, address = $4, phone_number = $5, manager_id = $6 WHERE id = $7 RETURNING *';
            params = [name, description, avatarPath, address, phone_number, manager_id || null, id];
        } else {
            query = 'UPDATE departments SET name = $1, description = $2, address = $3, phone_number = $4, manager_id = $5 WHERE id = $6 RETURNING *';
            params = [name, description, address, phone_number, manager_id || null, id];
        }
        
        const { rows } = await client.query(query, params);
        if (rows.length === 0) {
            if (avatarPath) deleteFile(avatarPath);
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Không tìm thấy phòng ban." });
        }
        
        if (avatarPath && oldAvatar) {
            deleteFile(oldAvatar);
        }

        // Nếu manager thay đổi, cập nhật department_id của người được gán mới và xóa department_id của người phụ trách cũ nếu khác
        if (manager_id && manager_id !== oldManagerId) {
            await client.query('UPDATE users SET department_id = $1 WHERE id = $2', [id, manager_id]);
        }
        if (oldManagerId && oldManagerId !== manager_id) {
            // Không ép xóa nếu người cũ vẫn thuộc phòng khác; chỉ clear nếu họ đang trỏ tới chính phòng này
            await client.query('UPDATE users SET department_id = NULL WHERE id = $1 AND department_id = $2', [oldManagerId, id]);
        }

        // Persist richer details including old->new values and a direct URL to the resource
        await logActivity(client, {
            userId: actorId,
            module: 'Phòng ban',
            action: 'Cập nhật',
            details: `${actorName} đã cập nhật thông tin phòng ban "${oldName || name}" thành thông tin phòng ban "${name}".`,
            url: `/departments/${id}`,
            method: 'PUT'
        });
        
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        if (avatarPath) deleteFile(avatarPath);
         if (error.code === '23505') {
            return res.status(400).json({ message: "Tên phòng ban này đã tồn tại." });
        }
        console.error("Lỗi khi cập nhật phòng ban:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    } finally {
        client.release();
    }
};

exports.deleteDepartment = async (req, res) => {
    const { id } = req.params;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const userCheckQuery = 'SELECT COUNT(*) FROM users WHERE department_id = $1';
        const userCheckResult = await client.query(userCheckQuery, [id]);
        if (parseInt(userCheckResult.rows[0].count, 10) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "Không thể xóa vì vẫn còn người dùng trong phòng ban." });
        }

        // Fetch existing department
        const sel = await client.query('SELECT id, name, description, avatar, address, phone_number, manager_id FROM departments WHERE id = $1', [id]);
        if (sel.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Không tìm thấy phòng ban." });
        }
        const dept = sel.rows[0];

        // Move to deleted_departments (keep avatar file until permanent delete)
        const insertQ = `INSERT INTO deleted_departments (id, name, description, avatar, address, phone_number, manager_id, deleted_by, deleted_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, avatar = EXCLUDED.avatar, address = EXCLUDED.address, phone_number = EXCLUDED.phone_number, manager_id = EXCLUDED.manager_id, deleted_by = EXCLUDED.deleted_by, deleted_at = EXCLUDED.deleted_at`;
        await client.query(insertQ, [dept.id, dept.name, dept.description, dept.avatar, dept.address, dept.phone_number, dept.manager_id, actorId]);

        await client.query('DELETE FROM departments WHERE id = $1', [id]);

        await logActivity(client, {
            userId: actorId,
            module: 'Phòng ban',
            action: 'Xóa (lưu trữ)',
            details: `${actorName} đã xóa (lưu trữ) phòng ban "${dept.name}".`
        });

        await client.query('COMMIT');
        res.json({ message: "Phòng ban đã được xóa (lưu trữ) thành công." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi xóa phòng ban:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    } finally {
        client.release();
    }
};