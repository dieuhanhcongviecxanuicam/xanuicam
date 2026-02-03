# Install cloudflared as a Windows service and copy credentials/config to %USERPROFILE%\.cloudflared
# Run this script as Administrator. If not elevated, it will re-launch itself elevated.

function Ensure-Elevated {
  param()
  $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $isAdmin) {
    Write-Host "Not running as Administrator. Relaunching elevated..."
    Start-Process -FilePath pwsh -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File \"$PSCommandPath\"" -Verb RunAs
    exit
  }
}

Ensure-Elevated

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$srcCloudflared = Join-Path $repoRoot ".cloudflared"
$dstCloudflared = Join-Path $env:USERPROFILE ".cloudflared"

Write-Host "Source .cloudflared: $srcCloudflared"
Write-Host "Destination .cloudflared: $dstCloudflared"

if (-Not (Test-Path $dstCloudflared)) { New-Item -ItemType Directory -Path $dstCloudflared | Out-Null }

# Copy any credentials or certs from repo .cloudflared if present (but do not fail if missing)
if (Test-Path $srcCloudflared) {
  Write-Host "Copying files from repo .cloudflared to $dstCloudflared"
  Get-ChildItem -Path $srcCloudflared -File -Force | ForEach-Object {
    Copy-Item -Path $_.FullName -Destination $dstCloudflared -Force
    Write-Host "Copied $($_.Name)"
  }
} else {
  Write-Host "No .cloudflared folder found in repo root. Ensure credentials (json) and config.yml are placed in $dstCloudflared before installing service."
}

# Create a minimal config.yml if one does not exist
$configPath = Join-Path $dstCloudflared 'config.yml'
if (-Not (Test-Path $configPath)) {
  $defaultConfig = @"
tunnel: <TUNNEL_ID>
# credentials-file: C:\Users\<USER>\.cloudflared\<TUNNEL_ID>.json
# Adjust hostname/service below to match your app
ingress:
  - hostname: dev.xanuicam.vn
    service: http://localhost:3000
  - service: http_status:404

# Optional: set caPool to your origin cert
# originRequest:
#   caPool: C:\Users\<USER>\.cloudflared\cloudflare-origin.pem
"@
  $defaultConfig | Out-File -FilePath $configPath -Encoding UTF8
  Write-Host "Wrote default config to $configPath — edit to set TunnelID and credentials-file as needed."
} else {
  Write-Host "Found existing config.yml at $configPath"
}

# Ensure cloudflared is on PATH
$cloudflaredPath = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflaredPath) {
  Write-Error "cloudflared executable not found in PATH. Please install cloudflared and ensure it's available in PATH."
  exit 2
}

# Install the service
Write-Host "Installing cloudflared Windows service..."
try {
  Start-Process -FilePath $cloudflaredPath -ArgumentList 'service install' -Wait -NoNewWindow -ErrorAction Stop
  Write-Host "Service installer finished. Starting service..."
  Start-Service cloudflared -ErrorAction Stop
  Write-Host "Service started. Status:"
  Get-Service cloudflared | Format-Table -AutoSize
} catch {
  Write-Error "Failed to install or start cloudflared service: $_"
  exit 3
}

Write-Host "Done. Check that https://dev.xanuicam.vn resolves and routes to your local app (http://localhost:3000)."