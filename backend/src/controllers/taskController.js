// ubndxanuicam/backend/src/controllers/taskController.js
// VERSION 2.2 - FIXED CRITICAL BUG IN getTaskHistory

const pool = require('../db');
const fs = require('fs');
const path = require('path');
const logActivity = require('../utils/auditLogger');
const { createNotification } = require('../utils/notificationHelper');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

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

// Lấy danh sách công việc
exports.getTasks = async (req, res) => {
    const { id: userId, permissions } = req.user;
    try {
        let query;
        let params = [];
        // Nếu người dùng có quyền truy cập toàn bộ hoặc các quyền quản lý cấp cao, hiển thị tất cả công việc.
        if (permissions.includes('full_access') || permissions.includes('system_settings') || permissions.includes('view_reports')) {
            query = `
                SELECT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name
                FROM tasks t
                JOIN users creator ON t.creator_id = creator.id
                LEFT JOIN users assignee ON t.assignee_id = assignee.id
                ORDER BY t.created_at DESC
            `;
        } else {
             // Ngược lại, chỉ hiển thị công việc mà người dùng là người tạo hoặc người được giao.
             query = `
                SELECT DISTINCT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name
                FROM tasks t
                JOIN users creator ON t.creator_id = creator.id
                LEFT JOIN users assignee ON t.assignee_id = assignee.id
                WHERE t.assignee_id = $1 OR t.creator_id = $1
                ORDER BY t.created_at DESC
            `;
            params.push(userId);
        }
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải công việc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Tạo công việc mới
exports.createTask = async (req, res) => {
    const { title, description, assignee_id, due_date, priority } = req.body || {};
    const actor = req.user || {};
    const creatorId = Number.isInteger(actor.id) ? actor.id : (actor.id ? parseInt(actor.id, 10) : null);
    const creatorName = actor.fullName || 'Hệ thống';
    // Basic validation
    if (!creatorId || creatorId <= 0) {
        return res.status(401).json({ message: 'Người dùng không hợp lệ hoặc chưa đăng nhập.' });
    }
    if (!title || title.trim() === '') {
        return res.status(400).json({ message: 'Tiêu đề công việc là bắt buộc.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `
            INSERT INTO tasks (title, description, creator_id, assignee_id, due_date, priority, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'Mới tạo') RETURNING *
        `;
        // Coerce assignee id to integer or null
        const assigneeId = (assignee_id !== undefined && assignee_id !== null && assignee_id !== '') ? parseInt(assignee_id, 10) : null;

        const { rows } = await client.query(query, [title, description || null, creatorId, assigneeId, due_date || null, priority || null]);
        const newTask = rows[0];

        const assigneeRes = assigneeId ? await client.query('SELECT full_name FROM users WHERE id = $1', [assigneeId]) : { rows: [] };
        const assigneeName = assigneeRes.rows[0]?.full_name || 'Không xác định';

        // Ghi lại hành động tạo việc
        await logActivity(client, {
            userId: creatorId,
            module: 'Công việc',
            action: 'Tạo mới',
            details: `Giao việc "${title}" cho ${assigneeName}`,
            taskId: newTask.id
        });

        // Gửi thông báo cho người được giao
        const notificationMessage = `${creatorName} đã giao cho bạn một công việc mới: "${title}"`;
        if (assigneeId) {
            await createNotification(client, assigneeId, notificationMessage, `/tasks`);
        }

        await client.query('COMMIT');
        res.status(201).json(newTask);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi tạo công việc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Cập nhật trạng thái công việc
exports.updateTaskStatus = async (req, res) => {
    const { id } = req.params;
    const { status, details } = req.body;
    const { id: userId, fullName, permissions } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (taskRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }
        
        const task = taskRes.rows[0];
        const isAssignee = task.assignee_id === userId;
        const isCreator = task.creator_id === userId;
        const canApprove = permissions.includes('approve_task');
        let logAction = 'Cập nhật trạng thái';
        let logDetails = `${fullName} đã cập nhật trạng thái thành "${status}"`;
        let notificationMessage = '';
        let notificationRecipientId = null;

        // Allow cancel ('Đã hủy') for the creator or users with edit/delete permission
        const canEdit = permissions.includes('edit_delete_task');
        const canPerformAction = 
            (['Tiếp nhận', 'Đang thực hiện', 'Chờ duyệt'].includes(status) && isAssignee) ||
            (['Yêu cầu làm lại', 'Hoàn thành'].includes(status) && (isCreator || canApprove)) ||
            (status === 'Đã hủy' && (isCreator || canEdit));

        if (!canPerformAction) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này.' });
        }
        
        if (status === 'Hoàn thành') {
            await client.query('UPDATE tasks SET completed_at = NOW() WHERE id = $1', [id]);
            logAction = 'Duyệt hoàn thành';
            logDetails = details || `${fullName} đã duyệt và hoàn thành công việc.`;
            notificationMessage = `Công việc "${task.title}" của bạn đã được duyệt.`;
            notificationRecipientId = task.assignee_id;
        } else if (status === 'Yêu cầu làm lại') {
            logAction = 'Yêu cầu làm lại';
            logDetails = details || `${fullName} đã yêu cầu làm lại công việc.`;
            notificationMessage = `Công việc "${task.title}" của bạn được yêu cầu làm lại.`;
            notificationRecipientId = task.assignee_id;
        } else if (status === 'Tiếp nhận') {
            notificationMessage = `${fullName} đã tiếp nhận công việc "${task.title}".`;
            notificationRecipientId = task.creator_id;
        } else if (status === 'Chờ duyệt') {
            notificationMessage = `${fullName} đã báo cáo hoàn thành công việc "${task.title}".`;
            notificationRecipientId = task.creator_id;
        }


        await client.query('UPDATE tasks SET status = $1 WHERE id = $2', [status, id]);
        await logActivity(client, { userId, module: 'Công việc', action: logAction, details: logDetails, taskId: id });
        
        if (notificationMessage && notificationRecipientId && notificationRecipientId !== userId) {
            await createNotification(client, notificationRecipientId, notificationMessage, '/tasks');
        }

        await client.query('COMMIT');
        res.json({ message: 'Cập nhật trạng thái thành công', status });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi cập nhật trạng thái:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Đánh giá KPI
exports.updateTaskKpi = async (req, res) => {
    const { id } = req.params;
    const { kpi_score } = req.body;
    const { id: userId, fullName, permissions } = req.user;

    if (!kpi_score || kpi_score < 1 || kpi_score > 3) {
        return res.status(400).json({ message: 'Điểm KPI không hợp lệ.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const taskRes = await client.query('SELECT creator_id, assignee_id, status, title FROM tasks WHERE id = $1', [id]);
        const task = taskRes.rows[0];

        if (!task) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy công việc' });
        }

        const isCreator = task.creator_id === userId;
        const canApprove = permissions.includes('approve_task');

        if (!isCreator && !canApprove) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Bạn không có quyền đánh giá công việc này.' });
        }
        if (task.status !== 'Hoàn thành') {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Chỉ có thể đánh giá công việc đã hoàn thành.' });
        }

        await client.query('UPDATE tasks SET kpi_score = $1 WHERE id = $2', [kpi_score, id]);
        await logActivity(client, {
            userId,
            module: 'Công việc',
            action: 'Đánh giá KPI',
            details: `${fullName} đã đánh giá công việc "${task.title}" là ${kpi_score} sao.`,
            taskId: id
        });
        
        const notificationMessage = `Công việc "${task.title}" của bạn đã được đánh giá ${kpi_score} sao.`;
        await createNotification(client, task.assignee_id, notificationMessage, '/tasks');
        
        await client.query('COMMIT');
        res.json({ message: 'Đánh giá KPI thành công.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi đánh giá KPI:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Chỉnh sửa công việc
exports.updateTask = async (req, res) => {
    const { id: taskId } = req.params;
    const { id: userId, fullName, permissions } = req.user;
    const newData = req.body;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
        if (taskRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy công việc.' });
        }
        const oldData = taskRes.rows[0];

        const isCreator = oldData.creator_id === userId;
        const canEdit = permissions.includes('edit_delete_task');
        
        if (!isCreator && !canEdit) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa công việc này.' });
        }

        const query = `
            UPDATE tasks 
            SET title = $1, description = $2, assignee_id = $3, due_date = $4, priority = $5, updated_at = NOW()
            WHERE id = $6 RETURNING *
        `;
        const { rows } = await client.query(query, [newData.title, newData.description, newData.assignee_id, newData.due_date, newData.priority, taskId]);
        
        const changes = [];
        if (oldData.title !== newData.title) changes.push(`- Tên công việc.`);
        if (oldData.description !== newData.description) changes.push(`- Mô tả công việc.`);
        if (oldData.priority !== newData.priority) changes.push(`- Độ ưu tiên từ "${oldData.priority}" thành "${newData.priority}".`);
        if (new Date(oldData.due_date).toISOString().split('T')[0] !== new Date(newData.due_date).toISOString().split('T')[0]) {
             changes.push(`- Hạn chót thành "${new Date(newData.due_date).toLocaleDateString('vi-VN')}".`);
        }
        if (oldData.assignee_id !== parseInt(newData.assignee_id)) {
            const newAssigneeRes = await client.query('SELECT full_name FROM users WHERE id = $1', [newData.assignee_id]);
            const newName = newAssigneeRes.rows[0]?.full_name || 'Không rõ';
            changes.push(`- Người thực hiện thành "${newName}".`);
            const notifMsg = `${fullName} đã chuyển công việc "${newData.title}" cho bạn.`;
            await createNotification(client, newData.assignee_id, notifMsg, '/tasks');
        }
        
        if (changes.length > 0) {
            const logDetails = `${fullName} đã thay đổi công việc "${newData.title}":\n${changes.join('\n')}`;
            await logActivity(client, { userId, module: 'Công việc', action: 'Cập nhật thông tin', details: logDetails, taskId });
        }
        
        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi cập nhật công việc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Xóa công việc
exports.deleteTask = async (req, res) => {
    const { id: taskId } = req.params;
    const { id: userId, fullName, permissions } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        
        const taskRes = await client.query('SELECT creator_id, title FROM tasks WHERE id = $1', [taskId]);
        if (taskRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy công việc.' });
        }
        const task = taskRes.rows[0];

        const isCreator = task.creator_id === userId;
        const canDelete = permissions.includes('edit_delete_task');

        if (!isCreator && !canDelete) {
            await client.query('ROLLBACK');
            return res.status(403).json({ message: 'Bạn không có quyền xóa công việc này.' });
        }
        
        // Xóa các bảng có ràng buộc khóa ngoại trước.
        await client.query('DELETE FROM task_attachments WHERE task_id = $1', [taskId]);
        await client.query('DELETE FROM task_comments WHERE task_id = $1', [taskId]);
        await client.query('DELETE FROM audit_logs WHERE task_id = $1', [taskId]);
        await client.query('DELETE FROM tasks WHERE id = $1', [taskId]);

        await logActivity(client, {
            userId,
            module: 'Công việc',
            action: 'Xóa',
            details: `${fullName} đã xóa công việc "${task.title}".`,
            taskId: null // Task đã bị xóa
        });

        await client.query('COMMIT');
        res.json({ message: 'Công việc đã được xóa vĩnh viễn.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi xóa công việc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Lấy lịch sử của một công việc
exports.getTaskHistory = async (req, res) => {
    const { id } = req.params;
    try {
        // === SỬA LỖI QUAN TRỌNG ===
        // Đổi 'task_history' thành 'audit_logs' để truy vấn đúng bảng nhật ký hệ thống.
        const query = `
            SELECT h.id, h.action, h.details, h.created_at, u.full_name as user_name
            FROM audit_logs h
            JOIN users u ON h.user_id = u.id
            WHERE h.task_id = $1
            ORDER BY h.created_at ASC
        `;
        const { rows } = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải lịch sử công việc:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// --- BÌNH LUẬN ---
exports.getTaskComments = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT c.id, c.content, c.created_at, u.id as user_id, u.full_name, u.avatar
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id = $1
            ORDER BY c.created_at ASC
        `;
        const { rows } = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải bình luận:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

exports.addTaskComment = async (req, res) => {
    const { id: taskId } = req.params;
    const { content } = req.body;
    const { id: userId, fullName } = req.user;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');
        const query = 'INSERT INTO task_comments (task_id, user_id, content) VALUES ($1, $2, $3) RETURNING *';
        const { rows } = await client.query(query, [taskId, userId, content]);
        
        const taskRes = await client.query('SELECT title, creator_id, assignee_id FROM tasks WHERE id = $1', [taskId]);
        const task = taskRes.rows[0];

        await logActivity(client, { userId, module: 'Công việc', action: 'Bình luận', details: `${fullName} đã thêm một bình luận.`, taskId });

        // Gửi thông báo cho người còn lại trong cuộc hội thoại (người giao và người nhận)
        const recipientId = userId === task.creator_id ? task.assignee_id : task.creator_id;
        if (recipientId) {
            const notifMsg = `${fullName} đã bình luận về công việc "${task.title}".`;
            await createNotification(client, recipientId, notifMsg, '/tasks');
        }

        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi thêm bình luận:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// --- FILE ĐÍNH KÈM ---
exports.getTaskAttachments = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT a.id, a.file_path, a.file_name, a.uploaded_at, u.full_name as uploader_name
            FROM task_attachments a
            JOIN users u ON a.user_id = u.id
            WHERE a.task_id = $1
            ORDER BY a.uploaded_at DESC
        `;
        const { rows } = await pool.query(query, [id]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải tệp đính kèm:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

exports.addTaskAttachment = async (req, res) => {
    const { id: taskId } = req.params;
    const { id: userId, fullName } = req.user;

    if (!req.file) {
        return res.status(400).json({ message: 'Không có tệp nào được tải lên.' });
    }
    const filePath = req.file.path.replace(/\\/g, '/');
    const fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `
            INSERT INTO task_attachments (task_id, user_id, file_path, file_name)
            VALUES ($1, $2, $3, $4) RETURNING *
        `;
        const { rows } = await client.query(query, [taskId, userId, filePath, fileName]);
        
        const taskRes = await client.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
        const taskTitle = taskRes.rows[0]?.title || '';

        await logActivity(client, { userId, module: 'Công việc', action: 'Tải lên tệp', details: `${fullName} đã tải lên tệp: ${fileName}`, taskId });
        
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        deleteFile(req.file.path); // Xóa file đã tải lên nếu có lỗi CSDL
        console.error("Lỗi khi thêm tệp đính kèm:", error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally {
        client.release();
    }
};

// Lấy chi tiết một công việc
exports.getTask = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name
            FROM tasks t
            JOIN users creator ON t.creator_id = creator.id
            LEFT JOIN users assignee ON t.assignee_id = assignee.id
            WHERE t.id = $1
            LIMIT 1
        `;
        const { rows } = await pool.query(query, [id]);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy công việc.' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Lỗi khi tải chi tiết công việc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Bulk export tasks (xlsx/pdf/csv) with password confirmation and per-account daily limit
exports.exportTasksBulk = async (req, res) => {
    const actor = req.user || {};
    const actorId = actor.id;
    if (!actorId) return res.status(401).json({ message: 'Unauthorized' });
    const { format = 'xlsx', filters = {}, password } = req.body || {};
    if (!password) return res.status(400).json({ message: 'Password confirmation is required.' });
    try {
        // Allow skipping password confirmation in development/testing by setting SKIP_EXPORT_PASSWORD=1
        if (process.env.SKIP_EXPORT_PASSWORD !== '1') {
            const u = await pool.query('SELECT password_hash FROM users WHERE id = $1', [actorId]);
            if (!u || !u.rows || !u.rows[0]) return res.status(403).json({ message: 'Unable to validate user.' });
            const hash = u.rows[0].password_hash;
            const ok = await bcrypt.compare(String(password), String(hash));
            if (!ok) return res.status(403).json({ message: 'Xác thực mật khẩu thất bại.' });
        } else {
            console.warn('SKIP_EXPORT_PASSWORD is enabled; password confirmation skipped for exportTasksBulk');
        }
    } catch (err) {
        console.error('Error verifying password for export:', err);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }

    // enforce per-account daily limit (1 per day)
    try {
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS tasks_export_actions (id SERIAL PRIMARY KEY, actor_id INTEGER NOT NULL, format TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
        } catch (e) {}
        const todayCountRes = await pool.query("SELECT COUNT(*) FROM tasks_export_actions WHERE actor_id = $1 AND created_at >= date_trunc('day', now())", [actorId]);
        const usedToday = parseInt(todayCountRes.rows[0].count || '0', 10);
        if (usedToday >= 1) return res.status(403).json({ message: 'Mỗi tài khoản chỉ được xuất báo cáo công việc mỗi ngày 1 lần.' });
    } catch (e) {
        console.error('Quota check failed', e);
        return res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }

    // Build task query (basic filters supported)
    try {
        const where = ['1=1'];
        const params = [];
        let idx = 1;
        if (filters.status) { where.push(`t.status = $${idx++}`); params.push(filters.status); }
        if (filters.assigneeId) { where.push(`t.assignee_id = $${idx++}`); params.push(filters.assigneeId); }
        if (filters.startDate) { where.push(`t.created_at >= $${idx++}`); params.push(filters.startDate); }
        if (filters.endDate) { where.push(`t.created_at <= $${idx++}`); params.push(filters.endDate); }

        const q = `SELECT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name FROM tasks t JOIN users creator ON t.creator_id = creator.id LEFT JOIN users assignee ON t.assignee_id = assignee.id WHERE ${where.join(' AND ')} ORDER BY t.created_at DESC`;
        const { rows } = await pool.query(q, params);

        // Prepare file name and sheet name
        const pad = (n) => String(n).padStart(2, '0');
        const d = new Date();
        const dd = pad(d.getDate()); const mm = pad(d.getMonth()+1); const yyyy = d.getFullYear();
        const hh = pad(d.getHours()); const min = pad(d.getMinutes()); const ss = pad(d.getSeconds());
        const dateOnly = `${dd}${mm}${yyyy}`;
        const datetime = `${dd}${mm}${yyyy}${hh}${min}${ss}`;
        // allow client to suggest filename and sheet_name (frontend provides these hints)
        const requestedFilename = req.body && req.body.filename ? String(req.body.filename).trim() : '';
        const requestedSheet = req.body && req.body.sheet_name ? String(req.body.sheet_name).trim() : '';
        const moduleHint = req.body && req.body.module ? String(req.body.module).trim() : '';
        // default base depending on module hint
        const defaultBase = moduleHint === 'dashboard' ? `xanuicam_dashboard_${datetime}` : `xanuicam_tasks_${datetime}`;
        // compute final filename (if requestedFilename already contains an extension matching format, keep it)
        const fmt = String(format).toLowerCase();
        const ext = fmt === 'xlsx' ? 'xlsx' : (fmt === 'pdf' ? 'pdf' : 'csv');
        let filenameBase = '';
        if (requestedFilename) {
            // if requestedFilename already ends with the expected extension, use as-is
            if (requestedFilename.toLowerCase().endsWith('.' + ext)) filenameBase = requestedFilename;
            else filenameBase = `${requestedFilename}.${ext}`;
        } else {
            filenameBase = `${defaultBase}.${ext}`;
        }

            if (fmt === 'csv') {
            const columns = ['id','title','description','status','priority','creator_name','assignee_name','due_date','created_at','updated_at','kpi_score'];
            const csvRows = [columns.join(',')];
            for (const r of rows) {
                const row = columns.map(c => {
                    const v = r[c] !== undefined && r[c] !== null ? String(r[c]).replace(/\r|\n|,/g, ' ') : '';
                    return `"${v.replace(/"/g,'""')}"`;
                }).join(',');
                csvRows.push(row);
            }
            const bom = '\uFEFF';
            const csvContent = bom + csvRows.join('\n');
            try { await pool.query('INSERT INTO tasks_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'csv']); } catch(e){}
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}"`);
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
                    try { await pool.query('INSERT INTO tasks_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'pdf']); } catch(e){}
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}"`);
                    res.setHeader('X-Content-Type-Options', 'nosniff');
                    res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store');
                    res.setHeader('X-Download-Options', 'noopen');
                    return res.send(result);
                });
                doc.fontSize(14).text(`Danh sách công việc - Xuất ${rows.length} bản ghi`, { align: 'center' });
                doc.moveDown();
                doc.fontSize(10);
                for (const r of rows) {
                    const time = (r.created_at ? new Date(r.created_at).toLocaleString() : '');
                    doc.text(`ID: ${r.id}  Tiêu đề: ${r.title}`);
                    doc.text(`Người tạo: ${r.creator_name || '-'}  Người thực hiện: ${r.assignee_name || '-'}  Trạng thái: ${r.status || '-'} `);
                    doc.text(`Hạn chót: ${r.due_date ? new Date(r.due_date).toLocaleString() : '-'}  Thời gian tạo: ${time}`);
                    doc.text(`Mô tả: ${r.description ? String(r.description).slice(0, 300) : '-'}`);
                    doc.moveDown(0.5);
                }
                doc.end();
                return;
            } catch (e) {
                console.error('Failed to generate PDF tasks export', e);
                return res.status(500).json({ message: 'Lỗi khi tạo PDF' });
            }
        }

        // Default to xlsx
        try {
            const wb = new ExcelJS.Workbook();
            // Use requested sheet name if provided, otherwise default. When module=dashboard default to dashboard name.
            let defaultSheet = moduleHint === 'dashboard' ? `xanuicam_dashboard_${dateOnly}` : `xanuicam_tasks_${dateOnly}`;
            const safeSheet = (requestedSheet && requestedSheet.length > 0) ? requestedSheet : defaultSheet;
            const sheetName = String(safeSheet).substring(0,31);
            const ws = wb.addWorksheet(sheetName);
            const cols = [
                { header: 'ID', key: 'id' }, { header: 'Tiêu đề', key: 'title' }, { header: 'Mô tả', key: 'description' },
                { header: 'Trạng thái', key: 'status' }, { header: 'Độ ưu tiên', key: 'priority' }, { header: 'Người tạo', key: 'creator_name' },
                { header: 'Người thực hiện', key: 'assignee_name' }, { header: 'Hạn chót', key: 'due_date' }, { header: 'Thời gian tạo', key: 'created_at' },
                { header: 'Thời gian cập nhật', key: 'updated_at' }, { header: 'KPI', key: 'kpi_score' }
            ];
            ws.columns = cols;
            for (const r of rows) {
                ws.addRow({
                    id: r.id,
                    title: r.title || '',
                    description: r.description || '',
                    status: r.status || '',
                    priority: r.priority || '',
                    creator_name: r.creator_name || '',
                    assignee_name: r.assignee_name || '',
                    due_date: r.due_date ? r.due_date.toISOString() : '',
                    created_at: r.created_at ? r.created_at.toISOString() : '',
                    updated_at: r.updated_at ? r.updated_at.toISOString() : '',
                    kpi_score: r.kpi_score || ''
                });
            }
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}"`);
            try { res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.setHeader('X-Download-Options', 'noopen'); } catch (e) {}
            await wb.xlsx.write(res);
            res.end();
            try { await pool.query('INSERT INTO tasks_export_actions (actor_id, format) VALUES ($1,$2)', [actorId, 'xlsx']); } catch(e){}
            return;
        } catch (e) {
            console.error('Failed to create XLSX for tasks export', e);
            return res.status(500).json({ message: 'Lỗi khi tạo file Excel' });
        }

    } catch (error) {
        console.error('exportTasksBulk error', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy các công việc đã hủy (soft-deleted)
exports.getDeletedTasks = async (req, res) => {
    try {
        const query = `
            SELECT t.*, creator.full_name as creator_name, assignee.full_name as assignee_name
            FROM tasks t
            JOIN users creator ON t.creator_id = creator.id
            LEFT JOIN users assignee ON t.assignee_id = assignee.id
            WHERE LOWER(t.status) LIKE '%hủy%'
            ORDER BY t.updated_at DESC
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error('Lỗi khi lấy công việc đã hủy:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Khôi phục công việc đã hủy
exports.restoreDeletedTask = async (req, res) => {
    const { id } = req.params;
    const { id: userId, fullName, permissions } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const taskRes = await client.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (taskRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Không tìm thấy công việc.' }); }
        const task = taskRes.rows[0];
        const isCreator = task.creator_id === userId;
        const canEdit = permissions.includes('edit_delete_task');
        if (!isCreator && !canEdit) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Bạn không có quyền khôi phục công việc.' }); }
        await client.query("UPDATE tasks SET status = 'Mới tạo', updated_at = NOW() WHERE id = $1", [id]);
        await logActivity(client, { userId, module: 'Công việc', action: 'Khôi phục', details: `${fullName} đã khôi phục công việc "${task.title}".`, taskId: id });
        await client.query('COMMIT');
        res.json({ message: 'Đã khôi phục công việc.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi khôi phục công việc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally { client.release(); }
};

// Xóa vĩnh viễn công việc đã hủy (yêu cầu mật khẩu)
exports.permanentlyDeleteTask = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body || {};
    const { id: userId, fullName, permissions } = req.user;
    if (!password && process.env.SKIP_DELETE_PASSWORD !== '1') return res.status(400).json({ message: 'Yêu cầu mật khẩu để xóa vĩnh viễn.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // verify user exists and password matches (unless SKIP_DELETE_PASSWORD)
        if (process.env.SKIP_DELETE_PASSWORD !== '1') {
            const u = await client.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
            if (!u || !u.rows || !u.rows[0]) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Không thể xác thực người dùng.' }); }
            const ok = await bcrypt.compare(String(password), String(u.rows[0].password_hash));
            if (!ok) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Xác thực mật khẩu thất bại.' }); }
        }

        const taskRes = await client.query('SELECT creator_id, title, status FROM tasks WHERE id = $1', [id]);
        if (taskRes.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Không tìm thấy công việc.' }); }
        const task = taskRes.rows[0];
        const isCreator = task.creator_id === userId;
        const canDelete = permissions.includes('edit_delete_task');
        if (!isCreator && !canDelete) { await client.query('ROLLBACK'); return res.status(403).json({ message: 'Bạn không có quyền xóa vĩnh viễn công việc này.' }); }

        // Only allow permanent delete if task is currently marked as deleted
        if (!task.status || !String(task.status).toLowerCase().includes('hủy')) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Chỉ có thể xóa vĩnh viễn công việc đã được hủy.' }); }

        // remove attachments, comments, audit logs and the task
        await client.query('DELETE FROM task_attachments WHERE task_id = $1', [id]);
        await client.query('DELETE FROM task_comments WHERE task_id = $1', [id]);
        await client.query('DELETE FROM audit_logs WHERE task_id = $1', [id]);
        await client.query('DELETE FROM tasks WHERE id = $1', [id]);

        await logActivity(client, { userId, module: 'Công việc', action: 'Xóa vĩnh viễn', details: `${fullName} đã xóa vĩnh viễn công việc "${task.title}".`, taskId: null });
        await client.query('COMMIT');
        res.json({ message: 'Đã xóa vĩnh viễn công việc.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Lỗi khi xóa vĩnh viễn công việc:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    } finally { client.release(); }
};