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
    "DISCORD_CLIENT_SECRET" = "9NzuUZN8sDXsZ3xrG5tWcl_ufVTY-6F8"
    "DISCORD_REDIRECT_URI" = "https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback"
    "JWT_SECRET" = "7imR5TEIcxaD6eUnkvr34XhwNMOH1JLVtZQPAyKoFpslfzbd2j08CSuYgB9WqG"
    "FRONTEND_URL" = "https://dissident.mastertibbles.co.uk"
    "DISCORD_BOT_TOKEN" = "MTQ5MzYzOTE2NzUyNjE3NDgzMA.G01Mjj.R7mgmGzGSEUEpN90oAaq5bA16-CwHYVuXIRjHw"
    "NODE_ENV" = "production"
    "PORT" = "3000"
}

Write-Host "Setting Railway environment variables..." -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Gray
Write-Host ""

cd "E:\Projects God Tier\Dissident-api-backend"

# Set token
$env:RAILWAY_TOKEN = "28e52518-445f-499f-a406-daeeb7149f2b"

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
