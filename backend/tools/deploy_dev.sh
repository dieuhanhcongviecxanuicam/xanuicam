#/usr/bin/env node /mnt/e/ubndxanuicam_deploy/frontend/node_modules/react-scripts/scripts/start.js bash
set -euo pipefail
# Simple deploy script for dev -> installs deps and restarts pm2 app
BASEDIR=/mnt/e/ubndxanuicam_deploy/backend
APP_NAME=ubnd-backend
PM2_BIN=/usr/bin/pm2

echo Deploy:
