const pool = require('../src/db');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const res = await client.query("SELECT id, actor_id, format, created_at FROM tasks_export_actions ORDER BY created_at DESC LIMIT 10");
      console.log('Recent export actions:', res.rows.length);
      for (const r of res.rows) console.log(r);
    } finally { client.release(); }
  } catch (e) { console.error('Error', e); process.exitCode=1; }
  finally { try { await pool.end(); } catch(_){} }
})();
