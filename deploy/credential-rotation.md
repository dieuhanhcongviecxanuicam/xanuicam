Credential Rotation Checklist

- **Scope:** List all credentials possibly affected (GitHub deploy keys, PATs, cloud provider keys, third-party API keys).
- **Immediate actions:**
  - Revoke any exposed deploy keys and generate new SSH deploy keys.
  - Revoke any GitHub PATs suspected of exposure; create minimal-scope tokens as replacements.
  - Rotate cloud provider keys (AWS/GCP/Azure) and update secrets in GitHub Actions.
  - Replace any CI secrets referenced in `.github/workflows` via repository Settings → Secrets.
- **Repository changes:**
  - Do NOT perform history rewrite until credentials rotated and stakeholders notified.
  - If history rewrite required: create a backup clone, run `git filter-repo` or BFG, verify with gitleaks, then push to a protected branch and coordinate force-push.
- **Verification:**
  - Re-run `gitleaks` and other scanners across full history.
  - Confirm CI runs succeed with new secrets.
- **Post-rotation:**
  - Update documentation with new owners and rotation schedule.
  - Add automated secret-scanning and branch protection checks.

Commands (examples):

- Generate new SSH key (local):

```bash
ssh-keygen -t ed25519 -C "deploy@yourorg" -f /tmp/deploy_key -N ""
# copy /tmp/deploy_key.pub to server authorized_keys or GitHub deploy key
```

- Revoke GitHub token:

```bash
# via web UI: Settings -> Developer settings -> Personal access tokens
# Or via GitHub API (requires admin access)
```

- Run gitleaks locally via Docker:

```bash
mkdir -p /tmp/xanuicam/tmp-security-scan
docker run --rm -v $(pwd):/repo zricethezav/gitleaks:latest detect --source /repo --report-path /repo/tmp-security-scan/gitleaks-final.json --report-format json
```

Contact the team owners for each credential during rotation; ensure a rollback plan exists.
