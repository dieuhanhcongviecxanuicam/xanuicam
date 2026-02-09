Development startup
===================

Quick steps to run the app locally (requires Docker):

1. Ensure Docker Desktop is running.
2. From repo root run:

```powershell
.\scripts\start-dev.ps1
```

This will start a Postgres container using `backend/.env` values and then run `npm run dev`.

If you prefer manual steps:

```powershell
# Start Postgres container
docker-compose up -d

# Wait for readiness
docker exec ubnd-postgres pg_isready -U <DB_USER> -d <DB_DATABASE>

# Start dev servers
npm install
npm run dev
```
