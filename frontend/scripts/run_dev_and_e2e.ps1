try { taskkill /IM node.exe /F } catch {}
$env:PORT='3001'
Set-Location 'e:\ubndxanuicam_internet\frontend'
Start-Process -FilePath npm -ArgumentList 'start' -WindowStyle Hidden
Write-Output 'Waiting for dev server on port 3001...'
$up=$false
for ($i=0; $i -lt 60; $i++) {
  try {
    $r = Test-NetConnection -ComputerName 'localhost' -Port 3001 -WarningAction SilentlyContinue
    if ($r.TcpTestSucceeded) { $up=$true; break }
  } catch {}
  Start-Sleep -Seconds 1
}
if (-not $up) { Write-Error 'Dev server did not start'; exit 2 }
Write-Output 'Dev server is up, running Puppeteer test...'
node 'e:\ubndxanuicam_internet\frontend\scripts\e2e_users_smoke.js'
exit $LASTEXITCODE
