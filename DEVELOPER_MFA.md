# MFA Developer Setup & Testing

This file describes required environment variables and quick test steps for MFA features.

## Required environment variables (dev/test)
- `JWT_SECRET` - secret string used to sign JWT tokens.
  - Example (dev): `dev_jwt_secret_for_test` (use long/random in production).
- `AUDIT_LOG_KEY` - 32-byte key used for AES-GCM encryption of user agent/IP fields.
  - Should be provided as base64 or a 32-byte raw string. Example generation (Node):
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
    ```
  - Export to environment before starting backend.

## Optional DB migration
- Migration added: `backend/migrations/2025_12_25_add_mfa_enabled_at_and_cleanup_sessions.sql`
  - Adds `mfa_enabled_at TIMESTAMP NULL` to `users` table.
  - Deletes inactive/old sessions older than 90 days (adjust as needed).
  - Apply this migration with your DB migration tool or run the SQL by hand.

## Start servers (development)
Open two terminals.

1) Backend (terminal A):
```powershell
Set-Location E:\ubndxanuicam_internet
$env:JWT_SECRET = 'dev_jwt_secret_for_test'
$env:AUDIT_LOG_KEY = '<base64_32_byte_key_here>'
$env:NODE_ENV = 'development'
node backend/server.js
```

2) Frontend (terminal B):
```powershell
Set-Location E:\ubndxanuicam_internet\frontend
npm install
npm start
```

## Quick manual UI test (browser)
- Open: `http://localhost:3000/settings/mfa`
- Click `Bật MFA` to create a secret and QR code.
- Scan QR with an authenticator app. The authenticator should show `xanuicam.vn (username)`.
- Enter the 6-digit code and `Xác thực & Kích hoạt` to enable MFA.
- Confirm `Tắt MFA` button appears. Click it and a password modal will open.
- Enter your password to disable MFA. On success, all MFA sessions will be removed.

## Automated API test
- A test script exists at `tmp/test_mfa_flow.js` to run an end-to-end flow (login, setup, verify, info, logout, disable).
- Run it from workspace root after starting backend:
```powershell
Set-Location E:\ubndxanuicam_internet
node tmp/test_mfa_flow.js
```

## Notes
- Ensure `JWT_SECRET` and `AUDIT_LOG_KEY` are securely stored in production (do NOT commit to repo).
- If you see errors about missing DB columns (e.g. `mfa_enabled_at`), apply migration above.
- If session creation fails due to encryption key issues, check `AUDIT_LOG_KEY` format/length.

*** End of file
