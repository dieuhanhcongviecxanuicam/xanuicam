require('dotenv').config();
const pool = require('../src/db');
(async()=>{
  try{
    await pool.query('INSERT INTO audit_logs (user_id, username, status, action, module, details) VALUES ($1,$2,$3,$4,$5,$6)', [7,'e2e_test_user','success','Login','Auth','manual test']);
    const r = await pool.query('SELECT id, username, user_id, action, module, created_at, details FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5',[7]);
    console.dir(r.rows);
  }catch(e){ console.error(e);} finally{ await pool.end(); }
})();
