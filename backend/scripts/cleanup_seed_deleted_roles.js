const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function run(){
  try{
    const r = await pool.query("DELETE FROM deleted_roles WHERE role_name LIKE '__seed_deleted_role_%' RETURNING id, role_name");
    console.log('Deleted seed rows count:', r.rowCount);
    if(r.rows.length) console.table(r.rows);
  }catch(e){ console.error('Cleanup failed', e && e.stack || e); process.exit(1); }
  finally{ process.exit(0); }
}

run();
