const pool = require('../src/db');
(async()=>{
  try{
    const r = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='failed_attempts'");
    console.log('rows:', r.rows);
  }catch(e){
    console.error('error:', e.message);
  }finally{
    await pool.end();
  }
})();
