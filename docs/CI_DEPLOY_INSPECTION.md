CI Deploy Inspection - quick findings

What I checked:
- Read `.github/workflows/deploy.yml`, `deploy-to-server.yml`, `build-and-deploy.yml`, and `frontend-ci.yml`.

Likely causes for deploy failures (actions to verify):

- Missing repository secrets used by deploy workflows:
  - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `DEPLOY_PORT` — if any are not configured, SSH deploy will fail.
- SSH action compatibility / key format:
  - The workflow uses `appleboy/ssh-action@v0.1.8`. Ensure the `DEPLOY_SSH_KEY` is a valid private key (no leading/trailing whitespace) and that the remote server accepts the public key.
- Permissions / token scopes:
  - Some workflows (secret-scan) require `GITHUB_TOKEN` with proper permissions; ensure repository settings allow the workflow to access required scopes.
- Frontend build failures:
  - `frontend-ci.yml` runs `npm ci --prefix frontend --legacy-peer-deps`. If `frontend/package.json` or lockfile mismatches, CI may fail. You already fixed a missing dependency (`@sentry/*`) earlier.
- Environment differences:
  - Workflows set `node-version: 20` — ensure any native modules or build tooling support Node 20.

Next steps I can take (pick or I can run all):
- Attempt to re-run the failing workflow locally via `act` (requires installation) or provide exact Actions logs if you grant access.
- Validate that the required secrets are present and correctly formatted by printing a redacted list of expected secrets (I will not print values).
- Suggest changes to make deploy more robust: switch to `appleboy/ssh-action@v0.1.7` or the latest, add deploy sanity checks, or switch to `rsync`-based artifact deploy.

If you want me to continue I can either:
- (A) Try a local dry-run using `act` (I will need `act` installed), or
- (B) Parse specific Actions run logs if you paste them here, or
- (C) Apply suggested robustness changes to `deploy.yml` (e.g., add `timeout`, validate secrets at start).

