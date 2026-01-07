require('dotenv').config();
const pool = require('../src/db');
const bcrypt = require('bcryptjs');
const fetch = global.fetch || require('node-fetch');
const { decrypt } = require('../src/utils/encryption');

(async () => {
  try {
    // Ensure role exists
    let roleRes = await pool.query('SELECT id FROM roles ORDER BY id LIMIT 1');
    let roleId = roleRes.rows[0] ? roleRes.rows[0].id : null;
    if (!roleId) {
      const ins = await pool.query("INSERT INTO roles (role_name, level) VALUES ('dev_test_role',1) RETURNING id");
      roleId = ins.rows[0].id;
      console.log('Created test role', roleId);
    }

    const username = 'e2e_test_user';
    const plain = 'P@ssw0rd123';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(plain, salt);

    // Create or update user
    const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    let userId;
    if (userRes.rows[0]) {
      userId = userRes.rows[0].id;
      await pool.query('UPDATE users SET password_hash=$1, full_name=$2, role_id=$3, is_active=TRUE WHERE id=$4', [hash, 'E2E Test User', roleId, userId]);
      console.log('Updated user', userId);
    } else {
      const r = await pool.query('INSERT INTO users (username, password_hash, full_name, role_id) VALUES ($1,$2,$3,$4) RETURNING id', [username, hash, 'E2E Test User', roleId]);
      userId = r.rows[0].id;
      console.log('Created user', userId);
    }

    // Perform login POST
    const device = {
      userAgent: 'e2e-agent/1.0',
      platform: 'E2E-OS',
      language: 'vi-VN',
      hardwareConcurrency: 4,
      screen: { width: 1200, height: 800 },
      timezone: 'Asia/Ho_Chi_Minh',
      deviceType: 'Desktop'
    };

    const loginResp = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, password: plain, device })
    });
    const loginData = await loginResp.json();
    console.log('Login response:', loginResp.status, loginData);

    // Query recent audit rows
    const logsRes = await pool.query('SELECT * FROM audit_logs WHERE username = $1 ORDER BY created_at DESC LIMIT 5', [username]);
    console.log('Found audit rows:', logsRes.rowCount);
    for (const r of logsRes.rows) {
      const ua = r.user_agent_encrypted ? (() => { try { return decrypt(r.user_agent_encrypted); } catch(e){ return '<decrypt failed>'; } })() : null;
      const ip = r.ip_encrypted ? (() => { try { return decrypt(r.ip_encrypted); } catch(e){ return '<decrypt failed>'; } })() : null;
      console.log({ id: r.id, created_at: r.created_at, action: r.action, module: r.module, status: r.status, username: r.username, ip, ua, device_type: r.device_type, os: r.os, details: r.details });
    }

  } catch (err) {
    console.error('E2E script error:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
