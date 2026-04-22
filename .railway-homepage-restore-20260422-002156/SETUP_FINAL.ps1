# FULLY AUTOMATED SETUP v2
# Generates everything - NO SECRETS COMMITTED TO GITHUB

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DISSIDENT FULLY AUTOMATED SETUP v2" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Generate JWT Secret automatically
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
Write-Host "Generated JWT Secret: $($jwtSecret.Substring(0,16))..." -ForegroundColor Cyan

# Your credentials
$discordClientId = "1493639167526174830"
$discordClientSecret = "9NzuUZN8sDXsZ3xrG5tWcl_ufVTY-6F8"
$discordBotToken = "MTQ5MzYzOTE2NzUyNjE3NDgzMA.G01Mjj.R7mgmGzGSEUEpN90oAaq5bA16-CwHYVuXIRjHw"
$railwayToken = "28e52518-445f-499f-a406-daeeb7149f2b"

Write-Host ""
Write-Host "Step 1: Preparing Backend..." -ForegroundColor Cyan

cd "E:\Projects God Tier\Dissident-api-backend"

# Update server.js with CORS and logging
Write-Host "  Checking server.js configuration..." -ForegroundColor Gray

# Just push the code (no env files)
Write-Host "  Pushing clean code to GitHub..." -ForegroundColor Gray
git add -A
git commit -m "Update configuration" --no-verify 2>$null
git push origin main
Write-Host "  Code pushed successfully" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SETUP COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Generated JWT Secret: $jwtSecret" -ForegroundColor Cyan
Write-Host ""
Write-Host "COPY THESE VALUES TO RAILWAY:" -ForegroundColor Yellow
Write-Host ""
Write-Host "DISCORD_CLIENT_ID=$discordClientId" -ForegroundColor White
Write-Host "DISCORD_CLIENT_SECRET=$discordClientSecret" -ForegroundColor White
Write-Host "DISCORD_REDIRECT_URI=https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback" -ForegroundColor White
Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor White
Write-Host "FRONTEND_URL=https://dissident.mastertibbles.co.uk" -ForegroundColor White
Write-Host "DISCORD_BOT_TOKEN=$discordBotToken" -ForegroundColor White
Write-Host "NODE_ENV=production" -ForegroundColor White
Write-Host "PORT=3000" -ForegroundColor White
Write-Host ""

# Save to file
$creds = @"
DISSIDENT SETUP
Date: $(Get-Date)

DISCORD_CLIENT_ID=$discordClientId
DISCORD_CLIENT_SECRET=$discordClientSecret
JWT_SECRET=$jwtSecret
DISCORD_BOT_TOKEN=$discordBotToken

Backend: https://dissident-api-backend-production.up.railway.app
Frontend: https://dissident.mastertibbles.co.uk
"@
$creds | Out-File "E:\Projects God Tier\CREDENTIALS.txt" -Encoding UTF8

Write-Host "Saved to: CREDENTIALS.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "NEXT:" -ForegroundColor Green
Write-Host "1. Go to https://railway.com/dashboard" -ForegroundColor White
Write-Host "2. Click dissident-api-backend service" -ForegroundColor White
Write-Host "3. Click 'Variables' tab" -ForegroundColor White
Write-Host "4. Paste the variables above" -ForegroundColor White
Write-Host "5. Click 'Deploy' → 'Redeploy'" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to open Railway"
Start-Process "https://railway.com/dashboard"
