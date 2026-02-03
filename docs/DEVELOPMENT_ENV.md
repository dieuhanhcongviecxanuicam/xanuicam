# Development Environment and Safe Overrides

This document describes how to run the project locally and safely override production
configuration without modifying the `backend/.env` file that is used for deployments.

Recommended workflow

1. Do not edit `backend/.env` for local development. That file is treated as the canonical
   production configuration.
2. Create `backend/.env.local` from `backend/.env.local.example` and add your local values.
3. When starting the backend locally, use a process-level override that prefers `.env.local`.

Example (WSL / Linux / macOS):

```bash
export \
  DB_HOST=localhost \
  DB_PORT=5432 \
  DB_USER=ubndxanuicam \
  DB_PASSWORD=local_password \
  DB_DATABASE=ubndxanuicam_dev

cd backend
node server.js
```

Or use the provided migration script which expects `PGHOST/PGUSER/PGPASSWORD/PGDATABASE`:

```bash
export PGHOST=localhost PGUSER=ubndxanuicam PGPASSWORD=local_password PGDATABASE=ubndxanuicam_dev
./scripts/run_migrations.sh
```

Smoke tests

Run the smoke tests against a running backend:

```bash
cd e2e
BASE_URL=http://127.0.0.1:5000 node smoke_system_notification_test.js
```

Static deploy helpers

- `scripts/deploy_static_s3.sh` synchronizes `frontend/build` to an S3 bucket and can invalidate CloudFront.
- `scripts/purge_cloudflare_cache.sh` will purge the Cloudflare zone cache when provided `CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN`.

Security notes

- Never commit `.env.local` or any file containing secrets.
- Use a secrets manager in CI/CD for production deployments.
