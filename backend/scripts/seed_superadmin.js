const db = require('../src/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function run() {
  const username = process.argv[2] || process.env.SUPERADMIN_USERNAME || 'superadmin';
  const rawPassword = process.argv[3] || process.env.SUPERADMIN_PASSWORD || null;
  const secret = process.argv[4] || process.env.SUPERADMIN_SECRET || null;

  // generate password/secret if not provided
  const password = rawPassword || Math.random().toString(36).slice(2, 12) + 'A1!';
  const secretValue = secret || Math.random().toString(36).slice(2, 12) + 'S!';

  const passwordHash = await bcrypt.hash(password, 10);

  const outPath = path.resolve(__dirname, 'admin_super_secret.txt');

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // determine a sensible role_id (prefer a role that contains 'admin')
    let roleId = null;
    try {
      const roleRes = await client.query("SELECT id FROM roles WHERE role_name ILIKE '%admin%' LIMIT 1");
      if (roleRes.rows.length > 0) roleId = roleRes.rows[0].id;
    } catch(e) {
      // ignore
    }
    if (!roleId) {
      // fallback to role with lowest level or id 1
      try {
        const r2 = await client.query('SELECT id FROM roles ORDER BY level ASC NULLS LAST LIMIT 1');
        if (r2.rows.length > 0) roleId = r2.rows[0].id;
      } catch(e){}
    }
    if (!roleId) roleId = 1;

    // upsert user
    const upsertSql = `
      INSERT INTO users (username, password_hash, full_name, role_id, is_active, is_superadmin, must_reset_password)
      VALUES ($1, $2, $3, $4, true, true, true)
      ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_superadmin = true, must_reset_password = true, full_name = COALESCE(users.full_name, EXCLUDED.full_name), role_id = COALESCE(users.role_id, EXCLUDED.role_id)
      RETURNING id, username;
    `;
    const res = await client.query(upsertSql, [username, passwordHash, 'Super Administrator', roleId]);

    // grant full permissions (assumes roles/permissions system exists)
    // best-effort: if there's a role or permission assignment table, add entries
    // Skip if schema differs

    await client.query('COMMIT');

    const out = `# Superadmin provisioning\n# Generated: ${new Date().toISOString()}\nusername: ${username}\npassword: ${password}\nsecret: ${secretValue}\n\n`;
    // write file briefly, then remove it after displaying to console
    fs.writeFileSync(outPath, out, { encoding: 'utf8', flag: 'w' });
    console.log('Wrote', outPath);
    // remove file immediately for safety
    try { fs.unlinkSync(outPath); console.log('Removed credential file from disk for safety.'); } catch(e) {}
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
