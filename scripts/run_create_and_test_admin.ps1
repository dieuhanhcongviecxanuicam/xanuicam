# Set DB env vars and run the create_and_test_admin_and_edit.js script
# Prefer reading DB credentials from environment. If not present, prompt securely.
$env:DB_USER = $env:DB_USER -or 'postgres'
$env:DB_HOST = $env:DB_HOST -or 'localhost'
$env:DB_DATABASE = $env:DB_DATABASE -or 'ubndxanuicam'
$env:DB_PORT = $env:DB_PORT -or '5432'
if (-not $env:DB_PASSWORD) {
	$securePwd = Read-Host -AsSecureString "Enter DB password (will not be echoed)"
	$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
	$pwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
	[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
	$env:DB_PASSWORD = $pwd
}
# Ensure NODE_ENV=development to match backend config
$env:NODE_ENV = 'development'

Write-Output "Running create_and_test_admin_and_edit.js with DB=$env:DB_DATABASE on $env:DB_HOST:$env:DB_PORT"
node "${PSScriptRoot}\..\backend\tmp\create_and_test_admin_and_edit.js"
