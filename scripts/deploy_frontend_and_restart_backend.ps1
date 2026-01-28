# Build frontend, kill backend on port 3000 (if any), then start backend
# Usage: powershell -ExecutionPolicy Bypass -File .\scripts\deploy_frontend_and_restart_backend.ps1

# Resolve repository root and use explicit paths for frontend/backend
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
$repoRootPath = $repoRoot.Path
Write-Host "Repo root: $repoRootPath"
$frontendPath = Join-Path $repoRootPath "frontend"
Write-Host "Building frontend at: $frontendPath"
# Ensure frontend dependencies are installed (prefer reproducible `ci` when lockfile exists)
if (Test-Path (Join-Path $frontendPath "package-lock.json")) {
    Write-Host "Running npm ci in frontend"
    npm --prefix $frontendPath ci
} else {
    Write-Host "Running npm install in frontend"
    npm --prefix $frontendPath install
}

# Try building the frontend; on a known Tailwind/PostCSS migration error attempt an automated fix
Write-Host "Running frontend build"
$buildExit = (npm --prefix $frontendPath run build) 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
    Write-Host "Frontend build failed. Inspecting output for Tailwind PostCSS plugin error..."
    Write-Host $buildExit
    # If Tailwind itself is missing, install it. Also handle PostCSS plugin migration.
    if ($buildExit -match "Cannot find module 'tailwindcss'" -or $buildExit -match "PostCSS plugin has moved" -or $buildExit -match "@tailwindcss/postcss") {
        Write-Host "Detected Tailwind/PostCSS issue; installing tailwindcss and @tailwindcss/postcss and retrying build"
        npm --prefix $frontendPath install --no-audit --no-fund tailwindcss --save-dev
        npm --prefix $frontendPath install --no-audit --no-fund @tailwindcss/postcss --save-dev
        Write-Host "Retrying frontend build"
        npm --prefix $frontendPath run build
    } else {
        Write-Host "Frontend build failed for another reason. See output above."
    }
} else {
    Write-Host "Frontend build succeeded."
}

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
# Ensure backend dependencies are installed before starting
if (Test-Path (Join-Path $backendPath "package-lock.json")) {
    Write-Host "Running npm ci in backend"
    $backendCiOutput = (npm --prefix $backendPath ci) 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        Write-Host "npm ci failed for backend. Attempting npm cache clean and retry..."
        Write-Host $backendCiOutput
        npm cache clean --force
        $backendCiOutput = (npm --prefix $backendPath ci) 2>&1 | Out-String
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Retry after cache clean still failed. Falling back to npm install."
            Write-Host $backendCiOutput
            npm --prefix $backendPath install
        }
    }
} else {
    Write-Host "Running npm install in backend"
    npm --prefix $backendPath install
}

Start-Process -FilePath npm -ArgumentList "--prefix",$backendPath,"start" -NoNewWindow -WorkingDirectory $repoRootPath
Write-Host "Deploy script finished. Backend should be restarting with new build served when NODE_ENV=production or SERVE_FRONTEND=true."