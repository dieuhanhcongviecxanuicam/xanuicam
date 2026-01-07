const pool = require('../db');

// Return combined pending approvals from meetings and room_bookings
exports.getApprovals = async (req, res) => {
  try {
    // Pending meetings
    const meetingsQuery = `
      SELECT m.id, 'meeting' AS type, m.title, m.room, m.start_time, m.end_time, m.status,
             u.full_name AS requester_name, m.organizer_id AS requester_id
      FROM meetings m
      JOIN users u ON m.organizer_id = u.id
      WHERE m.status = $1
    `;
    const { rows: meetings } = await pool.query(meetingsQuery, ['Chờ phê duyệt']);

    // Pending room bookings
    const bookingsQuery = `
      SELECT rb.id, 'room_booking' AS type, rb.title, rb.room_name AS room, rb.start_time, rb.end_time, rb.status,
             u.full_name AS requester_name, rb.booker_id AS requester_id
      FROM room_bookings rb
      JOIN users u ON rb.booker_id = u.id
      WHERE rb.status = $1
    `;
    const { rows: bookings } = await pool.query(bookingsQuery, ['Chờ phê duyệt']);

    // Normalize and combine
    const normalizedMeetings = meetings.map(m => ({
      id: `meeting-${m.id}`,
      type: m.type,
      orig_id: m.id,
      title: m.title,
      room: m.room,
      start_time: m.start_time,
      end_time: m.end_time,
      status: m.status,
      requester_name: m.requester_name,
      requester_id: m.requester_id,
    }));

    const normalizedBookings = bookings.map(b => ({
      id: `booking-${b.id}`,
      type: b.type,
      orig_id: b.id,
      title: b.title,
      room: b.room,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
      requester_name: b.requester_name,
      requester_id: b.requester_id,
    }));

    const combined = [...normalizedMeetings, ...normalizedBookings];
    // Sort by start_time
    combined.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    res.json(combined);
  } catch (error) {
    console.error('Lỗi khi lấy danh sách phê duyệt:', error);
    res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
  }
};
