# Auto-deploy Token Vault to Railway
# One-command deployment with verification

param(
    [switch]$SkipTests,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Configuration
$ProjectRoot = "E:\Projects God Tier\Dissident-Tokens-Vault"
$RailwayUrl = "https://dissident-tokens-vault-production.up.railway.app"
$CustomDomain = "https://dissidenttokens.mastertibbles.co.uk"
$MaxWaitMinutes = 5

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Token Vault Auto-Deploy Script" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pre-deployment checks
Write-Host "[1/6] Pre-deployment checks..." -ForegroundColor Yellow

# Check if we're in the right directory
if (-not (Test-Path "$ProjectRoot\Dockerfile")) {
    Write-Host "ERROR: Dockerfile not found. Are you in the right directory?" -ForegroundColor Red
    exit 1
}

# Check if git repo is clean (unless Force)
Push-Location $ProjectRoot
$status = git status --porcelain
if ($status -and -not $Force) {
    Write-Host "WARNING: You have uncommitted changes:" -ForegroundColor Yellow
    Write-Host $status
    $response = Read-Host "Continue anyway? [y/N]"
    if ($response -ne 'y') {
        exit 1
    }
}
Pop-Location

Write-Host "✓ Pre-deployment checks passed" -ForegroundColor Green

# Step 2: Build test locally (unless skipped)
if (-not $SkipTests) {
    Write-Host "[2/6] Testing Docker build locally..." -ForegroundColor Yellow
    try {
        Push-Location $ProjectRoot
        docker build -t test-vault .
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed"
        }
        Write-Host "✓ Docker build successful" -ForegroundColor Green
        Pop-Location
    } catch {
        Write-Host "ERROR: Docker build failed: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[2/6] Skipping local build test" -ForegroundColor Yellow
}

# Step 3: Push to GitHub
Write-Host "[3/6] Pushing to GitHub..." -ForegroundColor Yellow
try {
    Push-Location $ProjectRoot
    git add -A
    $hasChanges = git diff --cached --quiet
    if (-not $hasChanges) {
        git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        throw "Git push failed"
    }
    Write-Host "✓ Pushed to GitHub" -ForegroundColor Green
    Pop-Location
} catch {
    Write-Host "ERROR: Failed to push: $_" -ForegroundColor Red
    exit 1
}

# Step 4: Wait for Railway deployment
Write-Host "[4/6] Waiting for Railway deployment..." -ForegroundColor Yellow
Write-Host "      This may take 2-3 minutes..." -ForegroundColor Gray

$startTime = Get-Date
$deployed = $false

while (-not $deployed -and ((Get-Date) - $startTime).TotalMinutes -lt $MaxWaitMinutes) {
    Start-Sleep -Seconds 10
    
    try {
        $response = Invoke-WebRequest -Uri $RailwayUrl -TimeoutSec 5 -UseBasicParsing
        if ($response.StatusCode -eq 200) {
            $deployed = $true
            break
        }
    } catch {
        Write-Host "      Still deploying... ($(Get-Date -Format 'HH:mm:ss'))" -ForegroundColor Gray
    }
}

if (-not $deployed) {
    Write-Host "ERROR: Deployment timed out after $MaxWaitMinutes minutes" -ForegroundColor Red
    Write-Host "Check Railway dashboard: https://railway.app/project/resplendent-fulfillment" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Railway deployment successful" -ForegroundColor Green

# Step 5: Verify custom domain
Write-Host "[5/6] Verifying custom domain..." -ForegroundColor Yellow
try {
    Start-Sleep -Seconds 5  # Give DNS time
    $response = Invoke-WebRequest -Uri $CustomDomain -TimeoutSec 10 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Custom domain is responding" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ Custom domain not ready yet (may need more DNS propagation time)" -ForegroundColor Yellow
}

# Step 6: Final status
Write-Host "[6/6] Deployment complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "==============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  Railway: $RailwayUrl" -ForegroundColor Cyan
Write-Host "  Custom:  $CustomDomain" -ForegroundColor Cyan
Write-Host ""
Write-Host "Dashboard: https://railway.app/project/resplendent-fulfillment" -ForegroundColor Gray
Write-Host ""
