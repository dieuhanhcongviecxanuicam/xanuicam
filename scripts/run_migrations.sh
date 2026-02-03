#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/backend/migrations"
SEEDS_DIR="$ROOT_DIR/backend/seeds"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found in PATH. Install Postgres client or run migrations inside your DB host." >&2
  exit 2
fi

if [ -z "${PGHOST:-}" ]; then
  echo "Environment variable PGHOST not set. Set PGHOST/PGUSER/PGPASSWORD/PGDATABASE or use a .env file." >&2
  exit 2
fi

echo "Running migrations from $MIGRATIONS_DIR"
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "Applying migration: $f"
  psql -v ON_ERROR_STOP=1 -q -f "$f"
done

echo "Applying seeds from $SEEDS_DIR"
for s in "$SEEDS_DIR"/*.sql; do
  echo "Applying seed: $s"
  psql -v ON_ERROR_STOP=1 -q -f "$s"
done

echo "Migrations and seeds applied."
