require('dotenv').config();
const pool = require('../src/db');
(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS roles (id SERIAL PRIMARY KEY, role_name TEXT, level INTEGER);`);
    const r = await pool.query("SELECT id FROM roles ORDER BY id LIMIT 1");
    if (r.rows[0]) {
      console.log('Role exists:', r.rows[0].id);
    } else {
      const ins = await pool.query("INSERT INTO roles (role_name, level) VALUES ('dev_default',1) RETURNING id");
      console.log('Inserted role id', ins.rows[0].id);
    }
  } catch (e) {
    console.error('Error ensuring roles:', e && e.stack ? e.stack : e);
    process.exit(1);
  } finally {
    try { await pool.end(); } catch (e) {}
  }
})();
