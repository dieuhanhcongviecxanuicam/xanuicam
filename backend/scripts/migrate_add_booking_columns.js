const pool = require('../src/db');

async function migrate() {
  try {
    console.log('Running migration: add approver columns to room_bookings if not exists');
    await pool.query("ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;");
    await pool.query("ALTER TABLE room_bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;");
    console.log('Migration completed.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

migrate();
