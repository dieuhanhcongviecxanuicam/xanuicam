$targets = @('E:\ubndxanuicam_internet\TEST','E:\ubndxanuicam_internet\tmp')
foreach ($t in $targets) {
    if (Test-Path $t) {
        try { Remove-Item -LiteralPath $t -Recurse -Force -ErrorAction Stop; Write-Output "REMOVED: $t" }
        catch { Write-Output "FAILED: $t -> $($_.Exception.Message)" }
    } else { Write-Output "MISSING: $t" }
}
Write-Output 'REMAINING:'
Get-ChildItem 'E:\ubndxanuicam_internet' -Force | Select-Object -ExpandProperty Name
