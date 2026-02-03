const pool = require('../backend/src/db');

(async function(){
  try {
    const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position");
    console.log('users table columns:');
    res.rows.forEach(r => console.log('-', r.column_name, r.data_type));
  } catch (e) {
    console.error('Error inspecting users columns:', e && e.message ? e.message : e);
  } finally {
    try { await pool.end(); } catch(e){}
  }
})();
