const pool = require('../src/db');

async function createMinimal() {
  try {
    console.log('Creating minimal schema (if missing)...');

    await pool.query(`CREATE TABLE IF NOT EXISTS roles (
      id SERIAL PRIMARY KEY,
      role_name TEXT UNIQUE,
      level INTEGER
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS permissions (
      id SERIAL PRIMARY KEY,
      permission_name TEXT UNIQUE,
      description TEXT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER,
      permission_id INTEGER,
      CONSTRAINT role_perm_pk PRIMARY KEY (role_id, permission_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS departments (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE,
      password_hash TEXT,
      full_name TEXT,
      email TEXT,
      role_id INTEGER,
      department_id INTEGER,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      is_superadmin BOOLEAN DEFAULT FALSE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    console.log('Minimal schema ensured.');
    process.exit(0);
  } catch (e) {
    console.error('Error creating minimal schema:', e && (e.stack || e));
    process.exit(2);
  }
}

createMinimal();
