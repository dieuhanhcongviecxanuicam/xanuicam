const pool = require('../src/db');
(async()=>{
  try{
    const client = await pool.connect();
    try{
      const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'tasks_export_actions'");
      console.log('Found tables:', res.rows);
    } finally { client.release(); }
  } catch(e){ console.error('Error', e); process.exitCode=1; } finally { try{ await pool.end(); }catch(_){} }
})();
