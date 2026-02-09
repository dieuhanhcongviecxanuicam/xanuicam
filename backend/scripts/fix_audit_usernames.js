// One-off script: populate missing username in audit_logs using users table
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
    console.log('Populating missing usernames for Export decrypted CSV audit entries...');
    const res = await pool.query(`
      UPDATE audit_logs al
      SET username = u.username
      FROM users u
      WHERE al.user_id = u.id
        AND al.username IS NULL
        AND al.action = 'Export decrypted CSV'
      RETURNING al.id, al.user_id, u.username
    `);
    console.log('Updated rows:', res.rowCount);
    if (res.rows && res.rows.length) console.table(res.rows);
  }catch(e){
    console.error('Error updating audit_logs:', e);
  }finally{
    await pool.end();
  }
})();
