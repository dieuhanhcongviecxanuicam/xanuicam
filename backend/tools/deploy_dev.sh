set -euo pipefail
# Simple deploy script for dev -> installs deps and restarts pm2 app
BASEDIR=/mnt/e/ubndxanuicam_deploy/backend
APP_NAME=ubnd-backend
PM2_BIN=/usr/bin/pm2

echo Deploy:
