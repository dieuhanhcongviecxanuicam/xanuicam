// ubndxanuicam/backend/src/controllers/notificationController.js
const pool = require('../db');

/**
 * @description Đánh dấu một thông báo cụ thể là đã đọc.
 * @route POST /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = async (req, res) => {
    const { id: notificationId } = req.params;
    const { id: userId } = req.user;
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
            [notificationId, userId]
        );
        res.status(200).json({ message: 'Đã đánh dấu là đã đọc.' });
    } catch (error) {
        console.error("Lỗi khi đánh dấu đã đọc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

exports.getNotifications = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const query = `
            SELECT id, message, link, is_read, created_at
            FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 20; -- Giới hạn 20 thông báo gần nhất để tối ưu
        `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải thông báo:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

/**
 * @description Đánh dấu tất cả thông báo là đã đọc.
 * @route POST /api/notifications/mark-all-as-read
 * @access Private
 */
exports.markAllAsRead = async (req, res) => {
    const { id: userId } = req.user;
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = $1', [userId]);
        res.json({ message: 'Tất cả thông báo đã được đánh dấu là đã đọc.' });
    } catch (error) {
        console.error("Lỗi khi đánh dấu đã đọc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

/**
 * Get current user's notification preferences
 * GET /api/notifications/prefs
 */
exports.getPrefs = async (req, res) => {
    const userId = req.user.id;
    try {
        const { rows } = await pool.query('SELECT email, in_app, push, updated_at FROM user_notification_prefs WHERE user_id = $1', [userId]);
        if (rows.length === 0) return res.json(null);
        return res.json(rows[0]);
    } catch (e) {
        console.error('Failed to get notification prefs:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

/**
 * Update current user's notification preferences
 * PUT /api/notifications/prefs
 */
exports.updatePrefs = async (req, res) => {
    const userId = req.user.id;
    const { email = false, inApp = false, push = false } = req.body || {};
    try {
        const upsert = `INSERT INTO user_notification_prefs (user_id, email, in_app, push, updated_at)
            VALUES ($1,$2,$3,$4,NOW())
            ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, in_app = EXCLUDED.in_app, push = EXCLUDED.push, updated_at = NOW()
            RETURNING *`;
        const { rows } = await pool.query(upsert, [userId, !!email, !!inApp, !!push]);
        // lightweight audit log: include username to satisfy NOT NULL constraints
        try {
            const username = req.user && req.user.username ? req.user.username : '__unknown__';
            await pool.query('INSERT INTO audit_logs (user_id, username, module, action, details) VALUES ($1,$2,$3,$4,$5)', [userId, username, 'Notifications', 'Update Prefs', JSON.stringify(rows[0])]);
        } catch(e){}
        res.json(rows[0]);
    } catch (e) {
        console.error('Failed to update notification prefs:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};