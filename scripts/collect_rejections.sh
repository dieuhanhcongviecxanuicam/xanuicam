#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 '<JWT>' [booking_id]"
  exit 1
fi

TOKEN="$1"
BOOKING_ID="${2:-17}"

echo "== Prepare deploy tmp dir (may prompt for sudo) =="
sudo mkdir -p /root/ubndxanuicam_deploy/backend/tmp
# prefer www-data owner, fallback to root
sudo chown -R www-data:www-data /root/ubndxanuicam_deploy/backend/tmp 2>/dev/null || sudo chown -R root:root /root/ubndxanuicam_deploy/backend/tmp
sudo ls -la /root/ubndxanuicam_deploy/backend/tmp || true

echo "== Ensure backend deps & restart pm2 (may prompt for sudo) =="
cd /root/ubndxanuicam_deploy/backend || { echo "deploy dir missing"; exit 2; }
# install prod deps if needed (safe no-op if already OK)
sudo npm ci --only=production || sudo npm install --production || true
# restart or start pm2 process
if sudo pm2 list | grep -q "ubnd-backend"; then
  sudo pm2 restart ubnd-backend --update-env || true
else
  if [ -f ecosystem.config.js ]; then
    sudo pm2 start ecosystem.config.js --env production || sudo pm2 start server.js --name ubnd-backend --update-env || true
  else
    sudo pm2 start server.js --name ubnd-backend --update-env || true
  fi
fi
sudo pm2 list || true

echo "== Create disallowed test file =="
printf 'MALWARE' > /tmp/malware.exe
ls -l /tmp/malware.exe || true

echo "== Trigger upload (HTTP response will be shown) =="
set +e
curl -v -X PUT "https://www.xanuicam.vn/api/room-bookings/${BOOKING_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "attachments=@/tmp/malware.exe;type=application/x-msdownload" \
  -F "otherField=1"
CURL_EXIT=$?
set -e

echo "== Collect pm2 logs (may prompt for sudo) =="
sudo pm2 logs ubnd-backend --lines 10000 --nostream > /tmp/pm2_ubnd_recent.log || true
sudo grep -n "\[uploadMiddleware\] Rejected file" /tmp/pm2_ubnd_recent.log | tee /tmp/upload_rejections_matches.log || true

echo "== Show deploy-local rejection log (if any) =="
sudo sed -n '1,200p' /root/ubndxanuicam_deploy/backend/tmp/upload_rejections.log || true

echo "== Show extracted pm2 matches =="
sed -n '1,200p' /tmp/upload_rejections_matches.log || true

exit ${CURL_EXIT}
