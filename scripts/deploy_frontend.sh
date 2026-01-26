#!/usr/bin/env bash
set -euo pipefail

# scripts/deploy_frontend.sh
# Safe, idempotent build + deploy + restart for xanuicam frontend
# Usage: from repo root: ./scripts/deploy_frontend.sh

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"

echo "[deploy] root: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "[error] node is not installed or not on PATH" >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "[error] npm is not installed or not on PATH" >&2
  exit 1
fi

if [ ! -d "$FRONTEND" ]; then
  echo "[error] frontend folder not found at $FRONTEND" >&2
  exit 1
fi

cd "$FRONTEND"

echo "[deploy] backing up existing frontend build (if any)"
if [ -d "$FRONTEND/build" ]; then
  cp -a "$FRONTEND/build" "$FRONTEND/build.bak.$TIMESTAMP"
  echo "[deploy] backup created: $FRONTEND/build.bak.$TIMESTAMP"
fi

echo "[deploy] installing frontend dependencies (npm ci)"
npm ci --no-audit --no-fund --silent

echo "[deploy] running frontend build"
npm run build --silent

if [ ! -f "$FRONTEND/build/index.html" ]; then
  echo "[error] build failed: $FRONTEND/build/index.html not found" >&2
  exit 1
fi

echo "[deploy] frontend build completed successfully"

# Optional: trim old backups (keep last 5)
echo "[deploy] trimming old backups (keep 5)"
ls -1dt "$FRONTEND"/build.bak.* 2>/dev/null | tail -n +6 | xargs -r rm -rf || true

# Restart backend to pick up new frontend (pm2 via npm script is used in this repo)
if [ -d "$BACKEND" ]; then
  echo "[deploy] restarting backend to pick up new build"
  cd "$BACKEND"

  # Prefer the npm prod:restart script which uses pm2 in this repo
  if npm run prod:restart --silent; then
    echo "[deploy] backend restart command returned successfully"
  else
    echo "[deploy] backend restart command failed; attempting pm2 fallback"
    if command -v pm2 >/dev/null 2>&1; then
      if pm2 restart ubnd-backend >/dev/null 2>&1; then
        echo "[deploy] pm2 restarted 'ubnd-backend'"
      else
        echo "[deploy] pm2 restart failed; consider checking pm2 list" >&2
      fi
    else
      echo "[warning] pm2 not installed; start backend manually (see backend/README or use 'npm run dev')"
    fi
  fi
else
  echo "[warning] backend directory not found at $BACKEND; build finished but backend was not restarted"
fi

echo "[deploy] health-check: attempting to hit backend /health"
HOST=localhost
PORT=${PORT:-5000}
if command -v curl >/dev/null 2>&1; then
  set +e
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "http://$HOST:$PORT/health" || true)
  set -e
  if [ "$HTTP_CODE" = "200" ]; then
    echo "[deploy] backend health OK (http://$HOST:$PORT/health)"
  else
    echo "[warning] backend health check returned $HTTP_CODE - check server logs"
  fi
else
  echo "[deploy] curl not installed; skipping health check"
fi

echo "[deploy] finished at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
