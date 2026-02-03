# Rotation Provider Map

This maps the leaked credential types to provider-specific revoke/rotation actions and sample commands or URLs.

1) GitHub (PATs, Deploy keys, SSH keys)
   - Revoke PATs: https://github.com/settings/tokens
   - Revoke repository Deploy Keys: https://github.com/<org>/<repo>/settings/keys
   - Revoke organization-level keys: https://github.com/organizations/<org>/settings/keys
   - Add/update Actions secrets (example using `gh`):
     gh secret set MY_API_KEY --body "<new-secret>" --repo dieuhanhcongviecxanuicam/xanuicam

2) AWS (access keys / IAM)
   - Revoke access keys in IAM console: https://console.aws.amazon.com/iam/home#/security_credentials
   - Disable the key then delete. Create a new IAM user/role with least privilege and update secrets in your deployment.
   - Sample CLI: `aws iam update-access-key --access-key-id AKIA... --status Inactive`

3) Cloudflare (API tokens / origin certs)
   - Revoke API tokens: https://dash.cloudflare.com/profile/api-tokens
   - Rotate origin certificates via Cloudflare dashboard or API.

4) Google Cloud (service account keys)
   - Revoke service account keys: https://console.cloud.google.com/iam-admin/serviceaccounts
   - Use `gcloud iam service-accounts keys delete KEY_ID --iam-account=ACCOUNT_EMAIL`

5) Azure (service principals / keys)
   - Revoke client secrets in Azure AD App registrations.
   - Portal: Azure Active Directory → App registrations → Certificates & secrets

6) Docker Hub / Registry tokens
   - Revoke access tokens in Docker Hub settings and create new tokens for CI.

7) JWT / application secrets
   - Rotate signing keys or symmetric secrets in your app config or secret manager.
   - Issue a rolling deploy to pick up new keys and invalidate old tokens.

8) Misc / Provider-agnostic steps
   - Remove leaked public keys from `authorized_keys` if used on servers.
   - Rotate database credentials and other long-lived secrets.
   - Replace secrets in vaults (HashiCorp Vault, AWS Secrets Manager, GitHub Secrets) and update deployments.

If you want, I can append sample revoke URLs for each affected finding (repo-specific). Reply `append-specifics` to add repo-specific links.
