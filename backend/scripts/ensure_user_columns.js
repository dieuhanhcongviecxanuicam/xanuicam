const pool = require('../src/db');

(async () => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts integer DEFAULT 0`);
    console.log('Ensured column failed_attempts exists');
  } catch (err) {
    console.error('Failed to ensure column:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
