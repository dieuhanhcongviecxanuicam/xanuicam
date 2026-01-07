#!/usr/bin/env node
const pool = require('../src/db');

(async () => {
  try {
    console.log('Running prune_sessions.js...');
    const res = await pool.query("UPDATE sessions SET is_active = FALSE, last_seen_at = NOW() WHERE created_at < NOW() - INTERVAL '30 days' AND is_active = TRUE RETURNING session_id");
    console.log(`Pruned ${res.rowCount} sessions.`);
    process.exit(0);
  } catch (e) {
    console.error('prune_sessions error:', e && (e.stack || e));
    process.exit(2);
  }
})();
