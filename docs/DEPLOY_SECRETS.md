# Deploy and Secrets for xanuicam

Required GitHub repository secrets (set in Settings → Secrets):

- `DEPLOY_HOST` — server IP or hostname for SSH deploy.
- `DEPLOY_USER` — SSH username used for deployment (e.g., `deploy`).
- `DEPLOY_SSH_KEY` — private SSH key (PEM/OpenSSH) used by CI to SSH to server. Keep this secret.
- `DEPLOY_PATH` — absolute path to the repo on the server (where `git reset --hard origin/main` will run).
- `DEPLOY_PORT` — optional SSH port (default 22).

How to install a private key on GitHub Secrets (recommended):

1. Create a machine user or deployment user on the target server and add your public key to `~/.ssh/authorized_keys` on the server.
2. Copy the private key (PEM/OpenSSH) contents and add it to the `DEPLOY_SSH_KEY` secret.
3. Do NOT commit private keys or place them inside the repository. Store keys in `~/.ssh/` on your local machine or a secrets manager.

Local key clean-up performed by automation:
- Local files matching `gh_deploy_key`, `gh_deploy_key.pub`, and `.secrets/deploy_key` have been moved to `~/.ssh/xanuicam_keys` and permissions set to `600` to avoid accidental commits.

CI notes:
- The deploy workflow uses the `appleboy/ssh-action` to SSH into the server and run `git reset --hard origin/main` then `npm ci --production` and restarts `pm2` if available.
- Ensure `DEPLOY_PATH` points to the repository clone on the server and that the server has proper Git remote configuration.
