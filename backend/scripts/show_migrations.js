const pool = require('../src/db');

async function show() {
  try {
    const r = await pool.query("SELECT filename FROM schema_migrations ORDER BY applied_at DESC LIMIT 20");
    console.log('Recent migrations:');
    r.rows.forEach(rr => console.log(' -', rr.filename));
    process.exit(0);
  } catch (e) {
    console.error('Could not read schema_migrations:', e && (e.stack || e));
    process.exit(2);
  }
}

show();
