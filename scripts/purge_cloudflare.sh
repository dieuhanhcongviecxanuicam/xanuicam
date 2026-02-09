#!/usr/bin/env bash
set -euo pipefail

# Minimal Cloudflare purge helper
# Usage: CF_API_TOKEN=... CF_ZONE_ID=... ./scripts/purge_cloudflare.sh --files url1 url2

show_help(){
  cat <<EOF
Usage: $0 [--zone ZONE_ID] [--token TOKEN] [--files url1 url2 ...] [--all]
  --zone ZONE_ID    Cloudflare Zone ID (or env CF_ZONE_ID)
  --token TOKEN     Cloudflare API Token (or env CF_API_TOKEN)
  --files ...       List of URLs to purge
  --all             Purge everything for the zone
EOF
}

ZONE_ID=${CF_ZONE_ID:-}
TOKEN=${CF_API_TOKEN:-}
FILES=()
PURGE_ALL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --zone) ZONE_ID="$2"; shift 2;;
    --token) TOKEN="$2"; shift 2;;
    --files) shift; while [[ $# -gt 0 ]] && [[ ! "$1" =~ ^-- ]]; do FILES+=("$1"); shift; done;;
    --all) PURGE_ALL=1; shift;;
    -h|--help) show_help; exit 0;;
    *) echo "Unknown arg: $1"; show_help; exit 2;;
  esac
done

if [ -z "$ZONE_ID" ] || [ -z "$TOKEN" ]; then
  echo "Zone ID and token are required (either env or flags)." >&2
  show_help
  exit 2
fi

if [ "$PURGE_ALL" -eq 1 ]; then
  echo "Purging entire zone: $ZONE_ID"
  curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' | jq -C '.' || true
  exit 0
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "No files specified and --all not set." >&2
  show_help
  exit 2
fi

echo "Purging ${#FILES[@]} files from zone $ZONE_ID"
payload=$(printf '%s\n' "${FILES[@]}" | jq -R -s -c 'split("\n")[:-1] | {files:.}')
curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  --data "$payload" | jq -C '.' || true
