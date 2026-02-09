// Adds export_audit_decrypted permission non-destructively and assigns to Admin role (role_id = 1)
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

(async () => {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const permName = 'export_audit_decrypted';
    const permDesc = 'Quyền xuất CSV chứa dữ liệu đã giải mã (nhạy cảm) - chỉ cho super-admin';

    const res = await client.query('SELECT id FROM permissions WHERE permission_name = $1', [permName]);
    let permId;
    if (res.rows.length === 0) {
      const ins = await client.query('INSERT INTO permissions (permission_name, description) VALUES ($1, $2) RETURNING id', [permName, permDesc]);
      permId = ins.rows[0].id;
      console.log('Inserted permission', permName, 'id', permId);
    } else {
      permId = res.rows[0].id;
      console.log('Permission already exists with id', permId);
    }

    // Assign to Admin role (role_id = 1) if not already assigned
    const check = await client.query('SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2', [1, permId]);
    if (check.rows.length === 0) {
      await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)', [1, permId]);
      console.log('Assigned permission to Admin role');
    } else {
      console.log('Admin role already has this permission');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
