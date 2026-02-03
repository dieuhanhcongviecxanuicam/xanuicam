# Incident Notification Template

Use this template to notify the team about the repository history rewrite, forced push, and required actions.

Title: URGENT — Repo history rewritten and secrets rotated required

Body:

- Summary: On 2026-02-03 we discovered secrets in the repository history. A coordinated history purge was performed to remove the leaked files/blobs from git history and the cleaned history was force-pushed to `origin`.

- What happened:
  - Sensitive files (SSH keys, tokens, test scripts containing secrets) were present in git history.
  - We created backup refs (tags/branches) before rewriting history.
  - We ran a history purge and force-pushed cleaned branches/tags to `origin`.

- Required immediate actions for all contributors:
  1. Re-clone the repository or hard-reset your local clones:

     git clone git@github.com:dieuhanhcongviecxanuicam/xanuicam.git

     OR

     git fetch origin
     git checkout main
     git reset --hard origin/main

  2. Rotate any keys or tokens you control and were used by the project (follow `docs/ROTATION_ACTIONS.md`).
  3. If you have local branches with unpushed work, create patches (`git format-patch`) before resetting, then reapply after re-clone.

- Where to find evidence and backups:
  - Backup branches/tags were pushed with names starting `backup-before-*`.
  - Scan reports & artifacts: `tmp-security-scan/` in the repository (do not commit these elsewhere).
  - Local secure backups of removed files: `~/.local/xanuicam-secrets-2026-02-03/`

- Contact & escalation:
  - <list team contacts / Slack channel / PagerDuty>

Add this as a GitHub issue or post in your team communication channels. I can also draft the issue body and open it as an issue if you provide a GitHub token/`gh` auth.
