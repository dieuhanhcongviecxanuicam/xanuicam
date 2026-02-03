# Rotation List (per-finding)

This file lists each leaked credential found in the repository history (gitleaks report) with suggested owner, revoke URL / action, and a priority.

NOTE: None of these actions are performed automatically by this repository; you must revoke/rotate them in the relevant provider consoles. The commands below are examples to help your operators.

Findings (extracted from `tmp-security-scan/gitleaks-post-purge-2.json`):

- `id_rsa_github` / `id_rsa_github.pub`
  - Type: SSH private/public key
  - Priority: High
  - Suggested owner: DevOps / Platform
  - Actions:
    1. Remove any Deploy keys or SSH keys on GitHub that match the leaked public key: https://github.com/<org>/<repo>/settings/keys or org-level keys.
    2. Generate a new key on a secure machine:
       ssh-keygen -t ed25519 -C "deploy@xanuicam" -f ~/.ssh/id_deploy_xanuicam
    3. Add new public key to repo deploy keys or CI with minimal permissions.

- `scripts/pr_auto_merge_watch.py` (contains GitHub PAT)
  - Type: GitHub Personal Access Token (PAT)
  - Priority: High
  - Suggested owner: Repo owner / automation owner
  - Actions:
    1. Revoke the PAT in GitHub: https://github.com/settings/tokens (or organization equivalent).
    2. If used by automation, create a new token with least privileges and update CI secrets.
    3. Inspect GitHub audit logs for suspicious API activity.

- `backend/tmp_generate_token.js` (application secret)
  - Type: App secret (token signing / symmetric secret)
  - Priority: High
  - Suggested owner: Backend lead / Security
  - Actions:
    1. Rotate the secret in the application configuration or secret store.
    2. Issue new tokens and invalidate old tokens where possible.
    3. Update CI/secrets managers accordingly.

- `backend/test_login_admin.out` (JWT)
  - Type: JWT token
  - Priority: High
  - Suggested owner: Backend lead
  - Actions:
    1. Revoke the JWT (if revocation supported) and rotate signing keys.
    2. Invalidate sessions and reissue credentials.

- Test scripts under `backend/scripts/` and `e2e/` (API-like tokens)
  - Files: `run_export_bulk_test.js`, `run_tasks_export_test.js`, `test_export_decrypted.js`, `test_login_admin.js`, `e2e/run_upload_smoke_test.js`, `e2e/run_upload_test.ps1`
  - Type: API tokens used by tests
  - Priority: Medium
  - Suggested owner: QA / Test automation owner
  - Actions:
    1. Revoke test tokens in provider consoles.
    2. Replace with ephemeral or environment-injected secrets in CI.

Verification steps (after rotation):
 - Re-run `tmp-security-scan/gitleaks-final.json` or run `gitleaks` in CI.
 - Confirm no active tokens exist matching rotated values.
 - Monitor logs for anomalous usage.

If you want, I can map each finding to a sample revoke URL for common providers (GitHub, Cloudflare, AWS). Reply `map-providers` to generate that mapping.
