# Notification Messages

This file contains ready-to-send templates (Slack and email) to inform the team about the history rewrite and required rotation steps.

Slack (short):
---------------------------------
URGENT: The repository history was rewritten to remove leaked secrets. All contributors must re-clone the repo or reset hard to `origin/main` and rotate any credentials they own. See `docs/INCIDENT_NOTIFICATION.md` and `docs/ROTATION_ACTIONS.md` for details.

Email (detailed):
---------------------------------
Subject: URGENT: Repo history rewrite & credential rotation required

Body:
Team,

We discovered secrets in the repository history and performed a history purge (force-push) to remove leaked files/blobs. Backups were created and are available (tags/branches starting with `backup-before-*`).

Immediate actions required:
1. Re-clone or hard reset your local clones to `origin/main`.
2. Follow `docs/ROTATION_ACTIONS.md` to revoke and rotate any credentials found (GitHub PATs, SSH keys, API tokens, JWT secrets).
3. Update CI secrets and deployment environments with new credentials.

For help or to report progress, reply in #devops or open an incident issue.

Thanks,
Security/DevOps
