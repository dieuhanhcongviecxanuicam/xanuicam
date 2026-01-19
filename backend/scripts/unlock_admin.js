// Unlock admin script - run with `node scripts/unlock_admin.js`
const pool = require('../src/db');

(async function(){
  try {
    const username = process.argv[2] || 'admin';
    const find = await pool.query('SELECT id, username, full_name, is_active, failed_attempts FROM users WHERE username = $1 OR cccd = $1 LIMIT 1', [username]);
    if (find.rows.length === 0) {
      console.error('User not found:', username);
      process.exit(2);
    }
    const user = find.rows[0];
    console.log('Found user:', user.username, 'id=', user.id, 'is_active=', user.is_active, 'failed_attempts=', user.failed_attempts);
    const res = await pool.query('UPDATE users SET is_active = TRUE, failed_attempts = 0, updated_at = NOW() WHERE id = $1 RETURNING id, username, is_active, failed_attempts', [user.id]);
    console.log('Updated:', res.rows[0]);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Error unlocking admin:', err);
    try { await pool.end(); } catch(e){}
    process.exit(1);
  }
})();
