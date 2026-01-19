EXPORT_TMP_DIR
===============

Purpose
-------
`EXPORT_TMP_DIR` is an optional environment variable used by the backend to
store temporary files produced during export operations (for example, PDFs
that are written to disk before being streamed to the client). If not set,
the OS temporary directory (via `os.tmpdir()`) is used.

Recommendations for production
------------------------------
- Set `EXPORT_TMP_DIR` to a directory owned by the backend service user (example: `/var/tmp/xanuicam_exports`).
- Restrict permissions to the directory: `chmod 700 /var/tmp/xanuicam_exports` so only the service user can read/write.
- Ensure the directory is on a disk with enough space for expected concurrent exports.
- Consider placing the directory on a separate volume with monitoring/alerts for low disk space.
- Do NOT expose `EXPORT_TMP_DIR` via your web server; the files are temporary and may contain user-identifying data.

Security notes
--------------
- Keep `DEBUG_LOGS=false` in production. When enabled, export logs may contain user ids and counts.
- Rotate or limit logs using `EXPORT_LOG_KEEP` (configured in `.env` / `.env.example`).

Example
-------
In your production environment file or systemd unit:

```bash
EXPORT_TMP_DIR=/var/tmp/xanuicam_exports
DEBUG_LOGS=false
EXPORT_LOG_KEEP=10
```

If you need the backend to create the directory automatically, ensure the
process has permission to create it; the server will attempt to mkdir it at
startup when possible.
