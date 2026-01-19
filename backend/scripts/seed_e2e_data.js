const pool = require('../src/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('Seeding e2e data...');

    // avoid creating schema objects (permission issues on some DBs);
    // assume migrations already applied. Insert/UPSERT only.
    // ensure a department (won't create table)
    const depRes = await pool.query("INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id", ['E2E Department']);
    const departmentId = depRes.rows[0].id;
    console.log('Department id:', departmentId);

    // ensure permissions
    const perms = ['view_reports','full_access'];
    for (const p of perms) {
      await pool.query('INSERT INTO permissions (permission_name, description) VALUES ($1,$2) ON CONFLICT (permission_name) DO NOTHING', [p, `E2E ${p}`]);
    }

    // ensure a role
    const roleRes = await pool.query("INSERT INTO roles (role_name, level) VALUES ($1,$2) ON CONFLICT (role_name) DO UPDATE SET role_name=EXCLUDED.role_name RETURNING id", ['e2e_role', 1]);
    const roleId = roleRes.rows[0].id;
    console.log('Role id:', roleId);

    // map role -> permissions
    for (const p of perms) {
      const permRes = await pool.query('SELECT id FROM permissions WHERE permission_name = $1', [p]);
      if (permRes.rows.length) {
        const permId = permRes.rows[0].id;
        await pool.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roleId, permId]);
      }
    }

    // create e2e test user
    const username = process.env.E2E_USER || 'e2e_test_user';
    const password = process.env.E2E_PASS || 'P@ssw0rd123';
    const fullName = 'E2E Test User';
    const email = 'e2e_test_user@example.local';

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const userCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId;
    if (userCheck.rows.length === 0) {
      const ins = await pool.query(
        `INSERT INTO users (username, password_hash, full_name, email, role_id, department_id, is_active, created_at, updated_at, is_superadmin)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW(),NOW(),TRUE) RETURNING id`,
        [username, hash, fullName, email, roleId, departmentId]
      );
      userId = ins.rows[0].id;
      console.log('Created user id:', userId);
    } else {
      userId = userCheck.rows[0].id;
      await pool.query('UPDATE users SET password_hash=$1, full_name=$2, email=$3, role_id=$4, department_id=$5, is_active=TRUE, is_superadmin=TRUE, updated_at=NOW() WHERE id=$6', [hash, fullName, email, roleId, departmentId, userId]);
      console.log('Updated existing user id:', userId);
    }

    console.log('E2E seed complete. User:', username, 'Password:', password);
    process.exit(0);
  } catch (e) {
    console.error('E2E seed error:', e && (e.stack || e));
    process.exit(2);
  }
}

seed();
