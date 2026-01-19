const pool = require('../backend/src/db');
(async ()=>{
  try{
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='room_bookings' ORDER BY ordinal_position");
    console.log(res.rows.map(r=>r.column_name));
    process.exit(0);
  }catch(e){
    console.error(e);
    process.exit(1);
  }
})();
