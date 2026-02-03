const pool = require('../src/db');

async function listTables() {
  try {
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
    console.log('Public tables:');
    res.rows.forEach(r => console.log(' -', r.table_name));
    process.exit(0);
  } catch (e) {
    console.error('Error listing tables:', e && (e.stack || e));
    process.exit(2);
  }
}

listTables();
