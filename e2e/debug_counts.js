const pool = require('../backend/src/db');
(async ()=>{
  try{
    const a = await pool.query('SELECT COUNT(*) AS cnt FROM room_bookings');
    const b = await pool.query('SELECT COUNT(*) AS cnt FROM room_booking_attachments');
    console.log('room_bookings count=', a.rows[0].cnt);
    console.log('room_booking_attachments count=', b.rows[0].cnt);
    const last = await pool.query('SELECT id, title, start_time, end_time, created_at FROM room_bookings ORDER BY id DESC LIMIT 5');
    console.log('last bookings rows:', last.rows.length);
    process.exit(0);
  }catch(e){
    console.error('Error querying counts', e && e.message);
    process.exit(2);
  }
})();
