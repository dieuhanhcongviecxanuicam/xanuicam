# Start backend in background and redirect stdout/stderr to backend/backend_start.log
# Usage: run this script from workspace root in PowerShell
$backendDir = Join-Path $PSScriptROOT '..\backend'
$log = Join-Path $backendDir 'backend_start.log'
# Ensure backend directory exists
if (!(Test-Path $backendDir)) { Write-Error "Backend directory not found: $backendDir"; exit 1 }
New-Item -Path $log -ItemType File -Force | Out-Null
# Start node in background using cmd.exe start /B; run in backend working directory and redirect stdout/stderr to log
$arg = 'start /B "" node server.js > "' + $log + '" 2>&1'
Start-Process -FilePath 'cmd.exe' -ArgumentList '/C', $arg -WorkingDirectory $backendDir -WindowStyle Hidden | Out-Null
Write-Output "Started backend in background; logs -> $log"