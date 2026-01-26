#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 '<JWT>' [booking_id]"
  exit 1
fi

TOKEN="$1"
BOOKING_ID="${2:-17}"
OUTDIR=/root/ubndxanuicam_deploy/backend/tmp/collect_$(date +%s)
mkdir -p "$OUTDIR"

echo "[1/6] Prepare deploy tmp dir"
sudo mkdir -p /root/ubndxanuicam_deploy/backend/tmp || true
sudo chown -R www-data:www-data /root/ubndxanuicam_deploy/backend/tmp 2>/dev/null || true

echo "[2/6] Ensure backend deps & restart pm2"
cd /root/ubndxanuicam_deploy/backend || { echo "deploy dir missing"; exit 2; }
sudo npm ci --only=production || true
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

echo "[3/6] Create disallowed test file"
printf 'MALWARE' > /tmp/malware.exe
ls -l /tmp/malware.exe || true

echo "[4/6] Trigger upload (may return 415 expected)"
set +e
curl -s -o "$OUTDIR/curl_response.txt" -w "HTTP_STATUS:%{http_code}\n" -X PUT "https://www.xanuicam.vn/api/room-bookings/${BOOKING_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -F "attachments=@/tmp/malware.exe;type=application/x-msdownload" \
  -F "otherField=1"
CURL_EXIT=$?
set -e

echo "[5/6] Collect pm2 logs and extract uploadMiddleware lines"
sudo pm2 logs ubnd-backend --lines 10000 --nostream > /tmp/pm2_ubnd_recent.log || true
sudo cp /tmp/pm2_ubnd_recent.log "$OUTDIR/pm2_ubnd_recent.log" || true
sudo grep -n "\[uploadMiddleware\] Rejected file" /tmp/pm2_ubnd_recent.log | tee "$OUTDIR/upload_rejections_matches.log" || true

if [ -f /root/ubndxanuicam_deploy/backend/tmp/upload_rejections.log ]; then
  sudo cp /root/ubndxanuicam_deploy/backend/tmp/upload_rejections.log "$OUTDIR/upload_rejections.log" || true
fi

echo "[6/6] Package results"
sudo chown -R "$USER":"$USER" "$OUTDIR" || true
tar -czf "/root/ubndxanuicam_deploy/backend/tmp/upload_collection_$(date +%s).tgz" -C "$(dirname "$OUTDIR")" "$(basename "$OUTDIR")"
PACKAGE="/root/ubndxanuicam_deploy/backend/tmp/upload_collection_*.tgz"
ls -l /root/ubndxanuicam_deploy/backend/tmp || true

echo "Done. Collected files in $OUTDIR and packaged to /root/ubndxanuicam_deploy/backend/tmp/"
if [ -f "$OUTDIR/upload_rejections_matches.log" ]; then
  echo "--- Sample matches ---"
  sed -n '1,200p' "$OUTDIR/upload_rejections_matches.log"
fi

exit ${CURL_EXIT}
