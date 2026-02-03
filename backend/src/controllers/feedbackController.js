// ubndxanuicam/backend/src/controllers/feedbackController.js
const pool = require('../db');
const { createNotification } = require('../utils/notificationHelper');

// == BỔ SUNG HÀM MỚI ==
/**
 * @description Lấy danh sách các góp ý đã gửi của người dùng hiện tại.
 * @route GET /api/feedback/my-feedback
 * @access Private
 */
exports.getMyFeedback = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const query = `
            SELECT 
                f.id, f.title, f.content, f.status, f.created_at, 
                f.response_content, f.responded_at, u_respond.full_name as responder_name
            FROM feedback f
            LEFT JOIN users u_respond ON f.responded_by = u_respond.id
            WHERE f.submitted_by = $1
            ORDER BY f.created_at DESC;
        `;
        const { rows } = await pool.query(query, [userId]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử góp ý của người dùng:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

// Xử lý khi người dùng gửi góp ý mới
exports.submitFeedback = async (req, res) => {
    const { title, content, isAnonymous } = req.body;
    const { id: userId } = req.user;

    if (!title || !content) {
        return res.status(400).json({ message: 'Tiêu đề và nội dung không được để trống.' });
    }

    try {
        const query = `
            INSERT INTO feedback (title, content, is_anonymous, submitted_by)
            VALUES ($1, $2, $3, $4) RETURNING id;
        `;
        await pool.query(query, [title, content, isAnonymous, userId]);
        res.status(201).json({ message: 'Cảm ơn bạn đã gửi góp ý!' });
    } catch (error) {
        console.error("Lỗi khi lưu góp ý:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ, không thể lưu góp ý.' });
    }
};

// Lấy tất cả góp ý (dành cho Admin)
exports.getAllFeedback = async (req, res) => {
    try {
        const query = `
            SELECT 
                f.id, f.title, f.status, f.created_at, f.is_anonymous, 
                u_submit.full_name as submitter_name
            FROM feedback f
            LEFT JOIN users u_submit ON f.submitted_by = u_submit.id
            ORDER BY f.created_at DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách góp ý:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

// Lấy chi tiết một góp ý (dành cho Admin)
exports.getFeedbackById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT 
                f.*,
                u_submit.full_name as submitter_name,
                u_respond.full_name as responder_name
            FROM feedback f
            LEFT JOIN users u_submit ON f.submitted_by = u_submit.id
            LEFT JOIN users u_respond ON f.responded_by = u_respond.id
            WHERE f.id = $1;
        `;
        const { rows } = await pool.query(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Không tìm thấy góp ý này.' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Lỗi khi lấy chi tiết góp ý:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    }
};

// Phản hồi một góp ý (dành cho Admin)
exports.respondToFeedback = async (req, res) => {
    const { id } = req.params;
    const { response_content, status } = req.body;
    const { id: adminId } = req.user;

    if (!response_content || !status) {
        return res.status(400).json({ message: 'Nội dung phản hồi và trạng thái không được để trống.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `
            UPDATE feedback
            SET 
                response_content = $1, 
                status = $2, 
                responded_by = $3, 
                responded_at = NOW()
            WHERE id = $4
            RETURNING *;
        `;
        const { rows } = await client.query(query, [response_content, status, adminId, id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy góp ý để phản hồi.' });
        }
        
        const feedback = rows[0];
        if (!feedback.is_anonymous && feedback.submitted_by) {
            const message = `Góp ý "${feedback.title.substring(0, 30)}..." của bạn đã được phản hồi.`;
            // Sử dụng helper để tạo thông báo
            await createNotification(client, feedback.submitted_by, message, '/feedback');
        }

        await client.query('COMMIT');
        res.json(feedback);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi phản hồi góp ý:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ.' });
    } finally {
        client.release();
    }
};