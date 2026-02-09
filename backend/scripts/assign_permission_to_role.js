// assign_permission_to_role.js
// Usage: node assign_permission_to_role.js --role=admin --perm=export_tasks
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(a => {
    const [k, v] = a.split('=');
    args[k.replace(/^--/, '')] = v;
  });
  return args;
}

(async () => {
  const args = parseArgs();
  const roleName = args.role;
  const permName = args.perm || 'export_tasks';

  if (!roleName) {
    console.error('Missing --role argument (role name)');
    process.exit(1);
  }

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

    // ensure permission exists
    const permRes = await client.query('SELECT id FROM permissions WHERE permission_name = $1', [permName]);
    let permId;
    if (permRes.rows.length === 0) {
      const ins = await client.query('INSERT INTO permissions (permission_name, description) VALUES ($1, $2) RETURNING id', [permName, 'Allow exporting tasks (Excel/PDF/CSV)']);
      permId = ins.rows[0].id;
      console.log('Inserted permission', permName, 'id', permId);
    } else {
      permId = permRes.rows[0].id;
      console.log('Permission exists with id', permId);
    }

    // find role by name
    const roleRes = await client.query('SELECT id FROM roles WHERE role_name = $1', [roleName]);
    if (roleRes.rows.length === 0) {
      throw new Error('Role not found: ' + roleName);
    }
    const roleId = roleRes.rows[0].id;

    // insert mapping
    await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [roleId, permId]);
    console.log(`Assigned permission ${permName} to role ${roleName} (id ${roleId})`);

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Failed to assign permission:', e.message || e);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
