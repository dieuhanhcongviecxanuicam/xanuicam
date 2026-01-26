# Release notes — Upload hardening v3.0

Summary
- Tightened upload validation: `createFileFilter` now requires both file extension and MIME to match allowed patterns, with a safe exception for `pdf` and `docx` because many clients send nonstandard mimes.
- Added explicit blacklist of executable/script extensions (exe, scr, dll, com, bat, sh, php, jsp, jar, ps1, py, pl, bin).
- Synchronous, best-effort rejection logging to `process.env.UPLOAD_REJECTION_LOG` or `/app/tmp/upload_rejections.log` to collect samples for tuning.

Actions performed
- Created release branch `release/upload-harden-v3` and tag `v3.0-upload-harden`.
- Added `deploy/redeploy_backend.sh` helper to rebuild and restart the backend with a short listen-health wait loop.
- Collected sample rejection JSON lines into `backend/collected_upload_rejections.log` for filter tuning.

Verification steps
1. After deploy, verify backend is running and listening on port 5000.
2. Check rejection log: `docker exec xanuicam_backend_1 sed -n '1,200p' /app/tmp/upload_rejections.log`.
3. Run an authenticated upload POST (or use the in-container harness) to confirm disallowed files return 415 and are logged.

Notes
- This release intentionally errs on the side of stricter validation to prevent accidental executable uploads; further tuning of allowed types can be performed after reviewing real production samples.

Contact
- Release prepared by automation in the repository root; open PR `release/upload-harden-v3` for review.
