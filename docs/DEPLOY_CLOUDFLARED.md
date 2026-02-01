## Deploying and managing Cloudflared ingress

This document describes how to update the Cloudflare Tunnel ingress for xanuicam and fallbacks.

1) Preferred: Cloudflare Dashboard
- Log in to the Cloudflare account used for the tunnel.
- Navigate to Zero Trust / Tunnels / (your tunnel) and open the "Configuration" or "Ingress" editing view.
- Edit the host → origin mappings to:
  - www.xanuicam.vn -> http://127.0.0.1:5000
  - xanuicam.vn -> http://127.0.0.1:5000
  - dev.xanuicam.vn -> http://127.0.0.1:5001
- Save changes and verify the tunnel agent reconnects.

2) Programmatic update (if API access with required scopes available)
- Use an account API key that supports cfd_tunnel/configurations update operations or an API token with the correct scopes.
- The repo contains deploy/cloudflare_ingress.json — this is the canonical payload shape used for local config. Use Cloudflare API endpoints documented in Cloudflare's "Tunnels" API to PATCH the configuration for the tunnel ID.
- If API calls return 405/404/400, check token scopes and prefer the Dashboard UI.

3) Local fallback (already applied)
- The instance maintains /etc/cloudflared/config.yml which is currently configured with the desired ingress mapping.
- If the control-plane repeatedly overwrites the mapping, keeping the local config is a practical fallback because the local cloudflared service will read it on restart.

4) Verification
- Check sudo journalctl -u cloudflared -n 200 --no-pager for "Updated to new configuration" messages and the ingress content.
- Use the CLI monitor: /usr/local/bin/cloudflared_monitor.sh (installed as a systemd timer) which writes to /var/log/cloudflared_monitor.log.

5) Rollback
- If an ingress change breaks routing, revert either via the Dashboard or restore the previous /etc/cloudflared/config.yml backup made in /etc/cloudflared/config.yml.bak and restart the service: sudo systemctl restart cloudflared.

6) Credentials
- Never commit API keys. Store credentials in a local .secrets/cloudflare_credentials.env file with mode 600 and owner root.

7) Runbook notes
- After updating the Dashboard or API, allow up to a minute for the agent to reconnect. If connections are not established, check the agent logs and file ownership of /etc/cloudflared/config.yml.

8) Contacts
- If the tunnel is managed by another team or Cloudflare support is needed, escalate with the tunnel ID: 03d94abc-9b35-4c56-a37c-e123810b412e.
