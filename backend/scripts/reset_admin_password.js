const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
(async ()=>{
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  try{
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password', salt);
    const res = await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username', [hash, 'admin']);
    console.log('Updated admin:', res.rows);
  }catch(e){
    console.error(e);
  }finally{
    await pool.end();
  }
})();
