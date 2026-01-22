#!/usr/bin/env node
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

function genPassword() {
  // generate a 16-char URL-safe password
  return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0,16);
}

async function main() {
  const username = process.argv[2] || `smoke_test_${Date.now()}`;
  const password = process.argv[3] || genPassword();

  try {
    // check existing
    const exists = await pool.query('SELECT id FROM users WHERE username = $1 OR cccd = $2 LIMIT 1', [username, username]);
    if (exists.rows.length) {
      console.log('User already exists:', exists.rows[0]);
      console.log('If you want to force-create, remove existing user first.');
      process.exit(1);
    }

    // pick a sensible role (lowest privilege)
    let roleId = null;
    try {
      const r = await pool.query('SELECT id FROM roles ORDER BY level ASC LIMIT 1');
      if (r.rows.length) roleId = r.rows[0].id;
    } catch (e) {
      // roles table may not exist; leave roleId null
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const fullName = 'Smoke Test User';

    const insertQ = `INSERT INTO users (username, cccd, password_hash, full_name, role_id, is_active) VALUES ($1,$2,$3,$4,$5, TRUE) RETURNING id`; 
    const params = [username, username, hash, fullName, roleId];
    const res = await pool.query(insertQ, params);

    console.log('Created smoke test user:');
    console.log('  username:', username);
    console.log('  password:', password);
    console.log('  user_id:', res.rows[0].id);
    console.log('IMPORTANT: rotate or remove this account after testing.');
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Failed to create test user:', e && (e.stack || e));
    try { await pool.end(); } catch (ee) {}
    process.exit(1);
  }
}

main();
