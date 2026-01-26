// ubndxanuicam/backend/src/controllers/systemSettingsController.js
// VERSION 2.0 - VERIFIED, NO FURTHER CHANGES NEEDED

const pool = require('../db');
const logActivity = require('../utils/auditLogger'); 

// Lấy tất cả cài đặt hệ thống
exports.getSystemSettings = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT key, value, description FROM system_settings');
        // Chuyển đổi mảng thành một đối tượng key-value để dễ sử dụng ở frontend
        const settings = rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
        res.json(settings);
    } catch (error) {
        console.error("Lỗi khi lấy cài đặt hệ thống:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Cập nhật chế độ bảo trì
exports.updateMaintenanceMode = async (req, res) => {
    const { enabled, title, message, start_time, end_time, whitelist = [], main_title, sub_title, detailed_message } = req.body;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    }

    try {
        await client.query('BEGIN');
        const value = { enabled, title, message, start_time: start_time || null, end_time: end_time || null, whitelist: Array.isArray(whitelist)? whitelist.slice(0,3): [], main_title: main_title || null, sub_title: sub_title || null, detailed_message: detailed_message || null };
        const query = `
            UPDATE system_settings 
            SET value = $1, updated_at = NOW() 
            WHERE key = 'maintenance_mode'
            RETURNING value;
        `;
        const { rows } = await client.query(query, [JSON.stringify(value)]);
        
        const actionText = enabled ? 'BẬT' : 'TẮT';
        await logActivity(client, {
            userId: actorId,
            module: 'Hệ thống',
            action: 'Cài đặt bảo trì',
            details: `${actorName} đã ${actionText} chế độ bảo trì.`
        });
        
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi cập nhật chế độ bảo trì:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Cập nhật / gửi thông báo broadcast
exports.updateBroadcastNotification = async (req, res) => {
    const { enabled, title, message, start_time, end_time } = req.body;
    const { id: actorId, fullName: actorName } = req.user;
    const client = await pool.connect();

    if (typeof enabled !== 'boolean') return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });

    try {
        await client.query('BEGIN');
        const value = { enabled, title: title || null, message: message || null, start_time: start_time || null, end_time: end_time || null };
        const query = `
            UPDATE system_settings
            SET value = $1, updated_at = NOW()
            WHERE key = 'broadcast_notification'
            RETURNING id, value, updated_at;
        `;
        const { rows } = await client.query(query, [JSON.stringify(value)]);

        await logActivity(client, {
            userId: actorId,
            module: 'Hệ thống',
            action: 'Gửi thông báo',
            details: `${actorName} đã ${enabled? 'bật/đặt' : 'tắt'} thông báo hệ thống.`
        });

        await client.query('COMMIT');
        // Return structured object including id and updated_at for clients
        const out = rows[0] || {};
        const parsed = out.value || { enabled: false };
        res.json(Object.assign({}, parsed, { id: out.id, updated_at: out.updated_at }));
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi cập nhật broadcast notification:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Admin: list recent user update actions (for QA/debug)
exports.getUserUpdateActions = async (req, res) => {
    try {
        const { actorId, targetId, limit = 100 } = req.query;
        const where = [];
        const params = [];
        let idx = 1;
        if (actorId) { where.push(`ua.actor_id = $${idx++}`); params.push(parseInt(actorId, 10)); }
        if (targetId) { where.push(`ua.target_user_id = $${idx++}`); params.push(parseInt(targetId, 10)); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const q = `
            SELECT ua.id, ua.actor_id, a.username as actor_username, ua.target_user_id, t.username as target_username, ua.created_at
            FROM user_update_actions ua
            LEFT JOIN users a ON a.id = ua.actor_id
            LEFT JOIN users t ON t.id = ua.target_user_id
            ${whereSql}
            ORDER BY ua.created_at DESC
            LIMIT $${idx}
        `;
        params.push(parseInt(limit, 10));
        const r = await pool.query(q, params);
        res.json({ data: r.rows });
    } catch (error) {
        console.error('Error getUserUpdateActions:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Admin: delete user_update_actions entries (by actor, target, or both)
exports.deleteUserUpdateActions = async (req, res) => {
    try {
        const { actorId, targetId } = req.query;
        if (!actorId && !targetId) return res.status(400).json({ message: 'actorId hoặc targetId là bắt buộc.' });
        const clauses = [];
        const params = [];
        let idx = 1;
        if (actorId) { clauses.push(`actor_id = $${idx++}`); params.push(parseInt(actorId, 10)); }
        if (targetId) { clauses.push(`target_user_id = $${idx++}`); params.push(parseInt(targetId, 10)); }
        const q = `DELETE FROM user_update_actions WHERE ${clauses.join(' AND ')}`;
        const r = await pool.query(q, params);
        res.json({ message: 'Đã xóa bản ghi user_update_actions theo điều kiện.', rowCount: r.rowCount });
    } catch (error) {
        console.error('Error deleteUserUpdateActions:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Public: return broadcast notification (no auth) so public-facing pages can show notification modal
exports.getPublicBroadcastNotification = async (req, res) => {
    try {
        const { rows } = await pool.query("SELECT id, value, updated_at FROM system_settings WHERE key = 'broadcast_notification'");
        if (!rows[0]) return res.json({ enabled: false });
        const row = rows[0];
        const val = row.value || { enabled: false };
        // include id and updated_at so frontend can track dismissals per version
        res.json(Object.assign({}, val, { id: row.id, updated_at: row.updated_at }));
    } catch (error) {
        console.error('Error getPublicBroadcastNotification:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};