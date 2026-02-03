$targets = @(
  'E:\ubndxanuicam_internet\tmp_check_apis.js',
  'E:\ubndxanuicam_internet\tmp_check_apis2.js',
  'E:\ubndxanuicam_internet\tmp_audit_list.json',
  'E:\ubndxanuicam_internet\apply_migration.out',
  'E:\ubndxanuicam_internet\seed_run_output.log'
)

foreach ($t in $targets) {
  if (Test-Path $t) {
    try { Remove-Item -LiteralPath $t -Force -ErrorAction Stop; Write-Output "REMOVED: $t" }
    catch { Write-Output "FAILED: $t -> $($_.Exception.Message)" }
  } else { Write-Output "MISSING: $t" }
}

Write-Output 'REMOVE_NON_SOURCE_DONE'
Get-ChildItem 'E:\ubndxanuicam_internet' -Force | Select-Object -ExpandProperty Name
