const pool = require('../src/db');
(async ()=>{
  try{
    const client = await pool.connect();
    try{
      const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks_export_actions'");
      console.log('Columns:');
      for (const r of res.rows) console.log(r.column_name, '-', r.data_type);
    } finally { client.release(); }
  } catch(e){ console.error('Error', e); process.exitCode=1; } finally { try{ await pool.end(); }catch(_){} }
})();
