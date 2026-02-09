require('dotenv').config();
const pool = require('../src/db');
(async()=>{
  try{
    const userId = process.argv[2] ? parseInt(process.argv[2],10) : null;
    if(!userId){ console.error('Usage: node query_audit_by_userid.js <userId>'); process.exit(1); }
    const r = await pool.query('SELECT id, username, user_id, action, module, created_at FROM audit_logs WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20',[userId]);
    console.log('rows:', r.rows.length);
    console.dir(r.rows, { depth: null });
  }catch(e){ console.error(e); }
  finally{ await pool.end(); }
})();
