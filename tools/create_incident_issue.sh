#!/usr/bin/env bash
set -euo pipefail

cat <<'EOF'
This script creates an incident issue on GitHub using the `gh` CLI.

Usage:
  GITHUB_REPO="dieuhanhcongviecxanuicam/xanuicam" ./tools/create_incident_issue.sh

Requires: `gh` CLI authenticated (`gh auth login`) and permission to create issues on the repository.
EOF

REPO=${GITHUB_REPO:-"dieuhanhcongviecxanuicam/xanuicam"}
TITLE="URGENT — Repo history rewritten; rotate credentials and re-clone"
BODY_FILE="/tmp/incident_body.md"

cat > "$BODY_FILE" <<'BODY'
Summary:

On 2026-02-03 the repository history was cleaned to remove leaked secrets and a force-push was performed. Backup refs were created and pushed (backup-before-* tags/branches).

Required actions for all contributors:
1. Re-clone the repository or reset local clones to `origin/main`.
2. Rotate leaked credentials per `docs/ROTATION_ACTIONS.md`.
3. Verify CI and deployments after rotation.

Artifacts:
- tmp-security-scan/* (scan reports)
- backup-before-* tags/branches on the repo.

Contact: @devops-team
BODY

echo "Creating issue on $REPO..."
gh issue create --repo "$REPO" --title "$TITLE" --body-file "$BODY_FILE"
