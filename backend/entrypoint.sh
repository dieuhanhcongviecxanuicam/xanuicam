#!/usr/bin/env sh
set -euo pipefail
echo "[entrypoint] waiting for DB (if configured)"
if [ -x "/app/scripts/wait-for-db.sh" ]; then
  /app/scripts/wait-for-db.sh || true
fi
echo "[entrypoint] starting server"
exec "$@"
