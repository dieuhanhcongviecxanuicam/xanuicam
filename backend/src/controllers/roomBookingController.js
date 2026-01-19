// ubndxanuicam/backend/src/controllers/roomBookingController.js
const pool = require('../db');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const fetch = require('node-fetch');
const sanitizeHtml = require('sanitize-html');
const logActivity = require('../utils/auditLogger');
const { spawnSync } = require('child_process');

// Helper: attempt to convert a DOCX file to PDF and store next to original file.
// Returns path to generated PDF or null.
const convertDocxToPdf = async (docxPath) => {
    try {
        if (!docxPath || !fs.existsSync(docxPath)) return null;
        const base = path.basename(docxPath, path.extname(docxPath));
        const dir = path.dirname(docxPath);
        const pdfName = `${base}.pdf`;
        const outPdf = path.join(dir, pdfName);

        // If already exists, return immediately
        if (fs.existsSync(outPdf)) return outPdf;

        // Prefer local soffice if available
        const sofficePath = process.env.SOFFICE_PATH || process.env.LIBREOFFICE_PATH || 'soffice';
        try {
            // Use spawnSync to avoid orphaned processes; timeout is set
            const res = spawnSync(sofficePath, ['--headless', '--convert-to', 'pdf', '--outdir', dir, docxPath], { timeout: 60_000 });
            if (res.status === 0 && fs.existsSync(outPdf)) return outPdf;
        } catch (e) {
            // ignore and try converter service
        }

        // If a converter service is configured (useful in containerized production), try proxying to it
        const convUrl = process.env.DOCX_CONVERTER_URL;
        if (convUrl) {
            try {
                const fetch = require('node-fetch');
                const resp = await fetch(convUrl + '/convert', { method: 'POST', body: JSON.stringify({ path: docxPath.replace(/\\/g,'/') }), headers: { 'Content-Type': 'application/json' }, timeout: 120000 });
                if (resp.ok) {
                    const buffer = await resp.buffer();
                    fs.writeFileSync(outPdf, buffer);
                    return outPdf;
                }
            } catch (e) {
                // continue to fallthrough
            }
        }

        return null;
    } catch (e) {
        console.warn('convertDocxToPdf failed:', e && e.message ? e.message : e);
        return null;
    }
};

// Cache table columns to avoid repeated schema queries
const tableColumnsCache = {};
const getTableColumns = async (tableName) => {
    if (tableColumnsCache[tableName]) return tableColumnsCache[tableName];
    try {
        const q = `SELECT column_name FROM information_schema.columns WHERE table_name = $1`;
        const { rows } = await pool.query(q, [tableName]);
        const cols = rows.map(r => r.column_name);
        tableColumnsCache[tableName] = cols;
        return cols;
    } catch (e) {
        console.warn('Failed to fetch table columns for', tableName, '(assuming minimal set).', e && e.message ? e.message : e);
        tableColumnsCache[tableName] = [];
        return [];
    }
};
    // Global storage limits
    const MAX_TOTAL_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
    const STORAGE_WARNING_THRESHOLD = 0.8; // 80%

    async function computeTotalAttachmentStorage() {
        try {
            const q = `SELECT COALESCE(SUM(file_size),0) as total FROM (
                SELECT file_size FROM room_booking_attachments
                UNION ALL
                SELECT file_size FROM deleted_room_booking_attachments
            ) t`;
            const res = await pool.query(q);
            return parseInt(res.rows[0].total || 0, 10);
        } catch (e) {
            console.warn('Failed to compute total attachment storage', e && e.message ? e.message : e);
            return 0;
        }
    }

