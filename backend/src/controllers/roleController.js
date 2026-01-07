// ubndxanuicam/backend/src/controllers/roleController.js
// VERSION 2.0 - INTEGRATED AUDIT LOGGER

const pool = require('../db');
const logActivity = require('../utils/auditLogger');

// Lấy danh sách tất cả các vai trò
exports.getRoles = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM roles ORDER BY level, id');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

// Lấy danh sách tất cả các quyền hạn
exports.getAllPermissions = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM permissions ORDER BY id');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

// Lấy thông tin chi tiết một vai trò
exports.getRoleById = async (req, res) => {
    const { id } = req.params;
    try {
        const roleQuery = 'SELECT * FROM roles WHERE id = $1';
        const permissionsQuery = 'SELECT permission_id FROM role_permissions WHERE role_id = $1';

        const roleRes = await pool.query(roleQuery, [id]);
        if (roleRes.rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy vai trò.' });
        }

        const permissionsRes = await pool.query(permissionsQuery, [id]);
        const assignedPermissions = permissionsRes.rows.map(p => p.permission_id);

        const role = roleRes.rows[0];
        role.permissions = assignedPermissions;

        res.json(role);
    } catch (error) {
        res.status(500).json({ message: "Lỗi máy chủ" });
    }
};

// Tạo vai trò mới
exports.createRole = async (req, res) => {
    const { role_name, description, color, level, permissions } = req.body;
    const actorId = req.user && req.user.id;
    const actorDisplayName = (req.user && (req.user.fullName || req.user.username || req.user.name)) ? (req.user.fullName || req.user.username || req.user.name) : 'Hệ thống';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Check total roles (active + deleted) limit
        const cnt = await client.query('SELECT (SELECT COUNT(*) FROM roles)::int + (SELECT COUNT(*) FROM deleted_roles)::int AS total');
        if (parseInt(cnt.rows[0].total, 10) >= 100) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Không thể tạo vai trò mới: giới hạn tổng số vai trò (100) đã đạt.' });
        }

        const createRoleQuery = 'INSERT INTO roles (role_name, description, color, level) VALUES ($1, $2, $3, $4) RETURNING id';
        const roleRes = await client.query(createRoleQuery, [role_name, description, color, level]);
        const newRoleId = roleRes.rows[0].id;

        if (permissions && permissions.length > 0) {
            const insertPermissionsQuery = 'INSERT INTO role_permissions (role_id, permission_id) VALUES ' +
                permissions.map((_, i) => `($1, $${i + 2})`).join(', ');
            
            await client.query(insertPermissionsQuery, [newRoleId, ...permissions]);
        }

        await logActivity(client, {
            userId: actorId,
            username: req.user && req.user.username,
            module: 'Phân quyền',
            action: 'Tạo mới vai trò',
            details: `${actorDisplayName} đã tạo vai trò mới: "${role_name}".`
        });

        await client.query('COMMIT');
        res.status(201).json({ id: newRoleId, role_name });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Tên vai trò này đã tồn tại.' });
        }
        res.status(500).json({ message: 'Lỗi máy chủ khi tạo vai trò.' });
    } finally {
        client.release();
    }
};

