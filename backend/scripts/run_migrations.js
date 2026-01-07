const fs = require('fs');
const path = require('path');
// Ensure backend .env is loaded when running from workspace root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
}

async function getApplied() {
  const r = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(r.rows.map(r => r.filename));
}

async function applyMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  console.log('Applying', path.basename(filePath));
  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [path.basename(filePath)]);
    await pool.query('COMMIT');
    console.log('Applied', path.basename(filePath));
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function run() {
  try {
    await ensureTable();
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const applied = await getApplied();
    for (const f of files) {
      if (applied.has(f)) {
        console.log('Skipping (already applied):', f);
        continue;
      }
      const fp = path.join(migrationsDir, f);
      await applyMigration(fp);
    }
    console.log('All migrations applied.');
  } catch (e) {
    console.error('Migration error:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

run();
