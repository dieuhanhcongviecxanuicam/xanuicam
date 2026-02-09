require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/db');
(async () => {
  try {
    const identifier = process.argv[2] || '000000000001';
    const q = `UPDATE users SET profile_last_updated_at = NULL WHERE cccd = $1 OR username = $1 RETURNING id, cccd, username, profile_last_updated_at`;
    const r = await pool.query(q, [identifier]);
    console.log('Updated rows:', r.rowCount);
    if (r.rows.length) console.log(r.rows);
  } catch (e) {
    console.error('Error resetting profile cooldown:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
    process.exit(0);
  }
})();