// Cập nhật vai trò
exports.updateRole = async (req, res) => {
    const { id } = req.params;
    const { role_name, description, color, level, permissions } = req.body;
    const actorId = req.user && req.user.id;
    const actorDisplayName = (req.user && (req.user.fullName || req.user.username || req.user.name)) ? (req.user.fullName || req.user.username || req.user.name) : 'Hệ thống';
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const oldRes = await client.query('SELECT role_name, description FROM roles WHERE id = $1', [id]);
        const oldRoleName = oldRes.rows[0]?.role_name;

        const updateRoleQuery = 'UPDATE roles SET role_name = $1, description = $2, color = $3, level = $4, updated_at = NOW() WHERE id = $5';
        await client.query(updateRoleQuery, [role_name, description, color, level, id]);

        const deleteOldPermissionsQuery = 'DELETE FROM role_permissions WHERE role_id = $1';
        await client.query(deleteOldPermissionsQuery, [id]);

        if (permissions && permissions.length > 0) {
            const insertPermissionsQuery = 'INSERT INTO role_permissions (role_id, permission_id) VALUES ' +
                permissions.map((_, i) => `($1, $${i + 2})`).join(', ');
            await client.query(insertPermissionsQuery, [id, ...permissions]);
        }

        try {
            // Build structured change payload
            const changes = {};
            if (String(oldRoleName) !== String(role_name)) changes.role_name = { old: oldRoleName || null, new: role_name || null };
            if (permissions && Array.isArray(permissions)) changes.permissions = { old: 'updated', new: permissions };
            const detailStr = changes.role_name ? `${actorDisplayName} đã cập nhật vai trò "${oldRoleName || ''}" thành "${role_name}".` : `${actorDisplayName} đã cập nhật vai trò "${role_name}."`;
            await logActivity(client, {
                userId: actorId,
                username: req.user && req.user.username,
                module: 'Phân quyền',
                action: 'Cập nhật vai trò',
                details: detailStr,
                url: `/roles/${id}`,
                method: 'PUT',
                change: changes
            });
        } catch (e) {
            console.error('Error writing audit log for role update:', e);
        }

        await client.query('COMMIT');
        res.json({ message: 'Cập nhật vai trò thành công.' });
    } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') {
            return res.status(400).json({ message: 'Tên vai trò này đã tồn tại.' });
        }
        res.status(500).json({ message: 'Lỗi máy chủ khi cập nhật vai trò.' });
    } finally {
        client.release();
    }
};

// Xóa vai trò
exports.deleteRole = async (req, res) => {
    const { id } = req.params;
    const actorId = req.user && req.user.id;
    const actorDisplayName = (req.user && (req.user.fullName || req.user.username || req.user.name)) ? (req.user.fullName || req.user.username || req.user.name) : 'Hệ thống';
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const userCheck = await client.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
        if (parseInt(userCheck.rows[0].count, 10) > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Không thể xóa vì vẫn còn người dùng thuộc vai trò này.' });
        }
        // Soft-delete: move role into deleted_roles table for 7-day retention
        const roleRes = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
        const role = roleRes.rows[0];
        if (!role) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy vai trò.' });
        }

        // insert into deleted_roles archive table
        const insertDeleted = `INSERT INTO deleted_roles (original_id, role_name, description, color, level, permissions_snapshot, deleted_by, deleted_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`;
        // fetch permissions
        const permsRes = await client.query('SELECT permission_id FROM role_permissions WHERE role_id = $1', [id]);
        const permIds = permsRes.rows.map(r => r.permission_id);

        await client.query(insertDeleted, [id, role.role_name, role.description, role.color, role.level, JSON.stringify(permIds), actorDisplayName]);

        // remove mappings and role row
        await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
        await client.query('DELETE FROM roles WHERE id = $1', [id]);

        try {
            await logActivity(client, {
                userId: actorId,
                username: req.user && req.user.username,
                module: 'Phân quyền',
                action: 'Xóa vai trò (tạm lưu)',
                details: `${actorDisplayName} đã xóa vai trò "${role.role_name}" (đưa vào vùng đã xóa).`
            });
        } catch (e) {
            console.error('Error writing audit log for role soft-delete:', e);
        }

        await client.query('COMMIT');
        res.json({ message: 'Vai trò đã được gỡ bỏ và chuyển vào mục đã xóa.' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Lỗi máy chủ khi xóa vai trò.' });
    } finally {
        client.release();
    }
};

// List deleted roles (archive)
exports.getDeletedRoles = async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 1000;
    try {
        const { rows } = await pool.query('SELECT * FROM deleted_roles ORDER BY deleted_at DESC LIMIT $1', [limit]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách vai trò đã xóa.' });
    }
};

