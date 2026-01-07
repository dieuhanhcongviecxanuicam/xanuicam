// Apply SQL migration by reading the file and executing via the existing DB pool
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function run() {
  const file = process.argv[2] || path.join(__dirname, '..', 'migrations', '2025_12_24_reset_stale_failed_attempts.sql');
  try {
    const sql = fs.readFileSync(file, 'utf8');
    console.log('Applying migration:', file);
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('Migration applied successfully.');
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e && e.message ? e.message : e);
    try { await pool.query('ROLLBACK'); } catch (_) {}
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (_) {}
  }
}

run();
