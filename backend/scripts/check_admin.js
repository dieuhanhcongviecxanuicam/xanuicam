const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { Pool } = require('pg');
(async ()=>{
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
  });
  try{
    const res = await pool.query('SELECT id, username, is_active, created_at FROM users WHERE username = $1', ['admin']);
    console.log('rows=', res.rows);
  }catch(e){
    console.error(e);
  }finally{
    await pool.end();
  }
})();
