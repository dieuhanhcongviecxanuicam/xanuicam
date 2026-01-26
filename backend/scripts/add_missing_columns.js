#!/usr/bin/env node
// Safe migration helper: add missing columns referenced by runtime code
// Usage: node scripts/add_missing_columns.js
const pool = require('../src/db');
(async () => {
  try {
    console.log('Applying safe ALTER TABLE statements...');

    const stmts = [
      // audit_logs optional columns
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_version TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS country TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS city TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS isp TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS latitude NUMERIC",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS longitude NUMERIC",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS session_id TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS method TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS url TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent_encrypted TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ua_hash TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS mac_encrypted TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS mac_hash TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS change_payload_json TEXT",
      "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS username TEXT",

      // deleted_* tables: avatar used by pruners
      "ALTER TABLE deleted_departments ADD COLUMN IF NOT EXISTS avatar TEXT",
      "ALTER TABLE deleted_users ADD COLUMN IF NOT EXISTS avatar TEXT",

      // departments/users may reference avatar in other code paths
      "ALTER TABLE departments ADD COLUMN IF NOT EXISTS avatar TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT"
    ];

    for (const s of stmts) {
      try {
        console.log('Running:', s);
        await pool.query(s);
      } catch (e) {
        console.warn('Statement failed (continuing):', s, e && e.message ? e.message : e);
      }
    }

    console.log('Done. Closing DB pool.');
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Migration script failed:', e && (e.stack || e));
    try { await pool.end(); } catch (ee) {}
    process.exit(1);
  }
})();
