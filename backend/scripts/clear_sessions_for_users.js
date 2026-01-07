const pool = require('../src/db');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const users = ['admin','superadmin'];
      for (const u of users) {
        const r = await client.query('SELECT id FROM users WHERE username = $1', [u]);
        if (r.rows.length === 0) { console.log('User not found:', u); continue; }
        const uid = r.rows[0].id;
        const upd = await client.query("UPDATE sessions SET is_active = FALSE WHERE user_id = $1 RETURNING session_id, is_active, created_at", [uid]);
        console.log(`Cleared sessions for ${u}:`, upd.rowCount);
      }
    } finally { client.release(); }
  } catch(e){ console.error('Error', e); process.exitCode=1; } finally { try { await pool.end(); } catch(_){} }
})();
