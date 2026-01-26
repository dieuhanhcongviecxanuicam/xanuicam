#!/usr/bin/env bash
# Deploy helper: install cloudflared config and systemd service
# Usage: run as root on server where cloudflared binary is /usr/local/bin/cloudflared
# Expects: TUNNEL_ID, CREDENTIALS_JSON (path)

TUNNEL=${TUNNEL_ID:-}
CRED=${CREDENTIALS_JSON:-}
CFGDIR=/etc/cloudflared
mkdir -p "$CFGDIR/.cloudflared" "$CFGDIR/.certs"
if [ -n "$CRED" ]; then
  cp -a "$CRED" "$CFGDIR/.cloudflared/" || true
  chmod 640 "$CFGDIR/.cloudflared/$(basename "$CRED")" || true
fi
if [ -n "$TUNNEL" ]; then
  cat > "$CFGDIR/config.yml" <<YML
# Managed config

tunnel: $TUNNEL
credentials-file: /etc/cloudflared/.cloudflared/$(basename "$CRED")

ingress:
  - hostname: xanuicam.vn
    service: http://localhost:5000
  - hostname: www.xanuicam.vn
    service: http://localhost:5000
  - service: http_status:404

originRequest:
  originServerName: localhost
  caPool: /etc/cloudflared/.certs/cloudflare-origin.pem
YML
  chmod 644 "$CFGDIR/config.yml"
fi
# systemd unit
cat > /etc/systemd/system/cloudflared.service <<UNIT
[Unit]
Description=cloudflared tunnel
After=network.target

[Service]
Type=simple
Restart=on-failure
ExecStart=/usr/local/bin/cloudflared --config /etc/cloudflared/config.yml tunnel run $TUNNEL
KillMode=process

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now cloudflared || true
