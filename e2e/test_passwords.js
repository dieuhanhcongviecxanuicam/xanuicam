const pool = require('../backend/src/db');
const bcrypt = require('bcryptjs');
(async()=>{
  try{
    const id = process.env.E2E_USER || '000000000001';
    const res = await pool.query("SELECT password_hash FROM users WHERE username = $1 OR cccd = $1", [id]);
    if (res.rows.length === 0) return console.log('No user found');
    const hash = res.rows[0].password_hash;
    const candidates = ['password','P@ssw0rd123','Password123!','admin','123456','password123'];
    for (const p of candidates) {
      const ok = await bcrypt.compare(p, hash);
      console.log(p, '=>', ok);
    }
  }catch(e){ console.error(e); }
  finally{ try{ await pool.end(); }catch(e){} }
})();
