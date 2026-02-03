const pool = require('../src/db');
const bcrypt = require('bcryptjs');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const res = await client.query('SELECT password_hash FROM users WHERE username = $1', ['export_tester']);
      if (res.rows.length === 0) { console.error('User not found'); process.exit(2); }
      const hash = res.rows[0].password_hash;
      const ok = await bcrypt.compare('TestExport123!', hash);
      console.log('bcrypt compare result:', ok);
    } finally { client.release(); }
  } catch(e){ console.error('Error', e); process.exitCode=1; } finally { try{ await pool.end(); }catch(_){} }
})();
