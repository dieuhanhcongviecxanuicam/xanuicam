const pool = require('../backend/src/db');
(async()=>{
  try{
    const id = process.env.E2E_USER || '000000000001';
    const res = await pool.query("SELECT * FROM users WHERE username = $1 OR cccd = $1", [id]);
    console.log('USER ROW:', JSON.stringify(res.rows[0], null, 2));
  }catch(e){ console.error('ERR', e && e.message ? e.message : e); }
  finally{ try{ await pool.end(); }catch(e){} }
})();
