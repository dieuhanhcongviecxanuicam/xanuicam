<#
Start-dev.ps1
Usage: Run from repository root. This will ensure Docker Desktop is running,
bring up Postgres via docker-compose, wait for DB readiness, then start dev servers.
#>
Set-StrictMode -Version Latest
Write-Output "Starting dev environment..."

# Start Docker Desktop if present
$paths = @(
    "C:\Program Files\Docker\Docker\Docker Desktop.exe",
    "C:\Program Files\Docker\Docker Desktop.exe",
    "C:\Program Files\Docker\Docker\DockerDesktop.exe"
)
$found = $false
foreach ($p in $paths) {
    if (Test-Path $p) { Start-Process -FilePath $p; Write-Output "Started Docker Desktop from: $p"; $found = $true; break }
}
if (-not $found) { Write-Output "Docker Desktop executable not found; ensure Docker daemon is running." }

Write-Output "Bringing up postgres via docker-compose..."
docker-compose up -d --remove-orphans

Write-Output "Waiting for Postgres to become ready..."
for ($i=0; $i -lt 60; $i++) {
    try {
        $out = docker exec ubnd-postgres pg_isready -U $env:DB_USER -d $env:DB_DATABASE 2>&1
        Write-Output $out
        if ($out -match 'accepting connections') { Write-Output 'Postgres ready'; break }
    } catch {
        Start-Sleep -Seconds 1
    }
    Start-Sleep -Seconds 1
}

Write-Output "Starting dev servers (concurrently)..."
npm install
npm run dev
