require('dotenv').config();
const pool = require('../src/db');
(async()=>{
  try{
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='audit_logs' ORDER BY ordinal_position");
    console.log(r.rows.map(x=>x.column_name));
  }catch(e){ console.error(e); } finally{ await pool.end(); }
})();
