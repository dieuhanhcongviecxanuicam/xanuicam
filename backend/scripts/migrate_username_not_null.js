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
    console.log('1/3: Backfilling missing usernames from users table...');
    const backfill = await pool.query(`
      UPDATE audit_logs al
      SET username = u.username
      FROM users u
      WHERE al.user_id = u.id
        AND (al.username IS NULL OR al.username = '')
    `);
    console.log('Backfilled rows count:', backfill.rowCount);

    console.log('2/3: Ensuring any remaining NULL usernames are set to empty string');
    await pool.query("UPDATE audit_logs SET username = '' WHERE username IS NULL");

    console.log('3/3: Altering column to NOT NULL (idempotent)');
    try {
      await pool.query("ALTER TABLE audit_logs ALTER COLUMN username SET NOT NULL");
      console.log('Altered username to NOT NULL');
    } catch (e) {
      if (e.code === '23514' || e.code === '42701' || e.code === '42P07' || /already exists/i.test(String(e.message))) {
        // some DBs may report different codes; swallow if already set
        console.log('username is already NOT NULL or constraint exists.');
      } else {
        throw e;
      }
    }

    console.log('Migration completed successfully.');
  }catch(e){
    console.error('Migration failed:', e);
    process.exit(1);
  }finally{
    await pool.end();
  }
})();