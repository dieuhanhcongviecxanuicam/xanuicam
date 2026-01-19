## Prefer reading DB credentials from environment. If not present, prompt securely.
$env:DB_USER = $env:DB_USER -or 'postgres'
$env:DB_HOST = $env:DB_HOST -or 'localhost'
$env:DB_DATABASE = $env:DB_DATABASE -or 'ubndxanuicam'
$env:DB_PORT = $env:DB_PORT -or '5432'
$env:NODE_ENV = $env:NODE_ENV -or 'development'
if (-not $env:DB_PASSWORD) {
	$securePwd = Read-Host -AsSecureString "Enter DB password (will not be echoed)"
	$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
	$pwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
	[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
	$env:DB_PASSWORD = $pwd
}
Write-Output "Running clear_temp_admin_sessions.js with DB=$env:DB_DATABASE"
node "${PSScriptRoot}\\..\\backend\\tmp\\clear_temp_admin_sessions.js"
