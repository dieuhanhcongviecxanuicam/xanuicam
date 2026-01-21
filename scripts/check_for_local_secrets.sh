#!/usr/bin/env bash
set -euo pipefail

echo "Checking repository for local secret files..."
FOUND=0
for f in \
  gh_deploy_key gh_deploy_key.pub gh_deploy_key.pub.pub \
  .secrets/deploy_key .secrets/*key id_rsa id_ed25519 private.key server.key; do
  if [ -e "$f" ]; then
    echo "WARNING: local secret file present: $f"
    FOUND=1
  fi
done

if [ $FOUND -eq 1 ]; then
  echo "Remove or move these secret files outside the repository before pushing."
  exit 1
fi

echo "No obvious local secret files found."
