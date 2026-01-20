# Deployment notes and Cloud Server info

This file documents the cloud server details and how to obtain the database connection string for `backend/.env`.

**Cloud server (provided)**
- Domain: xanuicam.vn
- IP: 27.71.29.69
- User: root
- OS: Ubuntu Server 25.04 LTS

Do NOT commit secrets (passwords, private keys) to the repository. Use SSH keys or CI secrets.

## SSH deploy helper
The script `scripts/deploy_via_ssh.sh` defaults to the provided server and path. You can override with environment variables:

```
DEPLOY_HOST=27.71.29.69 DEPLOY_USER=root DEPLOY_PATH=/var/www/xanuicam SSH_KEY=~/.ssh/id_rsa ./scripts/deploy_via_ssh.sh
```

The script will rsync `frontend/build/` to the server and then attempt to restart the backend (via `pm2` or `systemd`).

## Database connection string (what it looks like)
- PostgreSQL connection URI format (recommended):

```
postgres://<db_user>:<db_password>@<host>:<port>/<database_name>
```

Examples:
- Local Postgres on server, DB `ubndx`: `postgres://ubndx_user:secretpass@localhost:5432/ubndx`
- Remote DB: `postgres://app_user:secret@db.example.com:5432/ubndx`

## Where to get the real DB credentials
1. If the database is running on the cloud server itself (common):
   - SSH to the server: `ssh root@27.71.29.69` (use your SSH key).
   - Check for Docker compose or environment files: `ls /var/www/xanuicam` or `cat /etc/systemd/system/*.service` or `docker-compose.yml`.
   - If Postgres is installed directly, list DB users/databases via `sudo -u postgres psql -c "\du"` and `sudo -u postgres psql -c "\l"`.
   - To create a user and DB (if needed):

```
sudo -u postgres createuser -P app_user
sudo -u postgres createdb -O app_user ubndx
```

   - That creates a username and password you can use in `DATABASE_URL`.

2. If the DB is managed separately (RDS, Cloud DB):
   - Ask your DBA or check the cloud provider dashboard for the connection string and SSL requirements.

