const pool = require('../backend/src/db');
(async()=>{
  try{
    const r = await pool.query('SELECT id, role_name FROM roles LIMIT 5');
    console.log(r.rows);
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); }
  finally{ try{ await pool.end(); }catch(e){} }
})();
