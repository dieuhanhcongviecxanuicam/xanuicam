# Credential Rotation Actions (prepared)

This document lists the specific credentials and recommended rotation steps derived from the gitleaks findings. It does NOT contain secrets — only actions you must take.

Affected files (found in repo history):
- `id_rsa_github` / `id_rsa_github.pub` — private/public SSH keys
- `scripts/pr_auto_merge_watch.py` — contains a GitHub Personal Access Token (PAT)
- `backend/tmp_generate_token.js` — contains an application secret value used for tokens
- `backend/test_login_admin.out` — contains a JWT
- Test scripts under `backend/scripts/` and `e2e/` (`run_export_bulk_test.js`, `run_tasks_export_test.js`, `test_export_decrypted.js`, `test_login_admin.js`, `e2e/run_upload_smoke_test.js`, `e2e/run_upload_test.ps1`) — contain API-like tokens / credentials

High level priority (do these now):
1. Revoke any leaked GitHub PATs and SSH deploy keys.
2. Revoke and re-issue any API tokens used by test scripts or apps.
3. Re-issue JWT signing secrets / rotate keys used by auth services.
4. Replace secrets in CI (GitHub Actions Secrets) and deployment environments.
5. Verify the repo history is clean (re-run gitleaks) and confirm CI builds.

Detailed steps

1) GitHub tokens / PATs:
   - Revoke the PAT(s) found in `scripts/pr_auto_merge_watch.py` via GitHub Settings → Developer settings → Personal access tokens (or Organization where token was created).
   - If token was used by automation, create a new token with least privileges and update any CI config or service that used it.
   - If the token belonged to a machine user, rotate credentials for that account and rotate any associated SSH keys.

2) SSH keys (`id_rsa_github`):
   - Remove any Deploy keys on repositories or in the org that match the leaked public key.
   - Generate a new key on a secure machine:
     ssh-keygen -t ed25519 -C "deploy@<org>" -f ~/.ssh/id_deploy_xanuicam
   - Add the new public key to repository deploy keys or CI host (with restricted write/push rights as needed).

3) Application and API tokens (test scripts & tmp secrets):
   - For each API token found in `backend/scripts/*` and `e2e/*`:
     - Revoke the token in the provider console.
     - Create a new token with minimal permissions.
     - Update GitHub Actions Secrets (or other vault) with the new token value.
     - Update server env vars and restart services using them.

4) JWT / signing secrets:
   - Rotate JWT signing keys or secrets in your auth service.
   - Issue new tokens for services that rely on the signing key.
   - Revoke or expire long-lived tokens if supported by your auth provider.

5) CI & deployment updates:
   - Update GitHub Actions Secrets: `Settings -> Secrets and variables -> Actions`.
   - Do NOT store secrets in repo files; use secrets or vaults.

6) Verification and monitoring:
   - Re-run gitleaks locally or in CI against the repository and history to confirm no secrets remain.
   - Monitor logs and access control dashboards for suspicious activity during and after rotation.

Notes and suggested commands

- Revoke a GitHub PAT (manual via UI) — if you have `gh` CLI and permissions:
  gh auth logout --hostname github.com
  gh api --method DELETE /authorizations/<id>

- Add a GitHub Actions secret (example):
  gh secret set MY_API_KEY --body "<new-secret>" --repo dieuhanhcongviecxanuicam/xanuicam

- Generate a new SSH key (example):
  ssh-keygen -t ed25519 -C "deploy@xanuicam" -f ~/.ssh/id_deploy_xanuicam

If you want, I can produce a per-findings rotation checklist with exact filenames, suggested owners, and sample revoke URLs for common providers (GitHub, Cloudflare, AWS, etc.).
