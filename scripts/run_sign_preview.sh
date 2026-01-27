#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/run_sign_preview.sh <TOKEN> <UPLOAD_PATH>
TOKEN="$1"
UPLOAD_PATH="$2"
if [ -z "${TOKEN:-}" ] || [ -z "${UPLOAD_PATH:-}" ]; then
  echo "Usage: $0 '<Bearer_or_token>' 'uploads/meeting_docs/your-file.docx'"
  exit 1
fi
RESP=$(curl -s -X POST 'https://www.xanuicam.vn/api/room-bookings/attachments/sign-preview' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"path":"'"$UPLOAD_PATH"'"}')
RESP2=$(printf "%s" "$RESP" | tr -d '\r\n')
URL=$(printf "%s" "$RESP2" | sed -n 's/.*"url"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [ -z "$URL" ]; then
  echo "sign-preview response did not include url. full response:\n$RESP"
  exit 2
fi
FULL_URL="https://www.xanuicam.vn$URL"
echo "Public URL: $FULL_URL"
echo "--- HEAD response ---"
curl -I -s "$FULL_URL" | sed -n '1,20p'

echo "--- GET (first 10240 bytes) ---"
curl -s "$FULL_URL" | head -c 10240 || true
