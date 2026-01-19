const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  });

  const client = await pool.connect();
  try {
    console.log('Starting idempotent migration...');

    // Create audit_logs table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username TEXT,
        status TEXT,
        reason TEXT,
        device_type TEXT,
        os TEXT,
        user_agent_encrypted TEXT,
        ua_hash TEXT,
        mac_encrypted TEXT,
        mac_hash TEXT,
        ip_encrypted TEXT,
        ip_hash TEXT,
        country TEXT,
        city TEXT,
        isp TEXT,
        method TEXT,
        url TEXT,
        session_id TEXT,
        module TEXT,
        action TEXT,
        details TEXT,
        task_id INTEGER,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      )
    `);

    // Add missing columns if table existed without them
    const ensureColumn = async (table, columnDef, columnName) => {
      const existsRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, columnName]
      );
      if (existsRes.rowCount === 0) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
        console.log(`Added column ${columnName} to ${table}`);
      }
    };

    await ensureColumn('audit_logs', 'user_agent_encrypted TEXT', 'user_agent_encrypted');
    await ensureColumn('audit_logs', 'ua_hash TEXT', 'ua_hash');
    await ensureColumn('audit_logs', 'mac_encrypted TEXT', 'mac_encrypted');
    await ensureColumn('audit_logs', 'mac_hash TEXT', 'mac_hash');
    await ensureColumn('audit_logs', 'ip_encrypted TEXT', 'ip_encrypted');
    await ensureColumn('audit_logs', 'ip_hash TEXT', 'ip_hash');
    await ensureColumn('audit_logs', 'username TEXT', 'username');
    await ensureColumn('audit_logs', 'status TEXT', 'status');
    await ensureColumn('audit_logs', 'reason TEXT', 'reason');
    await ensureColumn('audit_logs', 'device_type TEXT', 'device_type');
    await ensureColumn('audit_logs', 'os TEXT', 'os');
    await ensureColumn('audit_logs', 'country TEXT', 'country');
    await ensureColumn('audit_logs', 'city TEXT', 'city');
    await ensureColumn('audit_logs', 'isp TEXT', 'isp');
    await ensureColumn('audit_logs', 'method TEXT', 'method');
    await ensureColumn('audit_logs', 'url TEXT', 'url');
    await ensureColumn('audit_logs', 'session_id TEXT', 'session_id');
    await ensureColumn('audit_logs', 'module TEXT', 'module');
    await ensureColumn('audit_logs', 'action TEXT', 'action');
    await ensureColumn('audit_logs', 'details TEXT', 'details');
    await ensureColumn('audit_logs', 'task_id INTEGER', 'task_id');
    await ensureColumn('audit_logs', 'latitude DOUBLE PRECISION', 'latitude');
    await ensureColumn('audit_logs', 'longitude DOUBLE PRECISION', 'longitude');

    // Ensure users table has failed_attempts and locked_until for login lockout
    const ensureUserColumn = async (columnDef, columnName) => {
      const existsRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = $1`,
        [columnName]
      );
      if (existsRes.rowCount === 0) {
        await client.query(`ALTER TABLE users ADD COLUMN ${columnDef}`);
        console.log(`Added column ${columnName} to users`);
      }
    };

    await ensureUserColumn("failed_attempts INTEGER DEFAULT 0 NOT NULL", 'failed_attempts');
    await ensureUserColumn("locked_until TIMESTAMP WITH TIME ZONE", 'locked_until');
    // Ensure new optional profile columns exist
    await ensureUserColumn("ma_cong_chuc VARCHAR(13)", 'ma_cong_chuc');
    await ensureUserColumn("profile_last_updated_at TIMESTAMP WITH TIME ZONE", 'profile_last_updated_at');

    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)');
    // idx on ip_hash may fail if column missing; ensure above added it
    await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_hash ON audit_logs(ip_hash)');

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        session_id TEXT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        user_agent_encrypted TEXT,
        ua_hash TEXT,
        ip_encrypted TEXT,
        ip_hash TEXT,
        last_seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      )
    `);
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active)');

    console.log('Migration applied successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
