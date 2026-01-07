const pool = require('../src/db');
const bcrypt = require('bcryptjs');
const username = process.argv[2] || 'export_tester';
const password = process.argv[3] || 'TestExport123!';
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const hash = await bcrypt.hash(password, 10);
      const res = await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE username = $2 RETURNING id', [hash, username]);
      if (res.rows.length === 0) {
        console.error('User not found:', username); process.exitCode = 2; return;
      }
      console.log('Updated password for', username, 'id', res.rows[0].id);
    } finally { client.release(); }
  } catch(e){ console.error('Error', e); process.exitCode = 1; }
  finally { try{ await pool.end(); } catch(_){} }
})();
