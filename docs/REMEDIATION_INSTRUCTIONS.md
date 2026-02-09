# Remediation Instructions (for admins)

This file describes safe steps to finish remediation with minimal risk and downtime.

Prereqs:
- Admin-scoped `GITHUB_TOKEN` (store in environment; do NOT paste into chat).
- Admin access to provider consoles (Cloudflare, CI, hosting) to rotate keys.
- SSH access or CI to perform force-push if desired.

Steps:

1) Revoke deploy keys and short-lived PATs

  - Use the prepared script: `scripts/revoke_deploy_keys.sh`
  - Example (local shell):

    ```bash
    export GITHUB_TOKEN=ghp_...
    bash scripts/revoke_deploy_keys.sh
    ```

  - The script will list repository deploy keys and attempt to delete any matching fingerprints.

2) Rotate provider credentials

  - Rotate Cloudflare tunnels, origin certs, TLS keys, and any CI secrets that may have been exposed.
  - Update CI secrets and environment variables with new values.

3) Verify rotation

  - Confirm revoked keys no longer function.
  - Re-run `gitleaks` on the origin repo to ensure no further leaks.

4) Push rewritten history (destructive)

  - Inspect `/home/nttsu/xanuicam-backups/xanuicam-rewritten.bundle` thoroughly locally.
  - If approved and after rotation, force-push rewritten history:

    ```bash
    git clone /home/nttsu/xanuicam-backups/xanuicam-rewritten.bundle rewritten-inspect
    cd rewritten-inspect
    git remote add origin git@github.com:dieuhanhcongviecxanuicam/xanuicam.git
    git push --force origin --all
    git push --force origin --tags
    ```

  - Notify all collaborators and document the rotation and forced history rewrite in the project issue tracker.

5) Post-remediation

  - Re-run secret scans and CI.
  - Update `SECURITY.md` and close the remediation issue.
