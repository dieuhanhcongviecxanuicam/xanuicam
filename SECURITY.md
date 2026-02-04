# Security & Remediation Guidance

This repository contains remediation artifacts and instructions for safely handling secrets discovered in the history.

Quick guidance for maintainers:

- Do NOT paste secrets or tokens into issues or PRs.
- If a secret is discovered in the working tree, remove it, move the secret file to a secure vault, and commit the removal on a remediation branch.
- For secrets in history, create and verify a rewritten repository (bundle) locally before any force-push to origin. A rewritten bundle is available at `/home/nttsu/xanuicam-backups/xanuicam-rewritten.bundle` in the host environment.

High-level remediation steps (non-destructive first):

1. Create backups (done).
2. Remove tracked secrets from working tree and commit on a remediation branch (done).
3. Re-scan repository history and produce artifacts (done).
4. Prepare a rewritten repository bundle (done). Inspect bundle before any push.
5. Revoke exposed credentials (deploy keys, PATs) and rotate provider credentials. This requires admin privileges.
6. Only after rotation, force-push rewritten history to origin and notify downstream consumers.

If you are a repository admin and want assistance performing the revocation and push, export a short-lived admin token into the environment and follow the scripts in `scripts/`.
