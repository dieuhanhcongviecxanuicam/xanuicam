// ubndxanuicam/backend/src/controllers/calendarController.js
const pool = require('../db');

// Lấy tất cả sự kiện trong một khoảng thời gian
exports.getEvents = async (req, res) => {
    const { start, end } = req.query; // start và end là chuỗi ISO date
    try {
        const query = `
            SELECT id, title, start_time, end_time, description, location, user_id, attachment_path
            FROM calendar_events
            WHERE start_time >= $1 AND start_time <= $2
            ORDER BY start_time;
        `;
        const { rows } = await pool.query(query, [start, end]);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải sự kiện lịch:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Tạo sự kiện mới (hỗ trợ nhiều tệp đính kèm)
exports.createEvent = async (req, res) => {
    const { title, start_time, end_time, description, location } = req.body;
    const { id: userId } = req.user;
    // normalize files: multer.fields returns an object with arrays
    let files = [];
    if (Array.isArray(req.files)) files = req.files;
    else if (req.files && typeof req.files === 'object') {
        if (Array.isArray(req.files.attachments)) files = files.concat(req.files.attachments);
        if (Array.isArray(req.files.attachment)) files = files.concat(req.files.attachment);
    } else if (req.file) files = [req.file];
    const attachmentPaths = files.map(f => f.path.replace(/\\/g, '/'));
    // Enforce per-day upload quotas (PDF <= 10MB/day, DOCX <= 5MB/day)
    try {
        // ensure attachments metadata table exists
        await pool.query(`CREATE TABLE IF NOT EXISTS calendar_event_attachments (
            id SERIAL PRIMARY KEY,
            event_id INTEGER,
            user_id INTEGER,
            file_path TEXT,
            file_name TEXT,
            file_size BIGINT,
            file_ext TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )`);

        const pdfLimit = 10 * 1024 * 1024;
        const docxLimit = 5 * 1024 * 1024;
        let newPdfTotal = 0, newDocxTotal = 0;
        for (const f of files) {
            const name = f.originalname || f.filename || '';
            const ext = (name.split('.').pop() || '').toLowerCase();
            const size = Number(f.size || 0);
            if (ext === 'pdf') newPdfTotal += size;
            if (ext === 'docx') newDocxTotal += size;
        }
        if (newPdfTotal > 0 || newDocxTotal > 0) {
            const pdfRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM calendar_event_attachments WHERE user_id = $1 AND file_ext = 'pdf' AND created_at::date = CURRENT_DATE", [userId]);
            const docxRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM calendar_event_attachments WHERE user_id = $1 AND file_ext = 'docx' AND created_at::date = CURRENT_DATE", [userId]);
            const existingPdf = Number(pdfRes.rows[0].total || 0);
            const existingDocx = Number(docxRes.rows[0].total || 0);
            if (existingPdf + newPdfTotal > pdfLimit) return res.status(400).json({ message: 'Hạn mức tải lên PDF trong ngày đã vượt quá 10MB.' });
            if (existingDocx + newDocxTotal > docxLimit) return res.status(400).json({ message: 'Hạn mức tải lên DOCX trong ngày đã vượt quá 5MB.' });
        }
    } catch (chkErr) {
        console.error('Error checking upload quotas:', chkErr);
        return res.status(500).json({ message: 'Lỗi khi kiểm tra hạn mức tải lên.' });
    }
    try {
        const query = `
            INSERT INTO calendar_events (title, start_time, end_time, description, location, user_id, attachment_path)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        const params = [title, start_time, end_time, description, location, userId, attachmentPaths.length > 0 ? JSON.stringify(attachmentPaths) : null];
        const { rows } = await pool.query(query, params);
        const created = rows[0];
        // persist attachments metadata
        if (files.length > 0) {
            const insertSql = `INSERT INTO calendar_event_attachments (event_id, user_id, file_path, file_name, file_size, file_ext) VALUES ($1,$2,$3,$4,$5,$6)`;
            for (const f of files) {
                const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                const filePath = f.path.replace(/\\/g, '/');
                const ext = (originalName.split('.').pop() || '').toLowerCase();
                await pool.query(insertSql, [created.id, userId, filePath, originalName, Number(f.size || 0), ext]);
            }
        }
        res.status(201).json(created);
    } catch (error) {
        console.error("Lỗi khi tạo sự kiện:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Cập nhật sự kiện
exports.updateEvent = async (req, res) => {
    const { id } = req.params;
    const { title, start_time, end_time, description, location } = req.body || {};
    // normalize deleted_files which may arrive as JSON string or array
    let deleted_files = req.body && req.body.deleted_files;
    if (typeof deleted_files === 'string') {
        try { deleted_files = JSON.parse(deleted_files); } catch (e) { deleted_files = [deleted_files]; }
    }
    if (!Array.isArray(deleted_files)) deleted_files = deleted_files ? [deleted_files] : [];
    // normalize files: multer.fields returns an object with arrays
    let files = [];
    if (Array.isArray(req.files)) files = req.files;
    else if (req.files && typeof req.files === 'object') {
        if (Array.isArray(req.files.attachments)) files = files.concat(req.files.attachments);
        if (Array.isArray(req.files.attachment)) files = files.concat(req.files.attachment);
    } else if (req.file) files = [req.file];
    const newAttachmentPaths = files.map(f => f.path.replace(/\\/g, '/'));
    try {
        const fields = [];
        const params = [];
        let idx = 1;
        if (title !== undefined) { fields.push(`title = $${idx++}`); params.push(title); }
        if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); params.push(start_time); }
        if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); params.push(end_time); }
        if (description !== undefined) { fields.push(`description = $${idx++}`); params.push(description); }
        if (location !== undefined) { fields.push(`location = $${idx++}`); params.push(location); }
        if (newAttachmentPaths.length > 0) { fields.push(`attachment_path = $${idx++}`); params.push(JSON.stringify(newAttachmentPaths)); }

        let updated;
        if (fields.length === 0) {
            // No other fields to update; if deleted_files present we'll handle deletions below.
            const sel = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
            if (sel.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy sự kiện." });
            updated = sel.rows[0];
        } else {
            params.push(id);
            const query = `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
            const { rows } = await pool.query(query, params);
            if (rows.length === 0) return res.status(404).json({ message: "Không tìm thấy sự kiện." });
            updated = rows[0];
        }

        // Merge new attachments into existing attachment_path
        if (newAttachmentPaths.length > 0) {
            try {
                let existingPaths = [];
                if (updated.attachment_path) {
                    if (typeof updated.attachment_path === 'string') {
                        try { existingPaths = JSON.parse(updated.attachment_path); if (!Array.isArray(existingPaths)) existingPaths = [updated.attachment_path]; } catch (e) { existingPaths = [updated.attachment_path]; }
                    } else if (Array.isArray(updated.attachment_path)) existingPaths = updated.attachment_path;
                }
                const merged = existingPaths.concat(newAttachmentPaths);
                const mergeQuery = 'UPDATE calendar_events SET attachment_path = $1 WHERE id = $2 RETURNING *';
                const mergeRes = await pool.query(mergeQuery, [JSON.stringify(merged), id]);
                if (mergeRes.rows.length > 0) updated.attachment_path = mergeRes.rows[0].attachment_path;
            } catch (e) {
                console.warn('Failed to merge new attachments for event:', e && e.message ? e.message : e);
            }
        }

            // If new files were uploaded, enforce per-day quotas and persist metadata
            if (files.length > 0) {
                try {
                    await pool.query(`CREATE TABLE IF NOT EXISTS calendar_event_attachments (
                        id SERIAL PRIMARY KEY,
                        event_id INTEGER,
                        user_id INTEGER,
                        file_path TEXT,
                        file_name TEXT,
                        file_size BIGINT,
                        file_ext TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )`);

                    const pdfLimit = 10 * 1024 * 1024;
                    const docxLimit = 5 * 1024 * 1024;
                    let newPdfTotal = 0, newDocxTotal = 0;
                    for (const f of files) {
                        const name = f.originalname || f.filename || '';
                        const ext = (name.split('.').pop() || '').toLowerCase();
                        const size = Number(f.size || 0);
                        if (ext === 'pdf') newPdfTotal += size;
                        if (ext === 'docx') newDocxTotal += size;
                    }
                    if (newPdfTotal > 0 || newDocxTotal > 0) {
                        const pdfRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM calendar_event_attachments WHERE user_id = $1 AND file_ext = 'pdf' AND created_at::date = CURRENT_DATE", [req.user.id]);
                        const docxRes = await pool.query("SELECT COALESCE(SUM(file_size),0) AS total FROM calendar_event_attachments WHERE user_id = $1 AND file_ext = 'docx' AND created_at::date = CURRENT_DATE", [req.user.id]);
                        const existingPdf = Number(pdfRes.rows[0].total || 0);
                        const existingDocx = Number(docxRes.rows[0].total || 0);
                        if (existingPdf + newPdfTotal > pdfLimit) return res.status(400).json({ message: 'Hạn mức tải lên PDF trong ngày đã vượt quá 10MB.' });
                        if (existingDocx + newDocxTotal > docxLimit) return res.status(400).json({ message: 'Hạn mức tải lên DOCX trong ngày đã vượt quá 5MB.' });
                    }

                    const insertSql = `INSERT INTO calendar_event_attachments (event_id, user_id, file_path, file_name, file_size, file_ext) VALUES ($1,$2,$3,$4,$5,$6)`;
                    for (const f of files) {
                        const originalName = Buffer.from(f.originalname || '', 'latin1').toString('utf8');
                        const filePath = f.path.replace(/\\/g, '/');
                        const ext = (originalName.split('.').pop() || '').toLowerCase();
                        await pool.query(insertSql, [id, req.user?.id || null, filePath, originalName, Number(f.size || 0), ext]);
                    }
                } catch (e) {
                    console.warn('Failed to persist calendar attachments metadata:', e && e.message ? e.message : e);
                }
            }

        // Handle deleted_files if provided by client (array or JSON string)
        try {
            let delFiles = [];
            if (deleted_files) {
                if (typeof deleted_files === 'string') {
                    try { delFiles = JSON.parse(deleted_files); } catch (e) { delFiles = [deleted_files]; }
                } else if (Array.isArray(deleted_files)) delFiles = deleted_files;
            }
            if (delFiles.length > 0) {
                // normalize existing attachment paths
                let existingPaths = [];
                if (updated.attachment_path) {
                    if (typeof updated.attachment_path === 'string') {
                        try { existingPaths = JSON.parse(updated.attachment_path); if (!Array.isArray(existingPaths)) existingPaths = [updated.attachment_path]; } catch (e) { existingPaths = [updated.attachment_path]; }
                    } else if (Array.isArray(updated.attachment_path)) existingPaths = updated.attachment_path;
                }
                const remaining = existingPaths.filter(p => !delFiles.includes(p));
                await pool.query('UPDATE calendar_events SET attachment_path = $1 WHERE id = $2', [remaining.length > 0 ? JSON.stringify(remaining) : null, id]);

                // Ensure archive table exists
                await pool.query(`CREATE TABLE IF NOT EXISTS deleted_calendar_attachments (
                    id SERIAL PRIMARY KEY,
                    event_id INTEGER,
                    user_id INTEGER,
                    file_path TEXT,
                    file_name TEXT,
                    file_size BIGINT,
                    file_ext TEXT,
                    deleted_by INTEGER,
                    deleted_at TIMESTAMPTZ DEFAULT NOW()
                )`);

                const deleterId = req.user?.id || null;
                for (const fp of delFiles) {
                    const fileName = fp.split('/').pop();
                    const ext = (fileName.split('.').pop() || '').toLowerCase();
                    // try to find metadata row to move
                    try {
                        const metaRes = await pool.query('SELECT * FROM calendar_event_attachments WHERE event_id = $1 AND file_path = $2 LIMIT 1', [id, fp]);
                        if (metaRes.rows.length > 0) {
                            const m = metaRes.rows[0];
                            await pool.query(`INSERT INTO deleted_calendar_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at)
                                VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, [m.event_id, m.user_id, m.file_path, m.file_name, m.file_size, m.file_ext, deleterId]);
                            await pool.query('DELETE FROM calendar_event_attachments WHERE id = $1', [m.id]);
                        } else {
                            // insert archive record with minimal info
                            await pool.query(`INSERT INTO deleted_calendar_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at)
                                VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, [id, req.user?.id || null, fp, fileName, null, ext, deleterId]);
                        }
                    } catch (metaErr) {
                        console.warn('Failed to archive attachment metadata:', metaErr && metaErr.message ? metaErr.message : metaErr);
                        await pool.query(`INSERT INTO deleted_calendar_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at)
                            VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, [id, req.user?.id || null, fp, fileName, null, ext, deleterId]);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to archive deleted attachments for event:', e && e.message ? e.message : e);
        }

        res.json(updated);
    } catch (error) {
        console.error("Lỗi khi cập nhật sự kiện:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// Xóa sự kiện
exports.deleteEvent = async (req, res) => {
    const { id } = req.params;
    try {
        // Find the event
        const sel = await pool.query('SELECT * FROM calendar_events WHERE id = $1', [id]);
        if (sel.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy sự kiện." });
        const ev = sel.rows[0];

        // Ensure deleted events table exists
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_calendar_events (
            id SERIAL PRIMARY KEY,
            original_event_id INTEGER,
            title TEXT,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            description TEXT,
            location TEXT,
            user_id INTEGER,
            attachment_path JSONB,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW()
        )`);

        const deleterId = req.user?.id || null;
        await pool.query(`INSERT INTO deleted_calendar_events (original_event_id, title, start_time, end_time, description, location, user_id, attachment_path, deleted_by, deleted_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`, [id, ev.title, ev.start_time, ev.end_time, ev.description, ev.location, ev.user_id, ev.attachment_path, deleterId]);

        // Move related attachments into deleted_calendar_attachments if any
        try {
            await pool.query(`CREATE TABLE IF NOT EXISTS deleted_calendar_attachments (
                id SERIAL PRIMARY KEY,
                event_id INTEGER,
                user_id INTEGER,
                file_path TEXT,
                file_name TEXT,
                file_size BIGINT,
                file_ext TEXT,
                deleted_by INTEGER,
                deleted_at TIMESTAMPTZ DEFAULT NOW()
            )`);

            const metaRes = await pool.query('SELECT * FROM calendar_event_attachments WHERE event_id = $1', [id]);
            for (const m of metaRes.rows) {
                await pool.query(`INSERT INTO deleted_calendar_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`, [id, m.user_id, m.file_path, m.file_name, m.file_size, m.file_ext, deleterId]);
            }
            // remove original metadata
            await pool.query('DELETE FROM calendar_event_attachments WHERE event_id = $1', [id]);
        } catch (e) {
            console.warn('Failed to move attachments when deleting event:', e && e.message ? e.message : e);
        }

        // Finally remove the event record
        await pool.query('DELETE FROM calendar_events WHERE id = $1', [id]);
        res.json({ message: "Sự kiện đã được lưu trữ (đã xóa)." });
    } catch (error) {
        console.error("Lỗi khi xóa sự kiện:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

// List archived (deleted) events
exports.getDeletedEvents = async (req, res) => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_calendar_events (
            id SERIAL PRIMARY KEY,
            original_event_id INTEGER,
            title TEXT,
            start_time TIMESTAMPTZ,
            end_time TIMESTAMPTZ,
            description TEXT,
            location TEXT,
            user_id INTEGER,
            attachment_path JSONB,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        const { rows } = await pool.query('SELECT id, original_event_id, title, start_time, end_time, description, location, user_id, attachment_path, deleted_by, deleted_at FROM deleted_calendar_events ORDER BY deleted_at DESC');
        res.json(rows);
    } catch (e) {
        console.error('Error fetching deleted events:', e && e.message ? e.message : e);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách lịch đã xóa.' });
    }
};

// Restore an archived event
exports.restoreDeletedEvent = async (req, res) => {
    const { id } = req.params; // id of deleted_calendar_events row
    try {
        const sel = await pool.query('SELECT * FROM deleted_calendar_events WHERE id = $1', [id]);
        if (sel.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy bản ghi sự kiện đã lưu trữ.' });
        const item = sel.rows[0];

        // Re-create event (new id)
        const insertSql = `INSERT INTO calendar_events (title, start_time, end_time, description, location, user_id, attachment_path)
            VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`;
        const params = [item.title, item.start_time, item.end_time, item.description, item.location, item.user_id, item.attachment_path];
        const { rows: newRows } = await pool.query(insertSql, params);
        const newEvent = newRows[0];

        // Move archived attachments back to calendar_event_attachments and associate with new event id
        try {
            const metas = await pool.query('SELECT * FROM deleted_calendar_attachments WHERE event_id = $1', [item.original_event_id]);
            for (const m of metas.rows) {
                await pool.query(`INSERT INTO calendar_event_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, created_at)
                    VALUES ($1,$2,$3,$4,$5,$6,NOW())`, [newEvent.id, m.user_id, m.file_path, m.file_name, m.file_size, m.file_ext]);
            }
            // Remove moved archive rows
            await pool.query('DELETE FROM deleted_calendar_attachments WHERE event_id = $1', [item.original_event_id]);
        } catch (e) {
            console.warn('Failed to restore attachments for event:', e && e.message ? e.message : e);
        }

        // Remove the deleted_calendar_events row
        await pool.query('DELETE FROM deleted_calendar_events WHERE id = $1', [id]);

        res.json({ message: 'Đã khôi phục lịch.', event: newEvent });
    } catch (e) {
        console.error('Error restoring deleted event:', e && e.message ? e.message : e);
        res.status(500).json({ message: 'Lỗi khi khôi phục lịch.' });
    }
};

// List archived (deleted) attachments
exports.getDeletedAttachments = async (req, res) => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS deleted_calendar_attachments (
            id SERIAL PRIMARY KEY,
            event_id INTEGER,
            user_id INTEGER,
            file_path TEXT,
            file_name TEXT,
            file_size BIGINT,
            file_ext TEXT,
            deleted_by INTEGER,
            deleted_at TIMESTAMPTZ DEFAULT NOW()
        )`);
        const { rows } = await pool.query('SELECT id, event_id, user_id, file_path, file_name, file_size, file_ext, deleted_by, deleted_at FROM deleted_calendar_attachments ORDER BY deleted_at DESC');
        res.json(rows);
    } catch (e) {
        console.error('Error fetching deleted attachments:', e && e.message ? e.message : e);
        res.status(500).json({ message: 'Lỗi khi lấy danh sách tệp đã xóa.' });
    }
};

// Restore an archived attachment back to its event
exports.restoreDeletedAttachment = async (req, res) => {
    const { id } = req.params;
    try {
        const sel = await pool.query('SELECT * FROM deleted_calendar_attachments WHERE id = $1', [id]);
        if (sel.rows.length === 0) return res.status(404).json({ message: 'Không tìm thấy bản ghi đã lưu trữ.' });
        const item = sel.rows[0];
        // Re-insert into calendar_event_attachments
        await pool.query(`INSERT INTO calendar_event_attachments (event_id, user_id, file_path, file_name, file_size, file_ext, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,NOW())`, [item.event_id, item.user_id, item.file_path, item.file_name, item.file_size, item.file_ext]);

        // Append file_path back to event's attachment_path
        const ev = await pool.query('SELECT attachment_path FROM calendar_events WHERE id = $1', [item.event_id]);
        if (ev.rows.length > 0) {
            let paths = ev.rows[0].attachment_path || null;
            let arr = [];
            if (paths) {
                try { arr = typeof paths === 'string' ? JSON.parse(paths) : paths; } catch(e){ arr = [paths]; }
            }
            arr.push(item.file_path);
            await pool.query('UPDATE calendar_events SET attachment_path = $1 WHERE id = $2', [JSON.stringify(arr), item.event_id]);
        }

        // Remove from deleted archive
        await pool.query('DELETE FROM deleted_calendar_attachments WHERE id = $1', [id]);
        res.json({ message: 'Đã khôi phục tệp.' });
    } catch (e) {
        console.error('Error restoring archived attachment:', e && e.message ? e.message : e);
        res.status(500).json({ message: 'Lỗi khi khôi phục tệp.' });
    }
};