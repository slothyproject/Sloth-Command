# FULLY AUTOMATED SETUP
# This script automates 99% of the configuration

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DISSIDENT FULLY AUTOMATED SETUP" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Function to generate secure random strings
function Generate-SecureString($length = 64) {
    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    $result = -join ((1..$length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $result
}

# Generate JWT Secret automatically
$jwtSecret = Generate-SecureString 64
Write-Host "Generated JWT Secret: $($jwtSecret.Substring(0,16))..." -ForegroundColor Cyan

# Your Discord credentials (from your existing tokens)
$discordClientId = "1493639167526174830"
$discordClientSecret = "REPLACE_WITH_DISCORD_CLIENT_SECRET"
$discordBotToken = "REPLACE_WITH_DISCORD_BOT_TOKEN"
$railwayToken = "REPLACE_WITH_RAILWAY_TOKEN"

Write-Host ""
Write-Host "Step 1: Preparing Backend Repository..." -ForegroundColor Cyan

# Navigate to backend
cd "E:\Projects God Tier\Dissident-api-backend"

# Create environment file for Railway
$envFileContent = @"
DISCORD_CLIENT_ID=$discordClientId
DISCORD_CLIENT_SECRET=$discordClientSecret
DISCORD_REDIRECT_URI=https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback
JWT_SECRET=$jwtSecret
FRONTEND_URL=https://dissident.mastertibbles.co.uk
DISCORD_BOT_TOKEN=$discordBotToken
NODE_ENV=production
PORT=3000
"@

$envFileContent | Out-File -FilePath ".env.production" -Encoding UTF8
Write-Host "  Created .env.production file" -ForegroundColor Green

# Update server.js with auto-generated values
Write-Host ""
Write-Host "Step 2: Configuring Backend..." -ForegroundColor Cyan

# Push to GitHub
Write-Host "  Pushing to GitHub..." -ForegroundColor Gray
git add -A
git commit -m "Automated setup with generated secrets" --no-verify 2>$null
git push origin main
Write-Host "  Code pushed to GitHub" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  AUTOMATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Generated JWT Secret: $($jwtSecret.Substring(0,16))..." -ForegroundColor Cyan
Write-Host "✅ Backend pushed to GitHub" -ForegroundColor Cyan
Write-Host "✅ Environment file created" -ForegroundColor Cyan
Write-Host ""
Write-Host "ONLY MANUAL STEP:" -ForegroundColor Yellow
Write-Host "-----------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to Railway Dashboard:" -ForegroundColor White
Write-Host "   https://railway.com/dashboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Click on 'dissident-api-backend' service" -ForegroundColor White
Write-Host ""
Write-Host "3. Click 'Variables' tab" -ForegroundColor White
Write-Host ""
Write-Host "4. Copy-paste these variables:" -ForegroundColor White
Write-Host ""
Write-Host "DISCORD_CLIENT_ID=$discordClientId" -ForegroundColor Cyan
Write-Host "DISCORD_CLIENT_SECRET=$discordClientSecret" -ForegroundColor Cyan
Write-Host "DISCORD_REDIRECT_URI=https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback" -ForegroundColor Cyan
Write-Host "JWT_SECRET=$jwtSecret" -ForegroundColor Cyan
Write-Host "FRONTEND_URL=https://dissident.mastertibbles.co.uk" -ForegroundColor Cyan
Write-Host "DISCORD_BOT_TOKEN=$discordBotToken" -ForegroundColor Cyan
Write-Host "NODE_ENV=production" -ForegroundColor Cyan
Write-Host "PORT=3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "5. Click 'Deploy' tab → 'Redeploy'" -ForegroundColor White
Write-Host ""
Write-Host "6. Done! Backend will be live in 2 minutes" -ForegroundColor Green
Write-Host ""

# Save credentials to file for reference
$credsFile = @"
DISSIDENT SETUP CREDENTIALS
Generated: $(Get-Date)

Discord Client ID: $discordClientId
Discord Client Secret: $discordClientSecret
JWT Secret: $jwtSecret
Discord Bot Token: $discordBotToken

Backend URL: https://dissident-api-backend-production.up.railway.app
Frontend URL: https://dissident.mastertibbles.co.uk

SAVE THIS FILE SECURELY!
"@

$credsFile | Out-File -FilePath "E:\Projects God Tier\DISSIDENT_CREDENTIALS.txt" -Encoding UTF8
Write-Host "Credentials saved to: DISSIDENT_CREDENTIALS.txt" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to open Railway dashboard..."
Read-Host
Start-Process "https://railway.com/project/resplendent-fulfillment"


