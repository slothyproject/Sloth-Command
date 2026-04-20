@echo off
chcp 65001 >nul
title Token Vault Railway Setup
cls

echo ================================================
echo    TOKEN VAULT - RAILWAY DEPLOYMENT SETUP
echo ================================================
echo.
echo Repository: https://github.com/slothyproject/Tokens-Vault
echo Target URL: https://dissidenttokens.mastertibbles.co.uk
echo.

:MENU
echo What would you like to do?
echo.
echo 1. Deploy to Railway via GitHub (Recommended)
echo 2. Open Railway Dashboard
echo 3. Setup Custom Domain
echo 4. Check Deployment Status
echo 5. View Configuration Files
echo 6. Push Latest Changes to GitHub
echo 7. Exit
echo.
set /p choice="Enter choice (1-7): "

if "%choice%"=="1" goto DEPLOY_GITHUB
if "%choice%"=="2" goto OPEN_DASHBOARD
if "%choice%"=="3" goto SETUP_DOMAIN
if "%choice%"=="4" goto CHECK_STATUS
if "%choice%"=="5" goto VIEW_CONFIG
if "%choice%"=="6" goto PUSH_CHANGES
if "%choice%"=="7" goto EXIT

goto MENU

:DEPLOY_GITHUB
echo.
echo ================================================
echo DEPLOY TO RAILWAY VIA GITHUB
echo ================================================
echo.
echo Opening Railway New Service page...
echo.
echo Steps to deploy:
echo 1. Click "New" in Railway dashboard
echo 2. Select "GitHub Repo"
echo 3. Choose: slothyproject/Tokens-Vault
echo 4. Railway will auto-detect the Dockerfile
echo 5. Deploy!
echo.
start "" "https://railway.app/project/resplendent-fulfillment"
echo.
echo Press any key when deployment is complete...
pause >nul
goto MENU

:OPEN_DASHBOARD
echo.
echo Opening Railway Dashboard...
start "" "https://railway.app/project/resplendent-fulfillment/service/dissident-tokens-vault"
goto MENU

:SETUP_DOMAIN
echo.
echo ================================================
echo CUSTOM DOMAIN SETUP
echo ================================================
echo.
echo Domain: dissidenttokens.mastertibbles.co.uk
echo.
echo Steps:
echo 1. In Railway Dashboard, go to the Token Vault service
echo 2. Click "Settings" → "Domains"
echo 3. Click "Custom Domain"
echo 4. Enter: dissidenttokens.mastertibbles.co.uk
echo 5. Copy the CNAME target provided
echo.
echo DNS Configuration:
echo   Type: CNAME
echo   Name: dissidenttokens
echo   Value: [Railway provided endpoint]
echo   TTL: 3600
echo.
echo Press any key to open Railway domains settings...
pause >nul
start "" "https://railway.app/project/resplendent-fulfillment/service/dissident-tokens-vault/settings/domains"
goto MENU

:CHECK_STATUS
echo.
echo ================================================
echo CHECKING DEPLOYMENT STATUS
echo ================================================
echo.
echo Testing Vault URL...
curl -s -o nul -w "%%{http_code}" https://dissidenttokens.mastertibbles.co.uk > temp_status.txt 2>nul
set /p status=<temp_status.txt
del temp_status.txt 2>nul

echo   dissidenttokens.mastertibbles.co.uk
echo   Status Code: %status%
echo.
if "%status%"=="200" (
    echo   [OK] Token Vault is running!
) else if "%status%"=="000" (
    echo   [PENDING] Domain not yet active or service not deployed
    echo   Check Railway dashboard for deployment status
) else (
    echo   [WARNING] Unexpected status code: %status%
)
echo.
pause
goto MENU

:VIEW_CONFIG
echo.
echo ================================================
echo CONFIGURATION FILES
echo ================================================
echo.
echo Files in Dissident-Tokens-Vault:
echo.
dir /b "E:\Projects God Tier\Dissident-Tokens-Vault"
echo.
echo Key files:
echo   - Dockerfile          : Container configuration
echo   - railway.toml        : Railway deployment settings
echo   - index.html          : Main application
echo   - RAILWAY_SETUP.md    : Full documentation
echo.
pause
goto MENU

:PUSH_CHANGES
echo.
echo ================================================
echo PUSHING CHANGES TO GITHUB
echo ================================================
echo.
cd /d "E:\Projects God Tier\Dissident-Tokens-Vault"
echo Current directory: %cd%
echo.
echo Adding all changes...
git add -A
echo.
echo Checking for changes to commit...
git diff --cached --quiet
if %errorlevel% == 0 (
    echo No changes to commit
echo.
) else (
    set /p msg="Enter commit message: "
    git commit -m "%msg%"
    echo.
    echo Pushing to GitHub...
    git push origin main
    echo.
    echo [OK] Changes pushed! Railway will auto-deploy.
)
echo.
pause
goto MENU

:EXIT
echo.
echo Goodbye!
timeout /t 2 >nul
exit /b 0
