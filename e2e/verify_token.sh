#!/bin/bash
# Simple token verification helper for Cloudflare API token
if [ -z "$1" ]; then
  echo "Usage: $0 <api-token>"
  exit 1
fi
curl -s -H "Authorization: Bearer $1" "https://api.cloudflare.com/client/v4/user/tokens/verify" | jq .
