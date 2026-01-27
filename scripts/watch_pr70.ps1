Param(
  [string]$repo = 'dieuhanhcongviecxanuicam/xanuicam',
  [int]$pr = 70,
  [int]$max = 10,
  [int]$interval = 15
)
$final = 'TIMEOUT'
for ($i = 1; $i -le $max; $i++) {
  Write-Output "[poll $i/$max] checking CI..."
  $cons = ''
  try {
    $cons = gh pr view $pr --repo $repo --json statusCheckRollup --jq '.statusCheckRollup[].conclusion' 2>$null
  } catch {
    $cons = ''
  }
  if (-not $cons) {
    Write-Output '[status] no conclusions yet (pending)'
  } else {
    $arr = $cons -split "`n" | Where-Object { $_ -ne '' }
    if ($arr -contains 'FAILURE') { Write-Output '[status] found FAILURE'; $final = 'FAILURE'; break }
    elseif ($arr -contains 'PENDING' -or $arr -contains 'IN_PROGRESS' -or $arr -contains 'NEUTRAL' -or $arr -contains 'CANCELLED') { Write-Output "[status] checks in progress: $($arr -join ', ')" }
    else { Write-Output '[status] all checks SUCCESS'; $final = 'SUCCESS'; break }
  }
  Start-Sleep -Seconds $interval
}
Write-Output "FINAL_STATUS=$final"
exit 0
