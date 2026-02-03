$targets = @(
    'E:\ubndxanuicam_internet\node_modules',
    'E:\ubndxanuicam_internet\logs',
    'E:\ubndxanuicam_internet\frontend\build',
    'E:\ubndxanuicam_internet\uploads',
    'E:\ubndxanuicam_internet\ubndxanuicam_9.9.backup',
    'E:\ubndxanuicam_internet\ubndxanuicam_9.9.sql',
    'E:\ubndxanuicam_internet\ubndxanuicam9.9',
    'E:\ubndxanuicam_internet\backend_foreground.log',
    'E:\ubndxanuicam_internet\backend_server_out.log',
    'E:\ubndxanuicam_internet\server_run2.log',
    'E:\ubndxanuicam_internet\audit_1.csv',
    'E:\ubndxanuicam_internet\audit_1.json',
    'E:\ubndxanuicam_internet\audit_1.pdf',
    'E:\ubndxanuicam_internet\seed_run_output.log'
)

foreach ($p in $targets) {
    if (Test-Path $p) {
        try {
            Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop
            Write-Output "REMOVED: $p"
        } catch {
            Write-Output "FAILED: $p -> $($_.Exception.Message)"
        }
    } else {
        Write-Output "MISSING: $p"
    }
}

# Remove any leftover .backup and .sql files at root
Get-ChildItem 'E:\ubndxanuicam_internet' -File -Filter '*.backup' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item -Force -ErrorAction SilentlyContinue $_; Write-Output "REMOVED: $($_.FullName)" }
Get-ChildItem 'E:\ubndxanuicam_internet' -File -Filter '*.sql' -ErrorAction SilentlyContinue | ForEach-Object { Remove-Item -Force -ErrorAction SilentlyContinue $_; Write-Output "REMOVED: $($_.FullName)" }

Write-Output 'DELETION_DONE'
Write-Output 'Remaining top-level:'
Get-ChildItem 'E:\ubndxanuicam_internet' -Force | Select-Object -ExpandProperty Name
