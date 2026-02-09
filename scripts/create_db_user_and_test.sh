#!/usr/bin/env bash
set -euo pipefail

DB_USER=${1:-app_user}
DB_NAME=${2:-ubndx}

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root or with sudo. Exiting."
  exit 1
fi

echo "== Ensure postgresql service is available =="
if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found — installing postgresql..."
  apt update
  apt install -y postgresql postgresql-contrib
fi

echo "== Generating strong password for user $DB_USER =="
PASSWORD=$(openssl rand -base64 18)

echo "== Creating/updating role and database =="
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL || true
DO
\$\$ BEGIN
   -- try create role; if exists, alter password
   BEGIN
     CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${PASSWORD}';
   EXCEPTION WHEN duplicate_object THEN
     ALTER ROLE ${DB_USER} WITH PASSWORD '${PASSWORD}';
   END;
END\$\$;
SQL

sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" 2>/dev/null || echo "Database ${DB_NAME} already exists or creation skipped"

echo "== Backing up and patching pg_hba.conf to ensure password auth (md5) for localhost =="
for f in /etc/postgresql/*/main/pg_hba.conf; do
  if [ -f "$f" ]; then
    cp "$f" "$f.bak.$(date +%s)"
    sed -i -E "s/^(local\s+all\s+all\s+)peer/\1md5/" "$f" || true
    sed -i -E "s/^(host\s+all\s+all\s+127\.0\.0\.1\/32\s+)\S+/\1md5/" "$f" || true
    sed -i -E "s/^(host\s+all\s+all\s+::1\/128\s+)\S+/\1md5/" "$f" || true
    echo "Patched $f (backup at $f.bak.*)"
  fi
done

echo "== Reloading PostgreSQL configuration =="
systemctl reload postgresql || systemctl restart postgresql

echo "== Testing connection via TCP (localhost) =="
PGPASSWORD="$PASSWORD" psql "host=localhost user=${DB_USER} dbname=${DB_NAME} sslmode=disable" -c "\conninfo" || {
  echo "Connection test failed. See journalctl -u postgresql for details." >&2
  exit 2
}

echo
echo "=== SUCCESS ==="
echo "Database user: $DB_USER"
echo "Database name: $DB_NAME"
echo "Password: $PASSWORD"
echo "Connection URI (use in backend/.env):"
echo "postgres://${DB_USER}:${PASSWORD}@localhost:5432/${DB_NAME}"

echo
echo "Note: the script updated pg_hba.conf to prefer md5 for local connections and reloaded Postgres."
