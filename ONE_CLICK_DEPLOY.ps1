# ONE-CLICK RAILWAY DEPLOYER
# Sets all environment variables automatically

param(
    [string]$ServiceName = "dissident-api-backend"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "  ONE-CLICK RAILWAY DEPLOYER" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Credentials
$envVars = @{
    "DISCORD_CLIENT_ID" = "1493639167526174830"
    "DISCORD_CLIENT_SECRET" = "REPLACE_WITH_DISCORD_CLIENT_SECRET"
    "DISCORD_REDIRECT_URI" = "https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback"
    "JWT_SECRET" = "REPLACE_WITH_JWT_SECRET"
    "FRONTEND_URL" = "https://dissident.mastertibbles.co.uk"
    "DISCORD_BOT_TOKEN" = "REPLACE_WITH_DISCORD_BOT_TOKEN"
    "NODE_ENV" = "production"
    "PORT" = "3000"
}

Write-Host "Setting Railway environment variables..." -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Gray
Write-Host ""

cd "E:\Projects God Tier\Dissident-api-backend"

# Set token
$env:RAILWAY_TOKEN = "REPLACE_WITH_RAILWAY_TOKEN"

# Link to service
Write-Host "Linking to service..." -ForegroundColor Gray
railway service $ServiceName 2>&1 | Out-Null

# Set each variable
$count = 0
foreach ($var in $envVars.GetEnumerator()) {
    $count++
    Write-Host "[$count/8] Setting $($var.Key)..." -ForegroundColor Gray
    $result = railway variables set "$($var.Key)=$($var.Value)" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "     OK" -ForegroundColor Green
    } else {
        Write-Host "     Failed (may already exist)" -ForegroundColor Yellow
    }
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "Variables set! Deploying..." -ForegroundColor Cyan
railway up

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green


