#!/usr/bin/env bash
set -euo pipefail

# deploy_upload_middleware.sh
# Usage:
# 1) Copy this script and the patched middleware file to the production host (same directory layout or adjust SOURCE)
#    scp scripts/deploy_upload_middleware.sh backend/src/middlewares/uploadMiddleware.js root@PROD_HOST:/root/
# 2) SSH to the host and run as root or with sudo:
#    sudo bash /root/deploy_upload_middleware.sh --source /root/uploadMiddleware.js

SOURCE=""
DEST_BASE="/root/ubndxanuicam_deploy/backend"
DEST_REL="src/middlewares/uploadMiddleware.js"
PERSIST_LOG="/var/log/upload_rejections.log"

print_usage() {
  cat <<EOF
Usage: $0 [--source /path/to/uploadMiddleware.js] [--dest /path/to/deploy/backend]
If --source is not provided the script expects uploadMiddleware.js in the current working directory.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --dest) DEST_BASE="$2"; shift 2 ;;
    -h|--help) print_usage; exit 0 ;;
    *) echo "Unknown arg: $1"; print_usage; exit 2 ;;
  esac
done

if [ -z "$SOURCE" ]; then
  SOURCE="$(pwd)/backend/src/middlewares/uploadMiddleware.js"
fi

if [ ! -f "$SOURCE" ]; then
  echo "Source file not found: $SOURCE" >&2
  exit 3
fi

DEST="$DEST_BASE/$DEST_REL"

echo "Deploying $SOURCE -> $DEST"

if [ -f "$DEST" ]; then
  echo "Backing up existing file to ${DEST}.bak.$(date +%s)"
  cp -a "$DEST" "${DEST}.bak.$(date +%s)"
fi

mkdir -p "$(dirname "$DEST")"
cp -a "$SOURCE" "$DEST"
echo "Copied new middleware to $DEST"

# Ensure persistent log exists and has permissive ownership (attempt common service users)
sudo touch "$PERSIST_LOG" || true
for user in www-data node pm2 www; do
  if id -u "$user" >/dev/null 2>&1; then
    sudo chown "$user":"$user" "$PERSIST_LOG" || true
    break
  fi
done
sudo chmod 644 "$PERSIST_LOG" || true
echo "Ensured persistent log at $PERSIST_LOG"

# Try restarting pm2 process if present
if sudo pm2 jlist --no-color >/dev/null 2>&1; then
  if sudo pm2 ls --no-color | grep -q ubnd-backend; then
    echo "Restarting pm2 process ubnd-backend"
    sudo pm2 restart ubnd-backend --update-env || sudo pm2 restart ubnd-backend || true
    echo "pm2 restart attempted"
  else
    echo "pm2 appears installed but ubnd-backend process not found"
  fi
else
  echo "pm2 does not appear available as sudo in this environment"
fi

# If Docker is present and there is a container matching 'ubnd' or 'xanuicam', restart it
if sudo docker ps -a --no-trunc >/dev/null 2>&1; then
  CONTAINER=$(sudo docker ps -a --no-trunc --format '{{.ID}} {{.Names}}' | egrep 'ubnd|xanuicam' | awk '{print $1}' | head -n1 || true)
  if [ -n "$CONTAINER" ]; then
    echo "Restarting container $CONTAINER"
    sudo docker restart "$CONTAINER" || true
  else
    echo "No ubnd/xanuicam docker container found to restart"
  fi
else
  echo "Docker not available or not accessible via sudo"
fi

echo "Deployment finished. Check logs: tail -n 200 $PERSIST_LOG"

exit 0
