# Dissident Master Controller - Simplified
# Run this to setup and deploy everything

param(
    [Parameter()]
    [string]$Action = "status"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Dissident Master Controller" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Configuration
$basePath = "E:\Projects God Tier"
$frontendPath = "$basePath\Dissident-Website"
$backendPath = "$basePath\Dissident-api-backend"
$tokensFile = "$basePath\Dissident-Website\tokens.env"

# Load tokens
Write-Host "Loading configuration..." -ForegroundColor Cyan
$tokens = @{}
if (Test-Path $tokensFile) {
    Get-Content $tokensFile | ForEach-Object {
        if ($_ -match "^(.+):\s*(.+)$") {
            $tokens[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    Write-Host "Configuration loaded" -ForegroundColor Green
}

switch ($Action) {
    "status" {
        Write-Host ""
        Write-Host "Project Status:" -ForegroundColor Cyan
        Write-Host "---------------" -ForegroundColor Cyan
        Write-Host ""
        
        # Frontend
        if (Test-Path $frontendPath) {
            Write-Host "Frontend: EXISTS" -ForegroundColor Green
            Write-Host "  Path: $frontendPath" -ForegroundColor Gray
            Write-Host "  URL: https://dissident.mastertibbles.co.uk" -ForegroundColor Gray
        } else {
            Write-Host "Frontend: NOT FOUND" -ForegroundColor Red
        }
        
        Write-Host ""
        
        # Backend
        if (Test-Path $backendPath) {
            Write-Host "Backend: EXISTS" -ForegroundColor Green
            Write-Host "  Path: $backendPath" -ForegroundColor Gray
            Write-Host "  URL: https://dissident-api-backend-production.up.railway.app" -ForegroundColor Gray
            Write-Host ""
            Write-Host "  Environment Variables Needed:" -ForegroundColor Yellow
            Write-Host "    DISCORD_CLIENT_ID: $($tokens['Client ID'])" -ForegroundColor White
            Write-Host "    DISCORD_CLIENT_SECRET: $($tokens['Client Secret'].Substring(0,8))..." -ForegroundColor White
            Write-Host "    JWT_SECRET: (generated)" -ForegroundColor White
        } else {
            Write-Host "Backend: NOT FOUND" -ForegroundColor Red
        }
        
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Green
        Write-Host "  1. Go to https://railway.com/dashboard" -ForegroundColor White
        Write-Host "  2. Set environment variables" -ForegroundColor White
        Write-Host "  3. Deploy both services" -ForegroundColor White
    }
    
    "deploy" {
        Write-Host "Deploying components..." -ForegroundColor Cyan
        
        # Deploy Frontend
        if (Test-Path $frontendPath) {
            Write-Host ""
            Write-Host "Deploying Frontend..." -ForegroundColor Cyan
            cd $frontendPath
            git add -A 2>$null
            git commit -m "Auto deploy" --no-verify 2>$null
            git push origin main
            Write-Host "Frontend pushed to GitHub" -ForegroundColor Green
        }
        
        # Deploy Backend
        if (Test-Path $backendPath) {
            Write-Host ""
            Write-Host "Deploying Backend..." -ForegroundColor Cyan
            cd $backendPath
            git add -A 2>$null
            git commit -m "Auto deploy" --no-verify 2>$null
            git push origin main
            Write-Host "Backend pushed to GitHub" -ForegroundColor Green
        }
        
        Write-Host ""
        Write-Host "====================================" -ForegroundColor Green
        Write-Host "Code pushed! Now:" -ForegroundColor Green
        Write-Host "1. Go to Railway dashboard" -ForegroundColor White
        Write-Host "2. Redeploy services" -ForegroundColor White
        Write-Host "====================================" -ForegroundColor Green
    }
    
    "setup" {
        Write-Host ""
        Write-Host "Setup Instructions:" -ForegroundColor Green
        Write-Host "===================" -ForegroundColor Green
        Write-Host ""
        Write-Host "1. RAILWAY DASHBOARD:" -ForegroundColor Cyan
        Write-Host "   Go to: https://railway.com/dashboard" -ForegroundColor White
        Write-Host ""
        Write-Host "2. SET ENVIRONMENT VARIABLES:" -ForegroundColor Cyan
        Write-Host "   For dissident-api-backend service:" -ForegroundColor Yellow
        Write-Host "   DISCORD_CLIENT_ID=$($tokens['Client ID'])" -ForegroundColor Gray
        Write-Host "   DISCORD_CLIENT_SECRET=$($tokens['Client Secret'])" -ForegroundColor Gray
        Write-Host "   DISCORD_REDIRECT_URI=https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback" -ForegroundColor Gray
        Write-Host "   JWT_SECRET=$(-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ }))" -ForegroundColor Gray
        Write-Host "   FRONTEND_URL=https://dissident.mastertibbles.co.uk" -ForegroundColor Gray
        Write-Host "   DISCORD_BOT_TOKEN=$($tokens['Discord Token'].Substring(0,20))..." -ForegroundColor Gray
        Write-Host "   NODE_ENV=production" -ForegroundColor Gray
        Write-Host "   PORT=3000" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. REDEPLOY:" -ForegroundColor Cyan
        Write-Host "   Click 'Deploy' → 'Redeploy'" -ForegroundColor White
        Write-Host ""
        Write-Host "4. UPDATE DISCORD:" -ForegroundColor Cyan
        Write-Host "   Add redirect URI in Discord Developer Portal" -ForegroundColor White
    }
    
    default {
        Write-Host "Usage:" -ForegroundColor Yellow
        Write-Host "  .\dissident-simple.ps1 -Action status" -ForegroundColor White
        Write-Host "  .\dissident-simple.ps1 -Action deploy" -ForegroundColor White
        Write-Host "  .\dissident-simple.ps1 -Action setup" -ForegroundColor White
    }
}

Write-Host ""
