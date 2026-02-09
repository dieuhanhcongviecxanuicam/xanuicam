Development startup
===================

Quick steps to run the app locally (requires Docker):

1. Copy the example env and fill secure values locally (DO NOT commit `.env`):

```powershell
cp .env.example .env
# open .env and set strong values for JWT_SECRET and DB_PASSWORD
```

2. Ensure Docker Desktop is running, then bring up services:

```powershell
docker-compose up -d --remove-orphans
```

3. Wait for Postgres to be ready, then start dev servers (the `start-dev` script
	 automates this):

```powershell
.\scripts\start-dev.ps1
# or run manually:
# docker exec ubnd-postgres pg_isready -U $env:DB_USER -d $env:DB_DATABASE
# npm install
# npm run dev
```

Security notes:

- Never commit `.env` or any file containing secrets; use `.env.example` as a
	template only. The repository's `.gitignore` already excludes `.env`.
- For CI and production, inject secrets from the CI provider (GitHub Actions
	Secrets, GitLab variables, etc.) or a secret manager (Azure Key Vault,
	HashiCorp Vault) instead of storing them in the repo.
- Rotate `JWT_SECRET` and database passwords regularly and restrict access to
	the secret store.

If you want a fully containerized development environment (frontend + backend
built into containers), I can extend `docker-compose.yml` to tune volumes and
hot-reload settings — tell me if you want that next.
\nAutomated: prepare PR for docker-compose and CI helpers.
