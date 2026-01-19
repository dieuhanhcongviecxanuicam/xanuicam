const pool = require('../src/db');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const userRes = await client.query("SELECT id FROM users WHERE username = $1", ['superadmin']);
      if (userRes.rows.length === 0) { console.log('superadmin user not found'); return; }
      const userId = userRes.rows[0].id;
      const res = await client.query("SELECT id, created_at, format, ip_address FROM tasks_export_actions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5", [userId]);
      console.log('Found export actions:', res.rows.length);
      for (const r of res.rows) {
        console.log(r);
      }
    } finally { client.release(); }
  } catch (e) { console.error('Error', e); process.exitCode=1; }
  finally { try { await pool.end(); } catch(_){} }
})();
