$pr = 70
$repo = 'dieuhanhcongviecxanuicam/xanuicam'
Write-Output "Fetching statusCheckRollup for PR #$pr"
try {
  $raw = gh pr view $pr --repo $repo --json statusCheckRollup 2>$null
  if (-not $raw) { Write-Output 'No statusCheckRollup output from gh'; exit 0 }
  $json = $raw | ConvertFrom-Json
  if (-not $json.statusCheckRollup) { Write-Output 'No statusCheckRollup entries'; exit 0 }
  foreach ($c in $json.statusCheckRollup) {
    Write-Output "NAME: $($c.name) | CONCLUSION: $($c.conclusion) | DETAILS: $($c.detailsUrl)"
    if ($c.conclusion -eq 'FAILURE') {
      if ($c.detailsUrl -match '/runs/(\d+)/job/(\d+)') {
        $rid = $matches[1]; $jid = $matches[2]
        Write-Output "--- Fetching logs for run id $rid job id $jid ---"
        gh run view $rid --repo $repo --job $jid --log | Out-Host
        Write-Output "--- End logs for run id $rid job id $jid ---"
      } elseif ($c.detailsUrl -match '/runs/(\d+)') {
        $rid = $matches[1]
        Write-Output "--- Fetching logs for run id $rid ---"
        gh run view $rid --repo $repo --log | Out-Host
        Write-Output "--- End logs for run id $rid ---"
      } else {
        Write-Output "Could not extract run/job id from $($c.detailsUrl)"
      }
    }
  }
} catch {
  Write-Output "Error collecting PR checks: $_"
}
