<#
apply-branch-protection.ps1

Run this locally (on your machine). It will prompt you for a Personal Access Token
and apply branch protection rules to the `main` branch of this repo using the
GitHub REST API. The token is not stored in the repository.

Required scopes on the PAT: repo, admin:repo_hook

Usage: Open PowerShell in the repository root and run:
  .\scripts\apply-branch-protection.ps1

This script is designed to be run locally to avoid exposing the PAT to CI
or chat. Do NOT paste your PAT into chat.
#>

Param()

function Read-Secret([string]$prompt = "Enter secret: ") {
    $secure = Read-Host -AsSecureString -Prompt $prompt
    return [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

Write-Output "This script will apply branch protection to 'main' for the current repository."
$pat = Read-Secret -prompt "Enter GitHub Personal Access Token (scopes: repo, admin:repo_hook)"
if (-not $pat) { Write-Error "No token provided, aborting."; exit 1 }

$ownerRepo = (git rev-parse --show-toplevel | Split-Path -Leaf)
if (-not $ownerRepo) { $ownerRepo = Read-Host -Prompt "Repository (owner/repo)" }

if ($ownerRepo -notmatch '/') {
    Write-Output "Detected folder name: $ownerRepo"
    $owner = Read-Host -Prompt 'Enter repo owner (e.g., dieuhanhcongviecxanuicam)'
    $repo = Read-Host -Prompt 'Enter repo name (e.g., xanuicam)'
} else {
    $parts = $ownerRepo -split '/' ; $owner = $parts[0]; $repo = $parts[1]
}

$apiUrl = "https://api.github.com/repos/$owner/$repo/branches/main/protection"

$body = @{
    required_status_checks = @{ strict = $true; contexts = @('backend-tests','frontend-build','secret-scan') }
    enforce_admins = $true
    required_pull_request_reviews = @{
        dismissal_restrictions = @{}
        dismiss_stale_reviews = $true
        require_code_owner_reviews = $false
        required_approving_review_count = 1
    }
    restrictions = $null
} | ConvertTo-Json -Depth 6

Write-Output "Applying branch protection to $owner/$repo (main)..."

try {
    $resp = Invoke-RestMethod -Uri $apiUrl -Method Put -Headers @{ Authorization = "token $pat"; Accept = 'application/vnd.github+json' } -Body $body -ContentType 'application/json'
    Write-Output "Branch protection applied successfully."
} catch {
    Write-Error "Failed to apply branch protection: $_"
    exit 2
}

Write-Output "Done. Verify settings at: https://github.com/$owner/$repo/settings/branches"
