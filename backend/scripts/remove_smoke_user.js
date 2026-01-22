#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('../src/db');

async function main() {
  const username = process.argv[2] || 'smoke1';
  try {
    console.log('Removing user:', username);
    const r = await pool.query('DELETE FROM users WHERE username = $1 RETURNING id, username', [username]);
    if (r.rows.length === 0) {
      console.log('No user removed (not found).');
    } else {
      console.log('Removed user rows:', r.rows);
    }
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Failed to remove user:', e && (e.stack || e));
    try { await pool.end(); } catch (ee) {}
    process.exit(1);
  }
}

main();
