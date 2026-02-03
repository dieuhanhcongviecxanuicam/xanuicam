# Admin: Revoke Deploy Keys & Rotate Exposed Credentials

This document contains the minimal, high-priority steps an admin should perform to close the remediation loop for the xanuicam repository after a secret exposure.

IMPORTANT: The automated agent attempted to delete deploy keys via the REST API but received HTTP 404 for the deploy-keys endpoint. That usually means the token used lacked the required repo-admin permission or the endpoint is blocked by org policy. An admin must perform the actions below.

## 1) Revoke Deploy Keys (UI)

1. Go to the repository: https://github.com/dieuhanhcongviecxanuicam/xanuicam
2. Click `Settings` → `Deploy keys` (left sidebar).
3. For each listed key:
   - Compare the public key or fingerprint with the fingerprints provided below.
   - If it matches any fingerprint listed, click `Delete` (trash) and confirm.

Local backup fingerprints (from agent):

```
cloudflare-origin.pem   sha256:8693ea5a7479b69ab211d9e3a00f697d78855c863728b6ddd8c5d3cf28ce2843
deploy_xanuicam_private.pem     sha256:d5cb7749b5ec242be1b48ea81a2491fadd4b4379c0201b3dc40a85a895c63b93
deploy_xanuicam_public.pem      sha256:3f5166d2d957a74c2a36da8ea5a351a5cb85b91039b6798d6b553aa52ea87a8b
server.key      sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

If a key in the UI shows the same public key material or the same ssh-keygen fingerprint, delete it immediately.

## 2) Revoke/Rotate Affected Provider Credentials

- Cloudflare origin certificates: Revoke old certs and re-generate origin certs. Replace new origin certs on servers and in Cloudflare dashboard.
- Server TLS private keys (`server.key`): Replace TLS cert/key pairs on production servers and update reverse proxies/load balancers.
- GitHub Actions / CI secrets: Rotate any secrets stored under `Settings → Secrets & variables → Actions` used by deployment workflows (tokens, API keys).
- Any PATs / service account tokens: Revoke and re-issue in provider consoles.

## 3) GitHub Deploy Keys via API (admin-only)

If you have an admin-scoped token, you can enumerate and delete keys via the API. Example (replace `GHTOKEN`):

```bash
GHTOKEN="<ADMIN_TOKEN>"
OWNER="dieuhanhcongviecxanuicam"
REPO="xanuicam"

# list keys
curl -H "Authorization: token ${GHTOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${REPO}/keys"

# delete key by id
curl -X DELETE -H "Authorization: token ${GHTOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${REPO}/keys/<KEY_ID>"
```

Note: If the list call returns 404, the token does not have permission to manage deploy keys for that repo.

## 4) Post-Rotation Verification

1. Re-run a full-history secret scan (gitleaks) and confirm `tmp-security-scan/gitleaks-final.json` is an empty array.
2. Confirm GitHub Actions jobs (secret-scan, semgrep, CI) run successfully and show `conclusion: success` on the latest `main` run.
3. Confirm deployment (staging/production) uses rotated credentials and services accept new keys.

## 5) If you want me to continue automated cleanup

- Grant a user or token `repo` + `admin:org`/repo-admin privileges (temporary) and I will re-run deploy-key enumeration and delete matched keys.
- Alternatively, perform UI deletions above and tell me to re-run verification scans; I will re-run gitleaks and confirm cleanliness.

---
File created by automated remediation agent. Local artifacts: `tmp-security-scan/*`, `/home/nttsu/.local/xanuicam-secrets-2026-02-03/`, `/tmp/xanuicam-github-ops/`.
