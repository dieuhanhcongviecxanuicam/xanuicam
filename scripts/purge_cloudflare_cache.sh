#!/usr/bin/env bash
set -euo pipefail

# Purge Cloudflare cache for given zone using API token
# Required environment variables: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN

if [ -z "${CLOUDFLARE_ZONE_ID:-}" ] || [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "Set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN environment variables." >&2
  exit 2
fi

echo 'Purging Cloudflare cache (all files)'
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}' | jq .

echo 'Cloudflare purge requested.'
