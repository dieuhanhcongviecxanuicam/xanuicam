const pool = require('../backend/src/db');
(async ()=>{
  try{
    await pool.query("ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS basis_super TEXT;");
    await pool.query("ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS basis_commune TEXT;");
    console.log('Migration applied');
    process.exit(0);
  }catch(e){
    console.error('Migration failed', e && (e.stack||e));
    process.exit(2);
  }
})();
