const pool = require('../backend/src/db');
(async()=>{
  try{
    const id = process.env.E2E_USER || '000000000001';
    const res = await pool.query("SELECT id, username, cccd, password_hash, full_name FROM users WHERE username = $1 OR cccd = $1", [id]);
    if (res.rows.length === 0) return console.log('No user found for', id);
    console.log('Found user:');
    console.log(res.rows[0]);
  }catch(e){
    console.error('Error querying users:', e && e.message ? e.message : e);
  }finally{ try{ await pool.end(); } catch(e){} }
})();
