// ubndxanuicam/backend/src/controllers/meetingController.js
const pool = require('../db');

// Hàm helper để tạo thông báo mới
const createNotification = async (client, userId, message, link) => {
    if (!userId) return;
    try {
        await client.query(
            'INSERT INTO notifications (user_id, message, link) VALUES ($1, $2, $3)',
            [userId, message, link]
        );
    } catch (error) {
        console.error("Lỗi khi tạo thông báo cuộc họp:", error);
    }
};

exports.getMeetings = async (req, res) => {
    const { start, end, status, organizerId } = req.query;

    // Build dynamic, safe query
    let query = `
        SELECT m.id, m.title, m.room, m.start_time, m.end_time, m.status, u.full_name as organizer_name, m.organizer_id,
               (
                   SELECT COALESCE(json_agg(u_p.full_name), '[]'::json)
                   FROM unnest(m.participants) AS pid(participant_id)
                   JOIN users u_p ON u_p.id = pid.participant_id
               ) as participants_names
        FROM meetings m
        JOIN users u ON m.organizer_id = u.id
    `;
    const params = [];
    let paramIndex = 1;
    const whereClauses = [];

    if (start && end) {
        whereClauses.push(`(m.start_time, m.end_time) OVERLAPS ($${paramIndex++}, $${paramIndex++})`);
        params.push(start, end);
    }
    if (status) {
        whereClauses.push(`m.status = $${paramIndex++}`);
        params.push(status);
    }
    if (organizerId) {
        whereClauses.push(`m.organizer_id = $${paramIndex++}`);
        params.push(parseInt(organizerId, 10));
    }

    if (whereClauses.length > 0) query += ` WHERE ${whereClauses.join(' AND ')}`;
    query += ` ORDER BY m.start_time;`;

    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error("Lỗi khi tải lịch họp:", error.message || error);
        console.error(error.stack || error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    }
};

exports.createMeeting = async (req, res) => {
    const { title, description, room, startTime, endTime, participants } = req.body;
    const { id: organizerId, fullName: organizerName } = req.user;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const query = `
            INSERT INTO meetings (title, description, room, start_time, end_time, organizer_id, participants, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'Chờ phê duyệt') RETURNING *;
        `;
        const { rows } = await client.query(query, [title, description || null, room, startTime, endTime, organizerId, participants || []]);
        
        if (participants && participants.length > 0) {
            const message = `${organizerName} đã mời bạn tham gia cuộc họp: "${title}"`;
            for (const participantId of participants) {
                await createNotification(client, participantId, message, '/meetings');
            }
        }
        
        await client.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi tạo cuộc họp:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    } finally {
        client.release();
    }
};

exports.updateMeetingStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const { id: adminId, fullName: adminName } = req.user;
    
    if (!['Đã duyệt', 'Từ chối'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const updateQuery = 'UPDATE meetings SET status = $1 WHERE id = $2 RETURNING *';
        const { rows } = await client.query(updateQuery, [status, id]);

        if (rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Không tìm thấy cuộc họp.' });
        }
        
        const meeting = rows[0];
        const message = `Cuộc họp "${meeting.title}" của bạn đã được ${adminName} ${status.toLowerCase()}.`;
        
        // Gửi thông báo cho người tổ chức
        await createNotification(client, meeting.organizer_id, message, '/meetings');
        
        // Nếu duyệt, gửi thông báo cho tất cả người tham gia
        if (status === 'Đã duyệt' && meeting.participants && meeting.participants.length > 0) {
            const approvedMessage = `Cuộc họp "${meeting.title}" đã được phê duyệt và sẽ diễn ra theo lịch.`;
            for (const participantId of meeting.participants) {
                // Tránh gửi thông báo lặp lại cho người tổ chức
                if (participantId !== meeting.organizer_id) {
                    await createNotification(client, participantId, approvedMessage, '/meetings');
                }
            }
        }

        await client.query('COMMIT');
        res.json(meeting);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Lỗi khi cập nhật trạng thái cuộc họp:", error);
        res.status(500).json({ message: "Lỗi máy chủ nội bộ" });
    } finally {
        client.release();
    }
};