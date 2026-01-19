#!/usr/bin/env bash
set -euo pipefail

echo "== Socket and listening ports =="
ss -ltnp || true

echo "== Node / PM2 processes =="
ps aux | egrep 'node|pm2' --color=never || true

echo "== Probe backend on localhost:5000 =="
curl -vS --max-time 10 http://127.0.0.1:5000/ || true

echo "== cloudflared status (systemd) =="
if command -v systemctl >/dev/null 2>&1; then
  systemctl status cloudflared --no-pager || true
  journalctl -u cloudflared -n 200 --no-pager || true
else
  echo "systemctl not available"
fi

echo "== cloudflared tunnel list (if installed) =="
if command -v cloudflared >/dev/null 2>&1; then
  cloudflared tunnel list || true
else
  echo "cloudflared not found in PATH"
fi

echo "== End diagnostics =="