// Lấy danh sách đăng ký phòng họp trong khoảng thời gian hoặc theo trạng thái
exports.getBookings = async (req, res) => {
    const { start, end, status, room_name } = req.query;
    // Build SELECT dynamically so the endpoint works with older DB schemas that
    // might not yet include newer columns like department_id, attendees_count, has_led, attachment_path, leader_in_charge.
    const colsInDb = await getTableColumns('room_bookings');
    const selectCols = [
        'rb.id', 'rb.room_name', 'rb.title', 'rb.description', 'rb.start_time', 'rb.end_time', 'rb.status', 'rb.booker_id', 'u.full_name as booker_name'
    ];
    if (colsInDb.includes('approver_id')) selectCols.push('rb.approver_id', 'a.full_name as approver_name', 'rb.approved_at');
    if (colsInDb.includes('department_id')) selectCols.push('rb.department_id');
    if (colsInDb.includes('basis_super')) selectCols.push('rb.basis_super');
    if (colsInDb.includes('basis_commune')) selectCols.push('rb.basis_commune');
    if (colsInDb.includes('attendees_count')) selectCols.push('rb.attendees_count');
    if (colsInDb.includes('has_led')) selectCols.push('rb.has_led');
    if (colsInDb.includes('other_invited_count')) selectCols.push('rb.other_invited_count');
    if (colsInDb.includes('attachment_path')) selectCols.push('rb.attachment_path');
    // prefer joined user's full_name, but if leader_in_charge_text exists prefer that when no user
    if (colsInDb.includes('leader_in_charge') && colsInDb.includes('leader_in_charge_text')) {
        selectCols.push('rb.leader_in_charge', 'COALESCE(l.full_name, rb.leader_in_charge_text) as leader_name');
    } else if (colsInDb.includes('leader_in_charge')) {
        selectCols.push('rb.leader_in_charge', 'l.full_name as leader_name');
    } else if (colsInDb.includes('leader_in_charge_text')) {
        selectCols.push('rb.leader_in_charge_text as leader_name');
    }

    let query = `
        SELECT ${selectCols.join(', ')}
        FROM room_bookings rb
        JOIN users u ON rb.booker_id = u.id`;
    if (colsInDb.includes('approver_id')) query += `\n        LEFT JOIN users a ON rb.approver_id = a.id`;
    if (colsInDb.includes('leader_in_charge')) query += `\n        LEFT JOIN users l ON rb.leader_in_charge = l.id`;
    const params = [];
    let paramIndex = 1;
    let whereClauses = [];

    if (start && end) {
        whereClauses.push(`rb.start_time >= $${paramIndex++} AND rb.start_time <= $${paramIndex++}`);
        params.push(start, end);
    }
    if (room_name) {
        whereClauses.push(`rb.room_name = $${paramIndex++}`);
        params.push(room_name);
    }
    if (status) {
        whereClauses.push(`rb.status = $${paramIndex++}`);
        params.push(status);
    }

    if (whereClauses.length > 0) {
        query += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    query += ` ORDER BY rb.start_time;`;

    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải danh sách đặt phòng:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Tạo một lượt đăng ký phòng họp mới
exports.createBooking = async (req, res) => {
    const { room_name, title, start_time, end_time, description, department_id, attendees_count, has_led, leader_in_charge, leader_in_charge_text, other_invited_count } = req.body;
    // Basic validation to avoid NULL constraint DB errors and provide friendly feedback
    if (!room_name || typeof room_name !== 'string' || room_name.trim() === '') {
        return res.status(400).json({ message: 'Tên phòng (room_name) là bắt buộc.' });
    }
    if (!title || typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ message: 'Tiêu đề (title) là bắt buộc.' });
    }
    if (!start_time || !end_time) {
        return res.status(400).json({ message: 'Thời gian bắt đầu và kết thúc là bắt buộc.' });
    }
    // Numeric field validation: attendees_count must be integer >=1, other_invited_count integer >=0
    if (typeof attendees_count !== 'undefined' && attendees_count !== null && String(attendees_count).trim() !== '') {
        const n = Number(attendees_count);
        if (!Number.isInteger(n) || n < 1) return res.status(400).json({ message: 'Số lượng Đại Biểu phải là số nguyên lớn hơn hoặc bằng 1.' });
    }
    if (typeof other_invited_count !== 'undefined' && other_invited_count !== null && String(other_invited_count).trim() !== '') {
        const m = Number(other_invited_count);
        if (!Number.isInteger(m) || m < 0) return res.status(400).json({ message: 'Số lượng Khác mời phải là số nguyên không âm.' });
    }
    const { id: bookerId } = req.user;
    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    // Validate files sizes and per-day quotas (pdf: 50MB/day, docx: 20MB/day)
    try {
        // compute today's existing usage for this user
        const pdfSumRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM room_booking_attachments WHERE user_id = $1 AND file_ext = 'pdf' AND created_at::date = CURRENT_DATE", [bookerId]);
        const docxSumRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM room_booking_attachments WHERE user_id = $1 AND file_ext = 'docx' AND created_at::date = CURRENT_DATE", [bookerId]);
        const existingPdf = Number(pdfSumRes.rows[0].total || 0);
        const existingDocx = Number(docxSumRes.rows[0].total || 0);

        let newPdfTotal = 0, newDocxTotal = 0;
        for (const f of files) {
            const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
            const ext = (originalName.split('.').pop() || '').toLowerCase();
            const size = Number(f.size || 0);
            if (ext === 'docx' && size > 20 * 1024 * 1024) return res.status(400).json({ message: 'Tệp docx không được lớn hơn 20MB.' });
            if (ext === 'pdf' && size > 50 * 1024 * 1024) return res.status(400).json({ message: 'Tệp PDF không được lớn hơn 50MB.' });
            if (ext === 'pdf') newPdfTotal += size;
            if (ext === 'docx') newDocxTotal += size;
        }
        if (existingPdf + newPdfTotal > 50 * 1024 * 1024) return res.status(400).json({ message: 'Hạn mức tải lên PDF trong ngày đã vượt quá 50MB.' });
        if (existingDocx + newDocxTotal > 20 * 1024 * 1024) return res.status(400).json({ message: 'Hạn mức tải lên DOCX trong ngày đã vượt quá 20MB.' });
        // Global storage check: total attachments (active + archived) + new files must not exceed 10GB
        try {
            const currentTotal = await computeTotalAttachmentStorage();
            if (currentTotal !== null) {
                const newFilesTotal = files.reduce((s,f)=>s + (Number(f.size||0)),0);
                const limit = 10 * 1024 * 1024 * 1024; // 10GB
                const threshold = Math.floor(limit * 0.8);
                if (currentTotal + newFilesTotal > limit) {
                    return res.status(400).json({ message: 'Tổng dung lượng lưu trữ đã vượt quá hạn mức 10GB. Vui lòng liên hệ quản trị viên.' });
                }
                // If above 80% but below limit, include header to warn clients (frontend may display)
                if (currentTotal + newFilesTotal > threshold) {
                    res.set('X-Storage-Quota-Warning', '1');
                }
            }
        } catch (e) {
            // do not block uploads if storage check fails; just log
            console.warn('Storage quota check failed (continuing):', e && e.message ? e.message : e);
        }
    } catch (chkErr) {
        console.error('Lỗi khi kiểm tra hạn mức tải lên:', chkErr);
        return res.status(500).json({ message: 'Lỗi khi kiểm tra tệp tải lên.' });
    }
    const attachment = files.length > 0 ? files.map(f => f.path.replace(/\\/g, '/')) : null;
    try {
        // Kiểm tra xem có lịch nào bị trùng không
        const conflictCheck = await pool.query(
            `SELECT id FROM room_bookings 
             WHERE room_name = $1 AND status = 'Đã duyệt' AND 
             (start_time, end_time) OVERLAPS ($2, $3)`,
            [room_name, start_time, end_time]
        );

        if (conflictCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Phòng đã có người đặt trong khoảng thời gian này.' });
        }

        // Build INSERT using only columns that exist in the DB to remain compatible
        const colsInDb = await getTableColumns('room_bookings');
        const cols = [];
        const vals = [];
        const placeholders = [];
        let pi = 1;

        const push = (name, value) => { cols.push(name); vals.push(value); placeholders.push(`$${pi++}`); };

        // required/basic fields
        push('room_name', room_name);
        push('title', title);
        push('start_time', start_time);
        push('end_time', end_time);
        if (colsInDb.includes('description')) push('description', description || null);
        if (colsInDb.includes('booker_id')) push('booker_id', bookerId);

        // optional newer fields - include only if present in schema
        if (colsInDb.includes('department_id')) push('department_id', department_id || null);
        if (colsInDb.includes('basis_super')) push('basis_super', typeof req.body.basis_super !== 'undefined' ? (req.body.basis_super || null) : (basis_super || null));
        if (colsInDb.includes('basis_commune')) push('basis_commune', typeof req.body.basis_commune !== 'undefined' ? (req.body.basis_commune || null) : (basis_commune || null));
        if (colsInDb.includes('attendees_count')) push('attendees_count', attendees_count ? Number(attendees_count) : 1);
        if (colsInDb.includes('other_invited_count')) push('other_invited_count', other_invited_count ? Number(other_invited_count) : 0);
        if (colsInDb.includes('has_led')) push('has_led', (has_led === 'true' || has_led === true));
        if (colsInDb.includes('leader_in_charge')) push('leader_in_charge', leader_in_charge || null);
        if (colsInDb.includes('leader_in_charge_text')) push('leader_in_charge_text', leader_in_charge_text || null);
        // store attachment_path as JSON array of stored paths for backward compatibility
        const attachmentDbValue = attachment ? JSON.stringify(attachment) : null;
        if (colsInDb.includes('attachment_path')) push('attachment_path', attachmentDbValue);

        const insertQuery = `INSERT INTO room_bookings (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
        const { rows } = await pool.query(insertQuery, vals);
        const created = rows[0];
        // persist attachments metadata into room_booking_attachments
        if (files.length > 0) {
            // Try to read relative paths if frontend supplied them as attachments_relative_paths[]
            let rels = req.body['attachments_relative_paths[]'] || req.body.attachments_relative_paths || req.body.attachments_relative_path || null;
            if (rels && !Array.isArray(rels)) rels = [rels];

            // Check whether room_booking_attachments has a 'relative_path' column
            const attachCols = await getTableColumns('room_booking_attachments');
            const hasRelative = attachCols.includes('relative_path');

            const baseCols = ['booking_id', 'user_id', 'file_path', 'file_name', 'file_size', 'file_ext'];
            if (hasRelative) baseCols.push('relative_path');
            const placeholders = baseCols.map((_,i)=>`$${i+1}`).join(',');
            const insertAttach = `INSERT INTO room_booking_attachments (${baseCols.join(',')}) VALUES (${placeholders})`;

            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                const ext = (originalName.split('.').pop() || '').toLowerCase();
                const filePath = f.path.replace(/\\/g, '/');
                const values = [created.id, bookerId, filePath, originalName, Number(f.size || 0), ext];
                if (hasRelative) values.push((Array.isArray(rels) && rels[i]) ? rels[i] : null);
                await pool.query(insertAttach, values);
            }
            // Asynchronously generate PDF previews for any uploaded DOCX files to improve production preview fidelity
            try {
                for (const f of files) {
                    const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                    const ext = (originalName.split('.').pop() || '').toLowerCase();
                    if (ext === 'docx') {
                        const fp = path.join(process.cwd(), f.path.replace(/\\/g, '/'));
                        // do not await; run in background
                        convertDocxToPdf(fp).then(p => {
                            if (p) console.log('Generated PDF preview:', p);
                        }).catch(e => console.warn('Background convert error:', e && e.message ? e.message : e));
                    }
                }
            } catch (e) {
                console.warn('Background PDF conversion queue failed:', e && e.message ? e.message : e);
            }
        }
        res.status(201).json(created);
    } catch (error) {
        console.error("Lỗi khi tạo lịch đặt phòng:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Cập nhật trạng thái (phê duyệt/từ chối)
exports.updateBookingStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Đã duyệt', 'Từ chối'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    try {
        // Ghi lại người phê duyệt và thời gian (nếu cột tồn tại)
        const approverId = req.user?.id || null;
        try {
            const { rows } = await pool.query('UPDATE room_bookings SET status = $1, approver_id = $2, approved_at = NOW() WHERE id = $3 RETURNING *', [status, approverId, id]);
            if (rows.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy lịch đặt phòng." });
            }
            // Audit: log status change
            try {
                const updated = rows[0];
                const actor = req.user || {};
                await logActivity(pool, {
                    userId: actor.id,
                    module: 'Đặt phòng',
                    action: 'Cập nhật trạng thái',
                    details: `${actor.fullName || actor.username || 'Người dùng'} đã thay đổi trạng thái lịch #${id} thành "${status}"`,
                    url: `/room-bookings/${id}`,
                    method: 'PUT',
                    change: { status: { old: null, new: status } }
                });
            } catch (e) {
                console.warn('Failed to log booking status audit (ignored):', e && e.message ? e.message : e);
            }
            return res.json(rows[0]);
        } catch (innerErr) {
            // Nếu DB không có cột approver_id/approved_at (môi trường cũ), fallback chỉ cập nhật status
            if (innerErr && innerErr.code === '42703') {
                const { rows } = await pool.query('UPDATE room_bookings SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
                if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy lịch đặt phòng." });
                return res.json(rows[0]);
            }
            throw innerErr;
        }
    } catch (error) {
        console.error("Lỗi khi cập nhật trạng thái đặt phòng:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Cập nhật chi tiết booking (title, times, room, description)
exports.updateBooking = async (req, res) => {
    const { id } = req.params;
    const { room_name, title, description, start_time, end_time, department_id, attendees_count, has_led, leader_in_charge, leader_in_charge_text, other_invited_count } = req.body;
    const colsInDb = await getTableColumns('room_bookings');
    const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
    // Validate numeric counts on update if provided
    if (typeof attendees_count !== 'undefined' && attendees_count !== null && String(attendees_count).trim() !== '') {
        const n = Number(attendees_count);
        if (!Number.isInteger(n) || n < 1) return res.status(400).json({ message: 'Số lượng Đại Biểu phải là số nguyên lớn hơn hoặc bằng 1.' });
    }
    if (typeof other_invited_count !== 'undefined' && other_invited_count !== null && String(other_invited_count).trim() !== '') {
        const m = Number(other_invited_count);
        if (!Number.isInteger(m) || m < 0) return res.status(400).json({ message: 'Số lượng Khác mời phải là số nguyên không âm.' });
    }
    // Validate files sizes and per-day quotas (pdf: 50MB/day, docx: 20MB/day)
    let updateQuery = null;
    let updateParams = null;
    try {
        const userId = req.user?.id;
        if (files.length > 0 && userId) {
            const pdfSumRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM room_booking_attachments WHERE user_id = $1 AND file_ext = 'pdf' AND created_at::date = CURRENT_DATE", [userId]);
            const docxSumRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM room_booking_attachments WHERE user_id = $1 AND file_ext = 'docx' AND created_at::date = CURRENT_DATE", [userId]);
            const existingPdf = Number(pdfSumRes.rows[0].total || 0);
            const existingDocx = Number(docxSumRes.rows[0].total || 0);
            let newPdfTotal = 0, newDocxTotal = 0;
            for (const f of files) {
                const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                const ext = (originalName.split('.').pop() || '').toLowerCase();
                const size = Number(f.size || 0);
                if (ext === 'docx' && size > 20 * 1024 * 1024) return res.status(400).json({ message: 'Tệp docx không được lớn hơn 20MB.' });
                if (ext === 'pdf' && size > 50 * 1024 * 1024) return res.status(400).json({ message: 'Tệp PDF không được lớn hơn 50MB.' });
                if (ext === 'pdf') newPdfTotal += size;
                if (ext === 'docx') newDocxTotal += size;
            }
            if (existingPdf + newPdfTotal > 50 * 1024 * 1024) return res.status(400).json({ message: 'Hạn mức tải lên PDF trong ngày đã vượt quá 50MB.' });
            if (existingDocx + newDocxTotal > 20 * 1024 * 1024) return res.status(400).json({ message: 'Hạn mức tải lên DOCX trong ngày đã vượt quá 20MB.' });
            // Global storage check
            try {
                const currentTotal = await computeTotalAttachmentStorage();
                if (currentTotal !== null) {
                    const newFilesTotal = files.reduce((s,f)=>s + (Number(f.size||0)),0);
                    const limit = 10 * 1024 * 1024 * 1024;
                    const threshold = Math.floor(limit * 0.8);
                    if (currentTotal + newFilesTotal > limit) {
                        return res.status(400).json({ message: 'Tổng dung lượng lưu trữ đã vượt quá hạn mức 10GB. Vui lòng liên hệ quản trị viên.' });
                    }
                    if (currentTotal + newFilesTotal > threshold) {
                        res.set('X-Storage-Quota-Warning', '1');
                    }
                }
            } catch (e) { console.warn('Storage quota check failed (continue):', e && e.message ? e.message : e); }
        }
    } catch (chkErr) {
        console.error('Lỗi khi kiểm tra hạn mức tải lên:', chkErr);
        return res.status(500).json({ message: 'Lỗi khi kiểm tra tệp tải lên.' });
    }
    try {
        const { rows: existingRows } = await pool.query('SELECT * FROM room_bookings WHERE id = $1', [id]);
        if (existingRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy lịch.' });
        const existing = existingRows[0];

        // Quyền: người tạo hoặc có quyền quản lý mới được sửa
        const user = req.user || {};
        const hasManage = Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access'));
        if (existing.booker_id !== user.id && !hasManage) {
            return res.status(403).json({ message: 'Bạn không có quyền sửa lịch này.' });
        }

        // Nếu cập nhật thời gian, kiểm tra xung đột với các booking đã duyệt khác
        if (start_time && end_time) {
            const conflictCheck = await pool.query(
                `SELECT id FROM room_bookings WHERE room_name = $1 AND status = 'Đã duyệt' AND id != $2 AND (start_time, end_time) OVERLAPS ($3, $4)`,
                [room_name || existing.room_name, id, start_time, end_time]
            );
            if (conflictCheck.rows.length > 0) {
                return res.status(409).json({ message: 'Phòng đã có người đặt trong khoảng thời gian này.' });
            }
        }

        const fields = [];
        const params = [];
        let idx = 1;
        if (room_name !== undefined) { fields.push(`room_name = $${idx++}`); params.push(room_name); }
        if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
        if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
        if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); params.push(start_time); }
        if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); params.push(end_time); }
        if (department_id !== undefined && colsInDb.includes('department_id')) {
            const deptId = (department_id === '' || department_id === null) ? null : (isNaN(Number(department_id)) ? null : Number(department_id));
            fields.push(`department_id = $${idx++}`); params.push(deptId);
        }
        if (attendees_count !== undefined && colsInDb.includes('attendees_count')) {
            fields.push(`attendees_count = $${idx++}`); params.push(Number(attendees_count));
        }
        if (other_invited_count !== undefined && colsInDb.includes('other_invited_count')) {
            fields.push(`other_invited_count = $${idx++}`); params.push(Number(other_invited_count));
        }
        if (has_led !== undefined && colsInDb.includes('has_led')) {
            fields.push(`has_led = $${idx++}`); params.push((has_led === 'true' || has_led === true));
        }
        if (leader_in_charge !== undefined || leader_in_charge_text !== undefined) {
            // If a numeric id is provided, store it in leader_in_charge; otherwise store custom text in leader_in_charge_text (if supported)
            const leaderId = (leader_in_charge === '' || leader_in_charge === null) ? null : (isNaN(Number(leader_in_charge)) ? null : Number(leader_in_charge));
            if (leaderId !== null && colsInDb.includes('leader_in_charge')) {
                fields.push(`leader_in_charge = $${idx++}`); params.push(leaderId);
                // clear any custom text if column exists
                if (colsInDb.includes('leader_in_charge_text')) { fields.push(`leader_in_charge_text = $${idx++}`); params.push(null); }
            } else {
                // no numeric id: store text if column available, otherwise NULL the leader_in_charge
                if (colsInDb.includes('leader_in_charge_text')) {
                    fields.push(`leader_in_charge_text = $${idx++}`); params.push(leader_in_charge_text || (typeof leader_in_charge === 'string' ? leader_in_charge : null));
                    if (colsInDb.includes('leader_in_charge')) { fields.push(`leader_in_charge = $${idx++}`); params.push(null); }
                } else if (colsInDb.includes('leader_in_charge')) {
                    // fallback: set numeric column to null
                    fields.push(`leader_in_charge = $${idx++}`); params.push(null);
                }
            }
        }
        // Persist basis fields if present in request and supported by schema
        if (colsInDb.includes('basis_super') && typeof req.body.basis_super !== 'undefined') { fields.push(`basis_super = $${idx++}`); params.push(req.body.basis_super || null); }
        if (colsInDb.includes('basis_commune') && typeof req.body.basis_commune !== 'undefined') { fields.push(`basis_commune = $${idx++}`); params.push(req.body.basis_commune || null); }
        // If new files are uploaded, merge them with existing attachment_path (store as JSON array)
        let newAttachmentValue;
        // Handle deleted files requested by client (deleted_files or deleted_attachments)
        let deletedFiles = [];
        try {
            const rawDeleted = req.body.deleted_files || req.body.deleted_attachments || req.body.deleted_attachments_list;
            if (rawDeleted) {
                if (typeof rawDeleted === 'string') {
                    try { deletedFiles = JSON.parse(rawDeleted); } catch (e) { deletedFiles = [rawDeleted]; }
                } else if (Array.isArray(rawDeleted)) {
                    deletedFiles = rawDeleted;
                }
            }
        } catch (e) { deletedFiles = []; }

        // normalize existing attachment paths once
        let existingPaths = [];
        try {
            if (existing.attachment_path) {
                if (typeof existing.attachment_path === 'string') {
                    try { existingPaths = JSON.parse(existing.attachment_path); if (!Array.isArray(existingPaths)) existingPaths = [existing.attachment_path]; } catch (e) { existingPaths = [existing.attachment_path]; }
                } else if (Array.isArray(existing.attachment_path)) {
                    existingPaths = existing.attachment_path;
                }
            }
        } catch (e) { existingPaths = []; }

        if (files.length > 0) {
            const newPaths = files.map(f => f.path.replace(/\\/g, '/'));
            const merged = existingPaths.concat(newPaths);
            newAttachmentValue = JSON.stringify(merged);
            // We'll finalize attachment_path after considering deletions below
            // temporarily store merged value to use if no deletions
            // but do not push to fields yet
        }

        // If client asked to delete specific existing attachment file paths, remove them from attachment_path
        if (deletedFiles && deletedFiles.length > 0) {
            // compute merged of existing + new (if any)
            let mergedPaths = existingPaths.slice();
            if (files.length > 0) {
                const newPaths = files.map(f => f.path.replace(/\\/g, '/'));
                mergedPaths = mergedPaths.concat(newPaths);
            }
            const remaining = mergedPaths.filter(p => !deletedFiles.includes(p));
            const dbValue = remaining.length > 0 ? JSON.stringify(remaining) : null;
            fields.push(`attachment_path = $${idx++}`); params.push(dbValue);

            // Archive metadata rows for deleted files into `deleted_room_booking_attachments`, then remove
            try {
                // Ensure archive table exists (safe to call repeatedly)
                await pool.query(`CREATE TABLE IF NOT EXISTS deleted_room_booking_attachments (
                    id SERIAL PRIMARY KEY,
                    booking_id INTEGER,
                    user_id INTEGER,
                    file_path TEXT,
                    file_name TEXT,
                    file_size BIGINT,
                    file_ext TEXT,
                    deleted_by INTEGER,
                    deleted_at TIMESTAMPTZ DEFAULT NOW()
                )`);

                // Insert into deleted table from existing attachments selected
                const deleterId = req.user?.id || null;
                await pool.query(`INSERT INTO deleted_room_booking_attachments (booking_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at)
                                  SELECT booking_id, user_id, file_path, file_name, file_size, file_ext, $1, NOW()
                                  FROM room_booking_attachments WHERE booking_id = $2 AND file_path = ANY($3)
                `, [deleterId, id, deletedFiles]);

                await pool.query('DELETE FROM room_booking_attachments WHERE booking_id = $1 AND file_path = ANY($2)', [id, deletedFiles]);
            } catch (e) {
                console.error('Failed to archive/delete attachment metadata:', e);
            }
        } else if (newAttachmentValue !== undefined) {
            // No deletions, but new files were uploaded: set attachment_path to merged value
            fields.push(`attachment_path = $${idx++}`); params.push(newAttachmentValue);
        }

        if (fields.length === 0) return res.status(400).json({ message: 'Không có trường để cập nhật.' });

        params.push(id);
        updateQuery = `UPDATE room_bookings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
        updateParams = params.slice();
        const { rows } = await pool.query(updateQuery, updateParams);
        const updated = rows[0];
        // persist attachments metadata for new files
        if (files.length > 0) {
            const userId = req.user?.id || null;

            // read relative paths if provided
            let rels = req.body['attachments_relative_paths[]'] || req.body.attachments_relative_paths || req.body.attachments_relative_path || null;
            if (rels && !Array.isArray(rels)) rels = [rels];

            const attachCols = await getTableColumns('room_booking_attachments');
            const hasRelative = attachCols.includes('relative_path');
            const baseCols = ['booking_id', 'user_id', 'file_path', 'file_name', 'file_size', 'file_ext'];
            if (hasRelative) baseCols.push('relative_path');
            const placeholders = baseCols.map((_,i)=>`$${i+1}`).join(',');
            const insertAttach = `INSERT INTO room_booking_attachments (${baseCols.join(',')}) VALUES (${placeholders})`;

            for (let i = 0; i < files.length; i++) {
                const f = files[i];
                const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                const ext = (originalName.split('.').pop() || '').toLowerCase();
                const filePath = f.path.replace(/\\/g, '/');
                const values = [updated.id, userId, filePath, originalName, Number(f.size || 0), ext];
                if (hasRelative) values.push((Array.isArray(rels) && rels[i]) ? rels[i] : null);
                await pool.query(insertAttach, values);
            }
            // Asynchronously generate PDF previews for uploaded DOCX files
            try {
                for (const f of files) {
                    const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                    const ext = (originalName.split('.').pop() || '').toLowerCase();
                    if (ext === 'docx') {
                        const fp = path.join(process.cwd(), f.path.replace(/\\/g, '/'));
                        convertDocxToPdf(fp).then(p => {
                            if (p) console.log('Generated PDF preview (update):', p);
                        }).catch(e => console.warn('Background convert error (update):', e && e.message ? e.message : e));
                    }
                }
            } catch (e) {
                console.warn('Background PDF conversion queue failed (update):', e && e.message ? e.message : e);
            }
        }
        // Audit: record structured changes (old -> new)
        try {
            const changes = {};
            const keys = ['room_name','title','description','start_time','end_time','department_id','attendees_count','other_invited_count','has_led','leader_in_charge','attachment_path'];
            for (const k of keys) {
                const oldVal = existing[k] === null || existing[k] === undefined ? null : existing[k];
                const newVal = updated[k] === null || updated[k] === undefined ? null : updated[k];
                if (String(oldVal) !== String(newVal)) {
                    changes[k] = { old: oldVal, new: newVal };
                }
            }
            const actor = req.user || {};
            if (Object.keys(changes).length > 0) {
                const detailParts = Object.keys(changes).map(k => `"${k}" từ ${changes[k].old} thành ${changes[k].new}`);
                await logActivity(pool, {
                    userId: actor.id,
                    module: 'Đặt phòng',
                    action: 'Cập nhật',
                    details: `${actor.fullName || actor.username || 'Người dùng'} đã cập nhật: ${detailParts.join('; ')}`,
                    url: `/room-bookings/${id}`,
                    method: 'PUT',
                    change: changes
                });
            }
        } catch (e) {
            console.warn('Failed to log booking update audit (ignored):', e && e.message ? e.message : e);
        }

        res.json(updated);
    } catch (error) {
        try { console.error('Failed SQL for updateBooking:', updateQuery, updateParams); } catch(e){}
        console.error('Lỗi khi cập nhật booking:', error && (error.stack || error));
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy danh sách các tệp đã bị xóa (archived)
exports.getDeletedAttachments = async (req, res) => {
    try {
        // ensure archive table exists
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_room_booking_attachments (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER,
            user_id INTEGER,
            file_path TEXT,
            file_name TEXT,
            file_size BIGINT,
            file_ext TEXT,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW()
        )`);

        // optional: accept pagination params
        const limit = Number(req.query.limit) || 200;
        // return deleted rows along with the actor's display name when available
        const { rows } = await pool.query(`
            SELECT dra.*, u.full_name as deleted_by_name
            FROM deleted_room_booking_attachments dra
            LEFT JOIN users u ON dra.deleted_by = u.id
            ORDER BY dra.deleted_at DESC LIMIT $1
        `, [limit]);
        res.json(rows);
    } catch (e) {
        console.error('Failed to list deleted attachments:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Khôi phục tệp đã xóa theo id của bản ghi trong bảng archived
exports.restoreDeletedAttachment = async (req, res) => {
    const { id } = req.params; // id in deleted_room_booking_attachments
    try {
        // ensure archive table exists
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_room_booking_attachments (
            id SERIAL PRIMARY KEY,
            booking_id INTEGER,
            user_id INTEGER,
            file_path TEXT,
            file_name TEXT,
            file_size BIGINT,
            file_ext TEXT,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW()
        )`);

        const { rows } = await pool.query('SELECT * FROM deleted_room_booking_attachments WHERE id = $1', [id]);
        if (rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy tệp đã xóa.' });
        const rec = rows[0];

        // permission: only admins or room_booking_management can restore
        const user = req.user || {};
        const hasManage = Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access'));
        if (!hasManage) return res.status(403).json({ message: 'Bạn không có quyền khôi phục tệp.' });

        // Re-insert metadata into room_booking_attachments
        await pool.query('INSERT INTO room_booking_attachments (booking_id, user_id, file_path, file_name, file_size, file_ext) VALUES ($1,$2,$3,$4,$5,$6)', [rec.booking_id, rec.user_id, rec.file_path, rec.file_name, rec.file_size, rec.file_ext]);

        // Update room_bookings.attachment_path to include the file_path again
        const { rows: bRows } = await pool.query('SELECT attachment_path FROM room_bookings WHERE id = $1', [rec.booking_id]);
        if (bRows.length > 0) {
            let paths = [];
            try {
                const ap = bRows[0].attachment_path;
                if (ap) {
                    if (typeof ap === 'string') {
                        const parsed = JSON.parse(ap);
                        paths = Array.isArray(parsed) ? parsed : [parsed];
                    } else if (Array.isArray(ap)) paths = ap;
                }
            } catch (e) { paths = []; }
            if (!paths.includes(rec.file_path)) paths.push(rec.file_path);
            const val = paths.length > 0 ? JSON.stringify(paths) : null;
            await pool.query('UPDATE room_bookings SET attachment_path = $1 WHERE id = $2', [val, rec.booking_id]);
        }

        // Remove from archived table
        await pool.query('DELETE FROM deleted_room_booking_attachments WHERE id = $1', [id]);

        res.json({ message: 'Khôi phục thành công.' });
    } catch (e) {
        console.error('Failed to restore deleted attachment:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Xóa booking
exports.deleteBooking = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: existingRows } = await pool.query('SELECT * FROM room_bookings WHERE id = $1', [id]);
        if (existingRows.length === 0) return res.status(404).json({ message: 'Không tìm thấy lịch.' });
        const existing = existingRows[0];
        const user = req.user || {};
        const hasManage = Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access'));
        if (existing.booker_id !== user.id && !hasManage) {
            return res.status(403).json({ message: 'Bạn không có quyền xóa lịch này.' });
        }
        // Audit the deletion with the full existing row when possible
        try {
            await logActivity(pool, {
                userId: user.id || null,
                module: 'Đặt phòng',
                action: 'Xóa',
                details: `${user.fullName || user.username || 'Người dùng'} đã xóa lịch #${id}`,
                url: `/room-bookings/${id}`,
                method: 'DELETE',
                change: existing
            });
        } catch (e) {
            console.warn('Failed to write booking deletion audit (ignored):', e && e.message ? e.message : e);
        }

        await pool.query('DELETE FROM room_bookings WHERE id = $1', [id]);
        res.json({ message: 'Xóa lịch thành công.' });
    } catch (error) {
        console.error('Lỗi khi xóa booking:', error);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Lấy danh sách booking đã bị xóa dựa trên audit logs (best-effort)
exports.getDeletedBookings = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 200;
        // find audit entries for module Đặt phòng and action Xóa
        const q = `SELECT id, user_id, username, module, action, details, created_at, change_payload_json FROM audit_logs WHERE module = $1 AND action = $2 ORDER BY created_at DESC LIMIT $3`;
        const { rows } = await pool.query(q, ['Đặt phòng', 'Xóa', limit]);
        // parse change_payload_json when present
        const parsed = rows.map(r => {
            let payload = null;
            try { payload = r.change_payload_json ? JSON.parse(r.change_payload_json) : null; } catch (e) { payload = null; }
            return {
                audit_id: r.id,
                deleted_at: r.created_at,
                deleted_by: r.username || r.user_id,
                details: r.details,
                snapshot: payload
            };
        });
        res.json(parsed);
    } catch (e) {
        console.error('Failed to list deleted bookings from audit logs:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Khôi phục booking đã xóa bằng cách lấy snapshot từ audit_logs.change_payload_json
exports.restoreDeletedBooking = async (req, res) => {
    const { id } = req.params; // audit log id
    try {
        const { rows } = await pool.query('SELECT * FROM audit_logs WHERE id = $1', [id]);
        if (!rows || rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy bản ghi đã xóa.' });
        const rec = rows[0];
        let snapshot = null;
        try { snapshot = rec.change_payload_json ? JSON.parse(rec.change_payload_json) : null; } catch (e) { snapshot = null; }
        if (!snapshot) return res.status(400).json({ message: 'Không có dữ liệu để khôi phục.' });

        // permission check
        const user = req.user || {};
        const hasManage = Array.isArray(user.permissions) && (user.permissions.includes('room_booking_management') || user.permissions.includes('full_access'));
        if (!hasManage) return res.status(403).json({ message: 'Bạn không có quyền khôi phục.' });

        // Build INSERT using only columns available in room_bookings
        const colsInDb = await getTableColumns('room_bookings');
        const allowed = Object.keys(snapshot).filter(k => k !== 'id' && colsInDb.includes(k));
        if (allowed.length === 0) return res.status(400).json({ message: 'Không có trường phù hợp để khôi phục.' });
        const cols = [];
        const vals = [];
        const placeholders = [];
        let pi = 1;
        for (const c of allowed) {
            cols.push(c);
            vals.push(snapshot[c]);
            placeholders.push(`$${pi++}`);
        }
        const insertQ = `INSERT INTO room_bookings (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
        const ins = await pool.query(insertQ, vals);
        const created = ins.rows[0];

        // write audit entry for restore
        try { await logActivity(pool, { userId: user.id || null, module: 'Đặt phòng', action: 'Khôi phục', details: `Khôi phục lịch từ audit #${id}`, change: { restored_from_audit_id: id, restored_snapshot: snapshot } }); } catch(e){}

        res.json(created);
    } catch (e) {
        console.error('Failed to restore deleted booking:', e);
        res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
    }
};

// Preview an attachment (docx -> HTML conversion, pdf/images will be proxied/streamed by frontend)
exports.previewAttachment = async (req, res) => {
    try {
        const rawPath = req.query.path || req.body.path;
        if (!rawPath) return res.status(400).json({ message: 'Missing path' });
        // Prevent path traversal: only allow files under uploads/
        const normalized = path.normalize(rawPath).replace(/\\/g, '/');
        if (!normalized.startsWith('uploads/')) return res.status(400).json({ message: 'Invalid path' });
        const filePath = path.join(process.cwd(), normalized);
        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' });
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        if (ext === 'docx') {
            // If a dev converter service is configured (Docker-based), proxy to it first
            const converterUrl = process.env.DOCX_CONVERTER_URL || process.env.DOCX_CONVERTER_SERVICE;
            if (converterUrl) {
                try {
                    const convResp = await fetch(converterUrl + '/convert', {
                        method: 'POST',
                        body: JSON.stringify({ path: normalized }),
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 120000,
                    });
                    if (convResp.ok) {
                        // If converter returns a PDF, stream it back
                        const contentType = convResp.headers.get('content-type') || '';
                        if (contentType.includes('pdf')) {
                            res.set('Content-Type', 'application/pdf');
                            res.set('Content-Disposition', convResp.headers.get('content-disposition') || `inline; filename="${path.basename(normalized)}.pdf"`);
                            try { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.set('X-Download-Options', 'noopen'); } catch(e) {}
                            res.set('X-Preview-Method', 'pdf-proxy');
                            const buf = await convResp.buffer();
                            return res.send(buf);
                        }
                        // otherwise fall through to local handling
                    }
                } catch (e) {
                    console.warn('Converter service proxy failed (continuing):', e && e.message ? e.message : e);
                    // continue to local conversion/fallback
                }
            }
            // Try to convert DOCX to PDF via LibreOffice (soffice) for best fidelity, fall back to mammoth HTML
            const { execFileSync } = require('child_process');
            const os = require('os');
            const outDir = os.tmpdir();
            const baseName = path.basename(filePath, path.extname(filePath));
            const uniqueOutPdf = path.join(outDir, `${baseName}-preview-${Date.now()}.pdf`);

            // Helper to detect available soffice binary
            const findSoffice = () => {
                const candidates = [];
                if (process.env.SOFFICE_PATH) candidates.push(process.env.SOFFICE_PATH);
                if (process.env.LIBREOFFICE_PATH) candidates.push(process.env.LIBREOFFICE_PATH);
                // common names
                candidates.push('soffice', 'soffice.bin', 'libreoffice');
                for (const cmd of candidates) {
                    try {
                        execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 5000 });
                        return cmd;
                    } catch (e) {
                        // continue
                    }
                }
                return null;
            };

            const sofficeCmd = findSoffice();
            let convertedToPdf = false;
            try {
                if (sofficeCmd) {
                    const before = Date.now();
                    // run conversion
                    execFileSync(sofficeCmd, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, filePath], { stdio: 'ignore', timeout: 60_000 });
                    // search tmp dir for generated pdf matching baseName and recent timestamp
                    const files = fs.readdirSync(outDir);
                    const matches = files.filter(f => f.toLowerCase().endsWith('.pdf') && f.indexOf(baseName) === 0)
                                         .map(f => ({ f, stat: fs.statSync(path.join(outDir, f)) }))
                                         .filter(o => (o.stat.mtimeMs || 0) >= before - 1000);
                    if (matches.length > 0) {
                        // pick newest
                        matches.sort((a,b) => (b.stat.mtimeMs || 0) - (a.stat.mtimeMs || 0));
                        const candidate = path.join(outDir, matches[0].f);
                        try { fs.copyFileSync(candidate, uniqueOutPdf); } catch(e) { fs.copyFileSync(candidate, uniqueOutPdf); }
                        convertedToPdf = fs.existsSync(uniqueOutPdf);
                    }
                }
            } catch (convErr) {
                // conversion failed; continue to fallback
                convertedToPdf = false;
            }

            if (convertedToPdf && fs.existsSync(uniqueOutPdf)) {
                // Stream PDF back to client
                res.set('Content-Type', 'application/pdf');
                res.set('Content-Disposition', 'inline; filename="' + baseName + '.pdf"');
                try { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'private, max-age=0, no-cache, no-store'); res.set('X-Download-Options', 'noopen'); } catch(e) {}
                res.set('X-Preview-Method', 'pdf');
                const stream = fs.createReadStream(uniqueOutPdf);
                stream.on('end', () => {
                    try { fs.unlinkSync(uniqueOutPdf); } catch (e) {}
                });
                return stream.pipe(res);
            }

            // If soffice not available, expose header so frontend can show a helpful message if desired
            if (!sofficeCmd) res.set('X-PDF-Conversion-Available', 'false');

            // Fallback: convert to HTML and sanitize using mammoth
            const result = await mammoth.convertToHtml({ path: filePath });
            let html = result && result.value ? result.value : '<div>Không có nội dung để hiển thị.</div>';
            // wrap with minimal CSS to improve fidelity (tables, headings)
            const css = `
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111827; }
                  .mammoth table { border-collapse: collapse; width: 100%; }
                  .mammoth table, .mammoth th, .mammoth td { border: 1px solid #ddd; }
                  .mammoth th, .mammoth td { padding: 8px; }
                  .mammoth h1, .mammoth h2, .mammoth h3 { margin: 0.5em 0; }
                  .mammoth p { margin: 0.4em 0; }
                </style>
            `;
            // sanitize HTML to avoid script injection
            const clean = sanitizeHtml(html, {
                allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img', 'h1', 'h2', 'h3', 'table', 'thead', 'tbody', 'tr', 'th', 'td' ]),
                allowedAttributes: {
                    '*': ['style', 'class', 'src', 'alt', 'title']
                }
            });
            const wrapped = `<!doctype html><html><head><meta charset="utf-8">${css}</head><body class="mammoth">${clean}</body></html>`;
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('X-Preview-Method', 'html');
            return res.send(wrapped);
        }
        return res.status(400).json({ message: 'Unsupported preview type' });
    } catch (e) {
        console.error('Preview error', e);
        res.status(500).json({ message: 'Lỗi khi tạo xem trước' });
    }
};
