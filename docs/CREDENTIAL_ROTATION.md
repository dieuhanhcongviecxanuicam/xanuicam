# Credential Rotation Checklist

This document lists credentials and recommended rotation steps after secrets were found in the repository history. Do NOT run destructive history-rewrites or rotate keys without coordinating with the team and service owners.

## Summary of findings (from gitleaks scan)
- Tracked test files contained credentials and were removed from `HEAD` and backed up locally.
- Private SSH key file(s) found in history: `id_rsa_github` (and related pub key).
- Additional findings: possible API-like tokens in test scripts (see `tmp-security-scan/gitleaks-report.json`).

## High-level rotation steps

1. Identify affected services per finding.
   - For each API token found, note the service (e.g., third-party API, CI secret store) and where it's used (CI secret, deploy key, server env).
2. Revoke the leaked credential immediately in the service/provider console.
3. Create a new credential/key and update the repository or secret store with the new value.
4. Update running systems (CI, servers, cloud services) to use the new credential.
5. Remove any remaining references in local files or configs and ensure secrets are only stored in secret managers.

## Sample rotation actions

- GitHub deploy/SSH key (`id_rsa_github`):
  1. On GitHub, remove any Deploy keys or SSH keys that match the leaked public key.
  2. Generate a new SSH key on a secure machine: `ssh-keygen -t ed25519 -C "deploy@<org>" -f ~/.ssh/id_deploy_xanuicam`
  3. Add the new public key to repository deploy keys or CI as appropriate.

- API keys / tokens found in scripts:
  1. Revoke the token from the provider console.
  2. Generate a new token with least privileges needed.
  3. Update CI secrets (GitHub Actions Secrets / other vault) with the new token.
  4. Rotate any server-side env vars and restart services if necessary.

- TLS/Certificates found as files:
  1. Re-issue certificates via the provider (Cloudflare, CA).
  2. Replace certs on servers and any CDNs or services using them.

## Post-rotation verification

1. Re-run `gitleaks` against the repository (and history after purge) to confirm no secrets remain.
2. Monitor service logs and access logs for suspicious activity.
3. Notify stakeholders and update incident tracking with rotated credentials and timelines.

## Notes / safe storage recommendations
- Do not store secrets in the repository. Use GitHub Actions Secrets, AWS Secrets Manager, Vault, or environment variables injected at deploy time.
- Keep a secure, local-only backup of removed secrets if needed for rotation, and delete that backup after rotation is complete.
