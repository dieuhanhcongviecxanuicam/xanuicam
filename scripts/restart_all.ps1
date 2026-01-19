$ErrorActionPreference='Continue'
$ports=@(3000,3001,5000)
$pids = Get-NetTCPConnection -LocalPort $ports -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($pids -and $pids.Count -gt 0) {
  Write-Output "Stopping pids: $($pids -join ',')"
  foreach ($id in $pids) {
    try { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; Write-Output "Stopped pid $id" } catch { Write-Output "Failed stopping pid $id" }
  }
} else { Write-Output 'No process bound to ports 3000/3001/5000' }

$logdir='E:\ubndxanuicam_internet\logs'
if (!(Test-Path $logdir)) { New-Item -ItemType Directory -Path $logdir | Out-Null }

Write-Output 'Starting backend...'
$backend = Start-Process -FilePath npm -ArgumentList 'run','dev' -WorkingDirectory 'E:\ubndxanuicam_internet\backend' -RedirectStandardOutput "$logdir\backend_stdout.log" -RedirectStandardError "$logdir\backend_stderr.log" -PassThru
Write-Output "Started backend PID $($backend.Id)"

Start-Sleep -Seconds 3

Write-Output 'Starting frontend...'
$frontend = Start-Process -FilePath npm -ArgumentList 'start' -WorkingDirectory 'E:\ubndxanuicam_internet\frontend' -RedirectStandardOutput "$logdir\frontend_stdout.log" -RedirectStandardError "$logdir\frontend_stderr.log" -PassThru
Write-Output "Started frontend PID $($frontend.Id)"

Start-Sleep -Seconds 4

Write-Output 'Port status:'
Get-NetTCPConnection -LocalPort 5000,3000,3001 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize

if (Test-Path "$logdir\backend_stdout.log") { Write-Output '--- backend stdout (tail) ---'; Get-Content "$logdir\backend_stdout.log" -Tail 30 }
if (Test-Path "$logdir\frontend_stdout.log") { Write-Output '--- frontend stdout (tail) ---'; Get-Content "$logdir\frontend_stdout.log" -Tail 30 }
