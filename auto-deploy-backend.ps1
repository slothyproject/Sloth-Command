# Complete Backend Deployment with Tokens
# This script uses your tokens.env file for automated setup

Write-Host "============================================" -ForegroundColor Green
Write-Host "  Dissident Backend Auto-Deployment" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Read tokens from file
$tokensFile = "E:\Projects God Tier\Dissident-Website\tokens.env"
if (-not (Test-Path $tokensFile)) {
    Write-Host "ERROR: tokens.env not found at $tokensFile" -ForegroundColor Red
    exit 1
}

Write-Host "Step 1: Loading tokens from tokens.env..." -ForegroundColor Cyan
$tokens = @{}
Get-Content $tokensFile | ForEach-Object {
    if ($_ -match "^(.+):\s*(.+)$") {
        $key = $matches[1].Trim()
        $val = $matches[2].Trim()
        $tokens[$key] = $val
    }
}

# Display tokens (masked)
Write-Host ""
Write-Host "Tokens loaded:" -ForegroundColor Green
Write-Host "  Railway Token: $($tokens['Railways Token'].Substring(0,8))..." -ForegroundColor Gray
Write-Host "  Discord Token: $($tokens['Discord Token'].Substring(0,8))..." -ForegroundColor Gray
Write-Host "  Client Secret: $($tokens['Client Secret'].Substring(0,8))..." -ForegroundColor Gray
Write-Host "  Client ID: $($tokens['Client ID'])" -ForegroundColor Gray
Write-Host "  JWT Secret: $($tokens['JWT Secret'].Substring(0,8))..." -ForegroundColor Gray
Write-Host ""

# Check Railway CLI
Write-Host "Step 2: Checking Railway CLI..." -ForegroundColor Cyan
$railwayCheck = railway --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Railway CLI is installed" -ForegroundColor Green
} else {
    Write-Host "  Installing Railway CLI..." -ForegroundColor Yellow
    npm install -g @railway/cli
}

# Navigate to backend
Write-Host ""
Write-Host "Step 3: Preparing backend..." -ForegroundColor Cyan
cd "E:\Projects God Tier\Dissident-api-backend"

# Verify files
$requiredFiles = @("server.js", "package.json", "Dockerfile", "railway.toml")
$allExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  OK: $file" -ForegroundColor Gray
    } else {
        Write-Host "  MISSING: $file" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host "Some files are missing!" -ForegroundColor Red
    exit 1
}

# Set Railway token
$env:RAILWAY_TOKEN = $tokens['Railways Token']

Write-Host ""
Write-Host "Step 4: Logging into Railway..." -ForegroundColor Cyan
railway logout 2>$null
railway login --token $tokens['Railways Token']

Write-Host ""
Write-Host "Step 5: Linking to project..." -ForegroundColor Cyan
railway link --project resplendent-fulfillment --service dissident-api-backend --environment production

Write-Host ""
Write-Host "Step 6: Setting environment variables..." -ForegroundColor Cyan
railway variables set "DISCORD_CLIENT_ID=$($tokens['Client ID'])"
railway variables set "DISCORD_CLIENT_SECRET=$($tokens['Client Secret'])"
railway variables set "JWT_SECRET=$($tokens['JWT Secret'])"
railway variables set "DISCORD_BOT_TOKEN=$($tokens['Discord Token'])"
railway variables set "FRONTEND_URL=https://dissident.mastertibbles.co.uk"
railway variables set "NODE_ENV=production"
railway variables set "PORT=3000"

Write-Host ""
Write-Host "Step 7: Deploying..." -ForegroundColor Cyan
Write-Host "This may take 2-3 minutes..." -ForegroundColor Yellow
railway up

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT INITIATED!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Check Railway dashboard for status:" -ForegroundColor Cyan
Write-Host "https://railway.com/project/resplendent-fulfillment" -ForegroundColor White
Write-Host ""
Write-Host "Once deployed, your backend URL will be:" -ForegroundColor Cyan
Write-Host "https://dissident-api-backend-production.up.railway.app" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to open Railway dashboard"
railway open
