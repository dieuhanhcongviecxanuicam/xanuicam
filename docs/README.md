# Docs: Server & DNS (Viettel IDC / Cloudflare)

- Do NOT store secrets in the repo. Use GitHub Actions Secrets (Settings > Secrets) for:
  - `PROD_HOST`, `PROD_USER`, `PROD_SSH_KEY`, `PROD_SSH_PORT`
  - `CF_API_TOKEN` for Cloudflare operations if needed

- Basic deploy steps (when connecting over SSH):
  1. SSH to server: `ssh root@<PROD_HOST>`
  2. `cd /root/ubndxanuicam_deploy`
  3. `git fetch --all && git reset --hard origin/main`
  4. Install backend deps: `npm --prefix backend install --production`
  5. Build frontend (if frontend source present): `npm --prefix frontend install && npm --prefix frontend run build`
  6. Restart pm2: `pm2 restart ubnd-backend || pm2 start backend/ecosystem.config.js`

- Cloudflare DNS / Tunnel notes:
  - Tunnel credentials should never be committed. Store Cloudflare tokens/secrets in GitHub Secrets and on the server in `/etc/cloudflared`.
  - For DNS, point apex and `www` to the tunnel CNAME (e.g. `<TUNNEL_ID>.cfargotunnel.com`).