// Restore deleted role by moving back from deleted_roles to roles
exports.restoreDeletedRole = async (req, res) => {
    const { id } = req.params; // id in deleted_roles
    const actorId = req.user && req.user.id;
    const actorDisplayName = (req.user && (req.user.fullName || req.user.username || req.user.name)) ? (req.user.fullName || req.user.username || req.user.name) : 'Hệ thống';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const dRes = await client.query('SELECT * FROM deleted_roles WHERE id = $1', [id]);
        if (dRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy vai trò đã xóa.' });
        }
        const d = dRes.rows[0];

        // ensure not exceeding 100 roles (including deleted)
        const countRes = await client.query('SELECT (SELECT COUNT(*) FROM roles)::int + (SELECT COUNT(*) FROM deleted_roles)::int AS total');
        if (parseInt(countRes.rows[0].total,10) >= 100) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Không thể khôi phục: giới hạn tổng số vai trò (100) đã đạt.' });
        }

        // Insert new role. Handle errors like duplicate role_name gracefully.
        let ins;
        try {
            ins = await client.query('INSERT INTO roles (role_name, description, color, level, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING id', [d.role_name, d.description, d.color, d.level]);
        } catch (e) {
            await client.query('ROLLBACK');
            // Unique violation or other DB errors
            if (e && e.code === '23505') {
                return res.status(400).json({ message: 'Không thể khôi phục: tên vai trò đã tồn tại. Vui lòng đổi tên vai trò trước khi khôi phục.' });
            }
            throw e;
        }
        const newId = ins.rows[0].id;
        // restore permissions snapshot
        let permIds = [];
        try {
            if (d.permissions_snapshot) {
                if (typeof d.permissions_snapshot === 'string') {
                    permIds = JSON.parse(d.permissions_snapshot);
                } else {
                    // already parsed by pg as array/object
                    permIds = d.permissions_snapshot;
                }
            }
        } catch (e) {
            // if parsing fails, fallback to empty permissions
            permIds = [];
        }
        if (permIds && permIds.length > 0) {
            const insertPermissionsQuery = 'INSERT INTO role_permissions (role_id, permission_id) VALUES ' + permIds.map((_,i)=>`($1,$${i+2})`).join(', ');
            await client.query(insertPermissionsQuery, [newId, ...permIds]);
        }

        await client.query('DELETE FROM deleted_roles WHERE id = $1', [id]);
        await logActivity(client, { userId: actorId, username: req.user && req.user.username, module: 'Phân quyền', action: 'Khôi phục vai trò', details: `${actorDisplayName} đã khôi phục vai trò "${d.role_name}".` });
        await client.query('COMMIT');
        res.json({ message: 'Vai trò đã được khôi phục.', id: newId });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Lỗi khi khôi phục vai trò.' });
    } finally {
        client.release();
    }
};

// Permanently delete archived role
exports.permanentlyDeleteRole = async (req, res) => {
    const { id } = req.params; // id in deleted_roles
    const actorId = req.user && req.user.id;
    const actorDisplayName = (req.user && (req.user.fullName || req.user.username || req.user.name)) ? (req.user.fullName || req.user.username || req.user.name) : 'Hệ thống';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const dRes = await client.query('SELECT role_name FROM deleted_roles WHERE id = $1', [id]);
        if (dRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy vai trò đã xóa.' });
        }
        const roleName = dRes.rows[0].role_name;
        await client.query('DELETE FROM deleted_roles WHERE id = $1', [id]);
        await logActivity(client, { userId: actorId, username: req.user && req.user.username, module: 'Phân quyền', action: 'Xóa vĩnh viễn vai trò', details: `${actorDisplayName} đã xóa vĩnh viễn vai trò "${roleName}".` });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa vai trò vĩnh viễn.' });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(500).json({ message: 'Lỗi khi xóa vĩnh viễn vai trò.' });
    } finally {
        client.release();
    }
};