3. If the app is containerized: check `docker-compose.yml` or container env vars for `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and host/port mapping.

## How to add the DB string into `backend/.env`
Open `backend/.env` and replace the placeholder line:

```
DATABASE_URL=postgres://REPLACE_USER:REPLACE_PASS@REPLACE_HOST:5432/REPLACE_DB
```

with the real connection string. For example:

```
DATABASE_URL=postgres://app_user:secretpass@localhost:5432/ubndx
PGSSLMODE=disable
```

If your Postgres requires SSL you may need `PGSSLMODE=require` and proper certificate handling.

After updating `.env`, run migrations and restart backend:

```powershell
npm --prefix backend run migrate
npm --prefix backend start
```

If you want, provide the DB URI here and I will write it into `backend/.env` and run the migrations for you.
## Deployment & Architecture Guidance

This repository contains a backend (Express) and a React frontend.

Goals of the standardized workflow:
- Keep frontend and backend deployable independently.
- Avoid accidentally serving stale frontend builds during development.
- Provide a simple local deploy helper for production-like testing.

Key behaviours implemented:
- Backend will only serve `frontend/build` when either:
  - `NODE_ENV=production`, OR
  - `SERVE_FRONTEND=true` is set in the environment.
  This is controlled in `backend/server.js`.

Recommended workflows:

1) Development (hot-reload frontend)
- Remove or ignore `frontend/build` and run the frontend dev server:

```powershell
rmdir /s /q frontend\build
npm --prefix frontend start
npm --prefix backend start
```

2) Local production-like deploy (backend serves build)
- Use the provided deploy helper which builds the frontend, restarts backend:

```powershell
npm run deploy
# (runs scripts/deploy_frontend_and_restart_backend.ps1)
# Ensure you run in a PowerShell session with execution allowed.
```

3) Production recommendation
- Build frontend in CI and publish to a static host / CDN (S3, Netlify, Vercel, nginx).
- Backend should be deployed separately (PM2/systemd/Docker) and only act as API.
- If you must host SPA on backend, run backend with `NODE_ENV=production`.

Service worker & caching notes:
- If you see stale UI, unregister service workers in DevTools (Application → Service Workers) and clear cache.

If you'd like, I can:
- Add a simple CI workflow to build the frontend and publish artifacts.
- Create npm scripts to automate common tasks (build-and-serve, start-dev-all).
 
CI / GitHub Actions
-------------------

This repo now includes GitHub Actions workflows that build the frontend and produce an artifact (`.github/workflows/frontend-ci.yml`) and a manual deploy workflow that can publish the frontend to GitHub Pages (`.github/workflows/deploy-frontend-gh-pages.yml`).

Usage notes:
- On push to `main`/`master` the `frontend-ci` workflow will run and upload the `frontend/build` folder as an artifact named `frontend-build`.
- To publish to GitHub Pages run the `Deploy Frontend to GitHub Pages` workflow from the Actions tab (or call via API). Ensure `GH_PAGES_TOKEN` or `GITHUB_TOKEN` is available to allow pushing.

If you want, I can also add a small GitHub Actions workflow that triggers the backend deploy step after frontend build, or help wire this to your hosting provider's deploy API.

Secrets handling and recommended configuration
--------------------------------------------

- Never commit secrets into the repository. Use `/.env` locally and add `.env` to `.gitignore` (this repo already ignores `.env` and common private key patterns).
- Add important variables to GitHub Actions secrets (Repository Settings → Secrets):
  - `JWT_SECRET` (use a base64-encoded 64+ byte random secret for HS512)
  - `DATABASE_URL` or DB-specific secrets
  - `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_ACCOUNT_ID`
  - Any SSH deploy keys or cloud credentials

-Example to generate a strong JWT secret locally (PowerShell example):

```powershell
$bytes = New-Object Byte[] 64; [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes); $secret = [Convert]::ToBase64String($bytes); $secret; $secret | Set-Clipboard
```

Then add the produced string to your `.env` as `JWT_SECRET=`. Do NOT paste into the repo or push it.

Generate secrets with included helpers
- ------------------------------------

Two helper scripts are added to generate JWT secrets locally without committing them:

- PowerShell: `scripts/generate_jwt_secret.ps1`
- POSIX shell: `scripts/generate_jwt_secret.sh`

Examples:

PowerShell (HS512, write to `.env`):

```powershell
.\scripts\generate_jwt_secret.ps1 -Algorithm HS512 -OutEnv .env
```

Shell (HS256, print only):

```bash
./scripts/generate_jwt_secret.sh HS256
```

Notes:

- The helper can optionally write the `JWT_SECRET` and `JWT_ALGORITHM` into a local `.env` file. Never commit `.env`.
- To use HS256 instead of HS512 set `JWT_ALGORITHM=HS256` in your environment or `.env`.

CI notes
--------
- The `frontend-ci` workflow uploads the compiled `frontend/build` as an artifact so other workflows can consume it. Use GitHub Secrets to store any deploy tokens and reference them in workflow files.
- If you want automated deploy to your Cloud Server, we can add a protected workflow that uses an SSH deploy key stored in GitHub Secrets to push the build and restart services on the server.

If you'd like, I can now add a sample deploy workflow that uses an SSH key (stored as secret `SSH_DEPLOY_KEY`) to rsync the `frontend/build` and restart backend via SSH on your cloud server. Confirm and I'll scaffold it (I will not write any private keys into the repo). 

Repository & clone URLs
----------------------

Use these to clone the repository:

- HTTPS: https://github.com/dieuhanhcongviecxanuicam/xanuicam.git
- SSH: git@github.com:dieuhanhcongviecxanuicam/xanuicam.git
- GitHub CLI: gh repo clone dieuhanhcongviecxanuicam/xanuicam

Cloudflared and edge tunnelling notes
------------------------------------

Do NOT commit Cloudflared credentials or tokens. Create a local `.cloudflared/config.yml` on the server with values from Cloudflare and keep the directory out of git. Example template added as `.cloudflared/config.example.yml` in this repo. The example file contains placeholders for `tunnel`, `credentials-file`, and `ingress` configuration.

If you use `cloudflared service install` to register a service, keep the generated files on the server and treat them as sensitive secrets.

