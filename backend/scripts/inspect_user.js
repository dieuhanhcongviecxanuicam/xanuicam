const pool = require('../src/db');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const res = await client.query("SELECT id, username, cccd, password_hash, is_active, role_id FROM users WHERE username = $1", ['export_tester']);
      console.log('RESULTS:', res.rows);
    } finally { client.release(); }
  } catch (e) { console.error('Error', e); process.exitCode=1; }
  finally { try { await pool.end(); } catch(_){} }
})();
