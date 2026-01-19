# Build frontend, kill backend on port 3000 (if any), then start backend
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\deploy_frontend_and_restart_backend.ps1

Write-Host "Building frontend..."
npm --prefix frontend run build

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
        Write-Host "Failed to kill PID $targetPid: $_"
    }
} else {
    Write-Host "No process found on port 3000"
}

Write-Host "Starting backend (npm --prefix backend start)"
Start-Process -FilePath npm -ArgumentList "--prefix","backend","start" -NoNewWindow
Write-Host "Deploy script finished. Backend should be restarting with new build served when NODE_ENV=production or SERVE_FRONTEND=true."