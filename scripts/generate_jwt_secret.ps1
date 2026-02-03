<#
PowerShell helper to create a base64 JWT secret.
Usage:
  .\generate_jwt_secret.ps1 -Algorithm HS512 -Bytes 64 -OutEnv .env
  .\generate_jwt_secret.ps1 -Algorithm HS256 -Bytes 32
#>
param(
  [ValidateSet('HS256','HS512')]
  [string]$Algorithm = 'HS512',
  [int]$Bytes,
  [string]$OutEnv
)
if (-not $Bytes) {
  $Bytes = if ($Algorithm -eq 'HS256') { 32 } else { 64 }
}
$bytes = New-Object Byte[] $Bytes; [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes); $secret = [Convert]::ToBase64String($bytes);
Write-Host "Generated secret (base64, $Bytes bytes) for $Algorithm:`n$secret"
if ($OutEnv) {
  if (Test-Path $OutEnv) {
    Write-Host "Appending JWT_SECRET and JWT_ALGORITHM to $OutEnv"
    "`nJWT_SECRET=$secret`nJWT_ALGORITHM=$Algorithm`n" | Out-File -FilePath $OutEnv -Encoding utf8 -Append
  } else {
    Write-Host "Creating $OutEnv with JWT_SECRET and JWT_ALGORITHM"
    "JWT_SECRET=$secret`nJWT_ALGORITHM=$Algorithm`n" | Out-File -FilePath $OutEnv -Encoding utf8
  }
  Write-Host "Wrote to $OutEnv (ensure this file is in .gitignore)"
}
