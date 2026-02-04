-- Minimal migration used by CI E2E smoke to create tables required by seed
-- This creates a small subset of tables expected by `scripts/seed.js`.

CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  role_name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  level INTEGER
);

CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  permission_name TEXT UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  cccd TEXT UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  username TEXT UNIQUE,
  role_id INTEGER REFERENCES roles(id),
  is_active BOOLEAN DEFAULT true,
  is_superadmin BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS system_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  payload JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ensure schema_migrations exists (run_migrations also does this but safe to include)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW()
);

