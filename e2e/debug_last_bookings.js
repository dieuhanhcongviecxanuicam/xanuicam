const pool = require('../backend/src/db');
(async ()=>{
  try{
    const res = await pool.query('SELECT id, title, start_time, end_time, created_at FROM room_bookings ORDER BY id DESC LIMIT 10');
    console.log('Latest bookings:');
    res.rows.forEach(r=> console.log(r));
    process.exit(0);
  }catch(e){
    console.error('Error querying room_bookings', e && e.message);
    process.exit(2);
  }
})();
