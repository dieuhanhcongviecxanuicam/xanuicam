#!/usr/bin/env bash
# Local helper to rsync frontend build to server and restart backend via SSH.
# Usage: DEPLOY_HOST=1.2.3.4 DEPLOY_USER=root DEPLOY_PATH=/var/www/xanuicam ./scripts/deploy_via_ssh.sh

set -euo pipefail
HOST=${DEPLOY_HOST:-27.71.29.69}
USER=${DEPLOY_USER:-root}
PATH_ON_SERVER=${DEPLOY_PATH:-/var/www/xanuicam}
DOMAIN=${DEPLOY_DOMAIN:-xanuicam.vn}
SSH_KEY=${SSH_KEY:-}
PORT=${DEPLOY_PORT:-22}

if [ -z "$HOST" ] || [ -z "$USER" ] || [ -z "$PATH_ON_SERVER" ]; then
  echo "Please set DEPLOY_HOST, DEPLOY_USER and DEPLOY_PATH environment variables." >&2
  exit 2
fi

RSYNC_OPTS="-avz --delete --exclude '.env' --exclude '.git'"

if [ -n "$SSH_KEY" ]; then
  SSH_OPTS="-i $SSH_KEY -p $PORT"
else
  SSH_OPTS="-p $PORT"
fi

echo "Building frontend..."
npm --prefix frontend ci
npm --prefix frontend run build

echo "Syncing build to $USER@$HOST:$PATH_ON_SERVER"
rsync $RSYNC_OPTS -e "ssh $SSH_OPTS" frontend/build/ "$USER@$HOST:$PATH_ON_SERVER/frontend/build/"

echo "Restarting backend on server"
ssh $SSH_OPTS $USER@$HOST <<'SSH'
  set -e
  # adjust as needed: reload systemd unit or use pm2
  if command -v pm2 >/dev/null 2>&1; then
    pm2 restart ubnd-backend || pm2 start /var/www/xanuicam/backend/ecosystem.config.js --env production
  else
    # fallback: simple restart via systemd (replace service name)
    sudo systemctl restart ubnd-backend || true
  fi
SSH

echo "Deploy finished."