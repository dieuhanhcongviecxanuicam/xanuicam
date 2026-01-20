# Deployment and CI/CD Guidance

This document describes how to securely deploy `xanuicam` from GitHub to your Viettel IDC server using GitHub Actions and an SSH-based deployment workflow. Do NOT store secrets or .env files in the repository — use GitHub repository secrets.

Required repository secrets (Repository Settings > Secrets and variables > Actions):
- `DEPLOY_SSH_KEY` : private SSH key (PEM) for the deployment user on the server
- `DEPLOY_HOST` : server public host or private hostname reachable via tunnel
- `DEPLOY_USER` : deployment user name (e.g., `deploy`)
- `DEPLOY_PORT` : SSH port (default 22)
- `DEPLOY_PATH` : directory on the server where repo is checked out (e.g., `/var/www/xanuicam`)

Optional secrets for Cloudflare Tunnel (if used):
- `CLOUDFLARE_TUNNEL_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` — used if you want Actions to open a tunnel or coordinate with Cloudflare. We recommend running cloudflared on the server as a service and not storing long-lived credentials in Actions.

Workflow notes:
- `ci-check.yml` runs on `develop` and pull requests to `main`/`develop` for lint and tests.
- `deploy.yml` runs on pushes to `main` and connects to the server via SSH to pull and restart the app. It relies on the secrets above.

Cloudflare Tunnel recommendation:
- For improved security, run `cloudflared` on the target server and create a named tunnel. Restrict SSH access so only the GitHub Actions runner or the tunnel endpoint can reach the server's SSH port.
- Do NOT commit `my-tunnel-config.json` or any credentials to the repository. Add `.cloudflared/` to `.gitignore` (already ignored in this repo).

Branching strategy:
- `main` : production stable releases only. Deploys automatically via `deploy.yml`.
- `develop` : integration branch for features and fixes.
- `feature/*` : short-lived feature branches created from `develop`.
- `hotfix/*` : short-lived branches created from `main` for urgent fixes; merge back into `main` and `develop`.

Security checklist before first push:
- Ensure `.gitignore` contains `.env`, private keys, and other sensitive files (this repo already includes many entries).
- Remove any hard-coded credentials from source before pushing. Use `git rm --cached` to untrack if needed.
- Configure GitHub Actions secrets and restrict repository access.
