#!/usr/bin/env bash
set -euo pipefail

# scripts/push_build_to_server.sh
# Usage:
#  ./scripts/push_build_to_server.sh user@host:/path/to/deploy [ssh_port] [ssh_key]
# OR set environment variables: DEPLOY_TARGET, DEPLOY_PORT, SSH_KEY
# This script rsyncs local `frontend/build/` to the remote deploy path and
# attempts to restart the backend (pm2 if available, fallback to npm script
# or docker-compose where present).

TARGET=${1:-${DEPLOY_TARGET:-}}
PORT=${2:-${DEPLOY_PORT:-22}}
KEY=${3:-${SSH_KEY:-}}

if [ -z "$TARGET" ]; then
  echo "Usage: $0 user@host:/path/to/deploy [ssh_port] [ssh_key]"
  exit 2
fi

if [ ! -d "./frontend/build" ]; then
  echo "Error: ./frontend/build not found. Run 'npm run build' in frontend first." >&2
  exit 3
fi

if [[ ! "$TARGET" =~ ^([^@]+)@([^:]+):(.+)$ ]]; then
  echo "Error: TARGET must be in form user@host:/abs/path" >&2
  exit 4
fi

USER=${BASH_REMATCH[1]}
HOST=${BASH_REMATCH[2]}
TARGET_PATH=${BASH_REMATCH[3]}

SSH_OPTS=( -p "$PORT" -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new -o LogLevel=ERROR )
if [ -n "$KEY" ]; then
  SSH_OPTS=( -i "$KEY" "${SSH_OPTS[@]}" )
fi

RSYNC_RSH="ssh ${SSH_OPTS[*]}"

echo "Pushing ./frontend/build -> ${USER}@${HOST}:${TARGET_PATH}/frontend/build"


# Ensure remote dir exists and create a timestamped backup if build exists.
# Use sudo on the remote side when the SSH user isn't root.
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -lc "set -e; if [ \"$(id -u)\" -ne 0 ]; then sudo mkdir -p '${TARGET_PATH}' && sudo mkdir -p '${TARGET_PATH}/frontend' || true; if [ -d '${TARGET_PATH}/frontend/build' ]; then sudo mv '${TARGET_PATH}/frontend/build' '${TARGET_PATH}/frontend/build.bak.$(date +%s)' || true; fi; else mkdir -p '${TARGET_PATH}' && mkdir -p '${TARGET_PATH}/frontend' || true; if [ -d '${TARGET_PATH}/frontend/build' ]; then mv '${TARGET_PATH}/frontend/build' '${TARGET_PATH}/frontend/build.bak.$(date +%s)' || true; fi; fi"

echo "Starting rsync (normal)..."
if rsync -avz --delete --progress -e "${RSYNC_RSH}" ./frontend/build/ "${USER}@${HOST}:${TARGET_PATH}/frontend/build/"; then
  RSYNC_OK=0
else
  RSYNC_OK=$?
  echo "rsync failed with code ${RSYNC_OK}; attempting fallback with sudo on remote (may prompt for password)..."
  # Try rsync with remote sudo (useful when remote directory requires elevated permissions)
  if rsync -avz --delete --progress -e "${RSYNC_RSH}" --rsync-path="sudo rsync" ./frontend/build/ "${USER}@${HOST}:${TARGET_PATH}/frontend/build/"; then
    RSYNC_OK=0
  else
    RSYNC_OK=$?
  fi
fi

if [ "$RSYNC_OK" -ne 0 ]; then
  echo "rsync ultimately failed (exit ${RSYNC_OK}). Ensure remote path exists and the SSH user has permission (or provide a key)." >&2
  exit $RSYNC_OK
fi

echo "Files synced. Attempting remote restart steps..."

ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" bash -lc "set -e; \
  # Try pm2 restart first
  if command -v pm2 >/dev/null 2>&1; then \
    if pm2 describe ubnd-backend >/dev/null 2>&1; then \
      pm2 restart ubnd-backend && echo 'pm2: restarted ubnd-backend' && exit 0 || true; \
    fi; \
  fi; \
  # Fallback: run npm prod restart in deploy path
  if [ -d '${TARGET_PATH}/backend' ]; then \
    cd '${TARGET_PATH}/backend' || true; \
    if npm run prod:restart --silent; then echo 'npm: prod:restart succeeded' && exit 0; fi; \
    if npm run prod:start --silent; then echo 'npm: prod:start succeeded' && exit 0; fi; \
  fi; \
  # If docker-compose present try to rebuild
  if [ -f '${TARGET_PATH}/docker-compose.yml' ]; then \
    cd '${TARGET_PATH}' || true; \
    docker-compose pull || true; docker-compose up -d --build || true; echo 'docker-compose: attempted rebuild' && exit 0; \
  fi; \
  echo 'No known restart mechanism found (pm2/npm/docker-compose). Please restart your server process manually.'
"

echo "Remote restart attempt finished. Performing health check (http://localhost:5000/health via SSH)..."
# Use a simpler SSH command string to avoid quoting issues
ssh "${SSH_OPTS[@]}" "${USER}@${HOST}" "if command -v curl >/dev/null 2>&1; then curl -sS -o /dev/null -w '%{http_code}\\n' http://127.0.0.1:5000/health || true; else echo 'curl not installed on remote'; fi"

echo "Done. If you still see stale UI, consider purging CDN (Cloudflare) cache or ensure index.html and JS assets were uploaded to the correct host/path." 

exit 0
