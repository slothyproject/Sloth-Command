# Versioned Railway deploy helper for Central Hub
# Usage:
#   .\deploy-versioned.ps1
#   .\deploy-versioned.ps1 -Service central-hub-v3

param(
    [string]$Service = "central-hub-v3"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Central Hub - Versioned Deploy" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

Set-Location $PSScriptRoot

# Ensure this is a git repository.
git rev-parse --is-inside-work-tree 1>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not inside a git repository." -ForegroundColor Red
    exit 1
}

# Prefer railway CLI if installed, otherwise fallback to npx.
$railway = Get-Command railway -ErrorAction SilentlyContinue
if ($railway) {
    $deployCmd = "railway up --service $Service"
    $logsCmd = "railway logs --service $Service"
} else {
    $deployCmd = "npx @railway/cli up --service $Service"
    $logsCmd = "npx @railway/cli logs --service $Service"
}

# Build metadata for runtime version.
$sha = (git rev-parse --short HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($sha)) {
    Write-Host "Unable to determine git commit SHA." -ForegroundColor Red
    exit 1
}
Set-Content -Path (Join-Path $PSScriptRoot "commit.txt") -Value $sha -Encoding Ascii -NoNewline
Write-Host "Prepared commit.txt with SHA $sha" -ForegroundColor Green

try {
    Write-Host ""
    Write-Host "Deploying to Railway service '$Service'..." -ForegroundColor Yellow
    Invoke-Expression $deployCmd

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Deployment successful." -ForegroundColor Green
        Write-Host ""
        Write-Host "Recent logs (last 50 lines):" -ForegroundColor Cyan
        Invoke-Expression $logsCmd 2>&1 | Select-Object -Last 50
    } else {
        Write-Host "Deployment failed." -ForegroundColor Red
        Write-Host ""
        Write-Host "Recent logs (last 30 lines):" -ForegroundColor Yellow
        Invoke-Expression $logsCmd 2>&1 | Select-Object -Last 30
        exit 1
    }
} finally {
    $commitFile = Join-Path $PSScriptRoot "commit.txt"
    if (Test-Path $commitFile) {
        Remove-Item $commitFile -Force
    }
}
