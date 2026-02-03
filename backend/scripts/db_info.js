const pool = require('../src/db');

async function info() {
  try {
    const r = await pool.query("SELECT current_database() as db, current_user as user, current_schema() as schema");
    console.log('DB info:', r.rows[0]);
    process.exit(0);
  } catch (e) {
    console.error('Error getting DB info:', e && (e.stack || e));
    process.exit(2);
  }
}

info();
