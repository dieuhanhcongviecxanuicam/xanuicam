#!/usr/bin/env bash
set -euo pipefail

# Atomic deploy script
# Usage: ./scripts/deploy_atomic.sh [options]
# Options (env or args):
#   LOCAL_BUILD - local build dir (default: frontend/build)
#   SSH_USER - remote ssh user (default: root)
#   SSH_HOST - remote host (default: 27.71.29.69)
#   SSH_KEY - path to private key (default: /tmp/deploy_rsa)
#   SSH_PORT - ssh port (default: 22)
#   REMOTE_WEBROOT - remote public webroot (default: /var/www/xanuicam/frontend/build)
#   REMOTE_BACKEND_BUILD - backend-served build dir (default: /root/ubndxanuicam_deploy/frontend/build)
#   CF_ZONE_ID, CF_API_TOKEN - optional Cloudflare creds for purge

LOCAL_BUILD=${LOCAL_BUILD:-frontend/build}
SSH_USER=${SSH_USER:-root}
SSH_HOST=${SSH_HOST:-27.71.29.69}
SSH_KEY=${SSH_KEY:-/tmp/deploy_rsa}
SSH_PORT=${SSH_PORT:-22}
REMOTE_WEBROOT=${REMOTE_WEBROOT:-/var/www/xanuicam/frontend/build}
REMOTE_BACKEND_BUILD=${REMOTE_BACKEND_BUILD:-/root/ubndxanuicam_deploy/frontend/build}

if [ ! -d "$LOCAL_BUILD" ]; then
  echo "Local build not found: $LOCAL_BUILD" >&2
  exit 2
fi

echo "Deploying $LOCAL_BUILD -> ${SSH_USER}@${SSH_HOST}:${REMOTE_WEBROOT} (atomic)"

ts=$(date +%Y%m%d%H%M%S)
remote_tmp="${REMOTE_WEBROOT}_tmp_${ts}"

RSYNC_SSH_OPTS="-e \"ssh -i ${SSH_KEY} -p ${SSH_PORT} -o StrictHostKeyChecking=no\""

echo "Uploading to remote temp dir: $remote_tmp"
eval rsync -a --delete "${LOCAL_BUILD}/" "${SSH_USER}@${SSH_HOST}:${remote_tmp}/" ${RSYNC_SSH_OPTS}

echo "Promoting temp dir to live on remote"
ssh -i "${SSH_KEY}" -p "${SSH_PORT}" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" bash -lc "'
set -e
if [ -d ${REMOTE_WEBROOT} ]; then
  mv ${REMOTE_WEBROOT} ${REMOTE_WEBROOT}.bak.${ts} || true
fi
mv ${remote_tmp} ${REMOTE_WEBROOT}
chown -R 1000:1000 ${REMOTE_WEBROOT} || true
'"

echo "Syncing backend-served build path and reloading pm2"
ssh -i "${SSH_KEY}" -p "${SSH_PORT}" -o StrictHostKeyChecking=no "${SSH_USER}@${SSH_HOST}" bash -lc "'
set -e
mkdir -p ${REMOTE_BACKEND_BUILD}
rsync -a --delete ${REMOTE_WEBROOT}/ ${REMOTE_BACKEND_BUILD}/
pm2 reload ubnd-backend || pm2 restart ubnd-backend
'"

if [ -n "${CF_API_TOKEN:-}" ] && [ -n "${CF_ZONE_ID:-}" ]; then
  echo "Calling Cloudflare purge for index and root files"
  ./scripts/purge_cloudflare.sh --zone "${CF_ZONE_ID}" --token "${CF_API_TOKEN}" --files \
    "https://www.xanuicam.vn/" "https://www.xanuicam.vn/static/js/" "https://www.xanuicam.vn/static/css/"
else
  echo "Cloudflare creds not provided; skipping purge. Set CF_API_TOKEN and CF_ZONE_ID to enable."
fi

echo "Deploy complete."
