#!/usr/bin/env bash
set -euo pipefail

# Secure helper: create backend/.env from environment variables without storing
# secrets in git. Run locally after exporting required variables.
# Example:
# export DB_USER=ubndxanuicam DB_PASSWORD='hunter2' JWT_SECRET='...'
# ./scripts/create_env_from_envvars.sh

OUT=/home/nttsu/xanuicam/backend/.env
mkdir -p "$(dirname "$OUT")"

echo "Creating $OUT from environment variables (will set mode 600)."

required=(DB_USER DB_PASSWORD DB_DATABASE)
for v in "${required[@]}"; do
  if [ -z "${!v:-}" ]; then
    echo "ERROR: Required env var $v is not set. Aborting." >&2
    exit 1
  fi
done

{ 
  echo "NODE_ENV=${NODE_ENV:-development}"
  echo "PORT=${PORT:-5000}"
  echo "JWT_SECRET=${JWT_SECRET:-}" 
  echo "ALLOW_LOCALHOST=${ALLOW_LOCALHOST:-true}"
  echo "REQUEST_LOGGING=${REQUEST_LOGGING:-false}"
  echo "DEBUG_LOGS=${DEBUG_LOGS:-false}"
  echo "DB_HOST=${DB_HOST:-127.0.0.1}"
  echo "DB_PORT=${DB_PORT:-5432}"
  echo "DB_USER=${DB_USER}"
  echo "DB_PASSWORD=${DB_PASSWORD}"
  echo "DB_DATABASE=${DB_DATABASE}"
  echo "AUDIT_LOG_KEY=${AUDIT_LOG_KEY:-}"
  echo "ALLOW_INTERNAL_TEST_TOKEN=${ALLOW_INTERNAL_TEST_TOKEN:-false}"
} > "$OUT"

chmod 600 "$OUT"
echo "Wrote $OUT (mode 600). Do NOT commit this file."
