const pool = require('../src/db');

(async () => {
  try {
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_type TEXT`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS os TEXT`);
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS details TEXT`);
    console.log('Ensured sessions columns: device_type, os, details');
  } catch (err) {
    console.error('Failed to ensure sessions columns:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
})();
