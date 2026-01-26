#!/usr/bin/env bash
set -euo pipefail

# scripts/push_build_to_all.sh
# Sync local frontend/build to multiple deploy targets and optionally purge Cloudflare.
# Usage:
#   ./scripts/push_build_to_all.sh [SSH_PORT] [SSH_KEY] [--purge-cf]
# Examples:
#   ./scripts/push_build_to_all.sh           # prompt for password, port 22
#   ./scripts/push_build_to_all.sh 22        # explicit port
#   ./scripts/push_build_to_all.sh 22 /path/to/key  # use key file
#   CF_API_TOKEN=... ./scripts/push_build_to_all.sh 22 /path/to/key --purge-cf

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUSH_SCRIPT="$ROOT_DIR/scripts/push_build_to_server.sh"
PURGE_SCRIPT="$ROOT_DIR/scripts/purge_cloudflare_cache.sh"

PORT=${1:-22}
KEY=${2:-}
PURGE_FLAG=${3:-}

DEFAULT_TARGETS=(
  "root@27.71.29.69:/var/www/xanuicam"
  "root@27.71.29.69:/root/ubndxanuicam_deploy"
)

if [ ! -x "$PUSH_SCRIPT" ]; then
  echo "Required script not found or not executable: $PUSH_SCRIPT" >&2
  exit 2
fi

if [ ! -d "$ROOT_DIR/frontend/build" ]; then
  echo "Local frontend build not found. Run 'npm run build' in frontend first." >&2
  exit 3
fi

FAILURES=0
for t in "${DEFAULT_TARGETS[@]}"; do
  echo "\n=== Sync to: $t ==="
  if [ -n "$KEY" ]; then
    "$PUSH_SCRIPT" "$t" "$PORT" "$KEY" || { echo "Sync to $t failed" >&2; FAILURES=$((FAILURES+1)); }
  else
    "$PUSH_SCRIPT" "$t" "$PORT" || { echo "Sync to $t failed" >&2; FAILURES=$((FAILURES+1)); }
  fi
done

echo "\nSync finished. $FAILURES target(s) failed." 

if [ "$PURGE_FLAG" = "--purge-cf" ] || [ -n "${CF_API_TOKEN:-}" ]; then
  if [ -x "$PURGE_SCRIPT" ]; then
    echo "Purging Cloudflare cache for xanuicam.vn..."
    if [ -n "${CF_API_TOKEN:-}" ]; then
      export CF_API_TOKEN
    fi
    "$PURGE_SCRIPT" xanuicam.vn || echo "Cloudflare purge failed" >&2
  else
    echo "Purge script not found: $PURGE_SCRIPT" >&2
  fi
fi

if [ "$FAILURES" -ne 0 ]; then
  echo "Some syncs failed. Inspect output above." >&2
  exit 4
fi

echo "All targets synced successfully." 

exit 0
