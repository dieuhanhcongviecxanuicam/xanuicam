# Build frontend, kill backend on port 3000 (if any), then start backend
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\deploy_frontend_and_restart_backend.ps1

# Resolve repository root and use explicit paths for frontend/backend
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$repoRootPath = $repoRoot.Path
Write-Host "Repo root: $repoRootPath"
$frontendPath = Join-Path $repoRootPath "frontend"
Write-Host "Building frontend at: $frontendPath"
npm --prefix $frontendPath run build

# Find PID listening on :3000 (use Get-NetTCPConnection when available)
$targetPid = $null
try {
    $targetPid = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
} catch { }

if (-not $targetPid) {
    try {
        $net = netstat -ano | findstr ":3000"
        if ($net) {
            $line = $net -split "\r?\n" | Where-Object { $_ -match "LISTENING" } | Select-Object -First 1
            if ($line) {
                $parts = ($line -split '\s+') | Where-Object { $_ -ne '' }
                $targetPid = $parts[-1]
            }
        }
    } catch { }
}

if ($targetPid) {
    Write-Host "Killing process listening on port 3000 PID=$targetPid"
    try {
        taskkill /PID $targetPid /F | Out-Null
        Start-Sleep -Seconds 1
    } catch {
        # Use -f format operator to avoid ambiguous variable parsing with ':' character
        Write-Host ("Failed to kill PID {0}: {1}" -f $targetPid, $_)
    }
} else {
    Write-Host "No process found on port 3000"
}

Write-Host "Starting backend (npm --prefix <backend_path> start)"
$backendPath = Join-Path $repoRootPath "backend"
Start-Process -FilePath npm -ArgumentList "--prefix",$backendPath,"start" -NoNewWindow -WorkingDirectory $repoRootPath
Write-Host "Deploy script finished. Backend should be restarting with new build served when NODE_ENV=production or SERVE_FRONTEND=true."