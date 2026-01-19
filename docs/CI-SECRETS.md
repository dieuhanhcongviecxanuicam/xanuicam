# GitHub Actions Secrets (required)

Create the following repository secrets in GitHub (Settings → Secrets & variables → Actions):

- `PROD_HOST` : Server IP or hostname (e.g., 27.71.29.69)
- `PROD_USER` : SSH user (e.g., root or deploy user)
- `PROD_SSH_KEY` : Private key for SSH (paste content of generated private key)
- `PROD_SSH_PORT` : Optional SSH port (default 22)
- `PROD_DEPLOY_PATH` : Target path on server where frontend/build will be copied (e.g., /root/ubndxanuicam_deploy/frontend/build)
- `E2E_USER` / `E2E_PASS` : Optional credentials used by E2E tests (only if running e2e workflow)
- `CF_API_TOKEN` : Optional Cloudflare API token (only if workflows need Cloudflare updates)

Notes:
- Do NOT commit secrets into the repository. Use the GitHub UI or GitHub API to add them.
- If you prefer using a deploy key (recommended for SSH), generate it with `deploy/generate_deploy_key.sh`, add the public key to the repo Deploy Keys, and add the private key to `PROD_SSH_KEY`.
