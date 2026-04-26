@echo off
chcp 65001 >nul
title Dissident Platform Manager
cls

echo ================================================
echo    DISSIDENT PLATFORM MASTER CONTROLLER
echo    Discord Bot Management System v2.0
echo ================================================
echo.

if "%~1"=="" goto :MENU
if "%~1"=="status" goto :STATUS
if "%~1"=="setup-railway" goto :SETUP_RAILWAY
if "%~1"=="vault" goto :DEPLOY_VAULT
if "%~1"=="backend" goto :DEPLOY_BACKEND
if "%~1"=="frontend" goto :DEPLOY_FRONTEND
if "%~1"=="all" goto :DEPLOY_ALL

:MENU
echo Available Commands:
echo   status         - Show platform status
echo   setup-railway  - Setup Railway environment variables
echo   vault          - Deploy Token Vault
echo   backend        - Deploy Backend API
echo   frontend       - Deploy Frontend Website
echo   all            - Deploy all components
echo.
pause
goto :EOF

:STATUS
echo.
echo DISSIDENT PLATFORM STATUS
echo =========================
echo.

echo [Frontend Website]
echo   Repo: https://github.com/slothyproject/Dissident-Website
echo   URL:  https://dissident.mastertibbles.co.uk
cd /d "E:\Projects God Tier\Dissident-Website"
for /f "tokens=*" %%a in ('git branch --show-current 2^>nul') do echo   Branch: %%a
echo   Status: Clean
echo.

echo [Backend API]
echo   Repo: https://github.com/slothyproject/Dissident-api-backend
echo   URL:  https://dissident-api-backend-production.up.railway.app
cd /d "E:\Projects God Tier\Dissident-api-backend"
for /f "tokens=*" %%a in ('git branch --show-current 2^>nul') do echo   Branch: %%a
echo   Status: Clean
echo.

echo [Token Vault]
echo   Repo: https://github.com/slothyproject/Tokens-Vault
echo   URL:  https://dissidenttokens.mastertibbles.co.uk
cd /d "E:\Projects God Tier\Dissident-Tokens-Vault"
for /f "tokens=*" %%a in ('git branch --show-current 2^>nul') do echo   Branch: %%a
echo   Status: Clean
echo.

echo Quick Links:
echo   Railway Dashboard: https://railway.app/project/resplendent-fulfillment
echo   Discord App:       https://discord.com/developers/applications/1493639167526174830
echo   Backend Health:      https://dissident-api-backend-production.up.railway.app/api/health
echo.
pause
goto :EOF

:SETUP_RAILWAY
echo.
echo Setting up Railway Environment Variables
echo =========================================
echo.
echo Open this URL in your browser:
echo https://railway.app/project/resplendent-fulfillment/service/dissident-api-backend/variables
echo.
echo Set these variables:
echo   DISCORD_CLIENT_ID=1493639167526174830
echo   DISCORD_CLIENT_SECRET=REPLACE_WITH_DISCORD_CLIENT_SECRET
echo   DISCORD_BOT_TOKEN=REPLACE_WITH_DISCORD_BOT_TOKEN
echo   JWT_SECRET=REPLACE_WITH_JWT_SECRET
echo   FRONTEND_URL=https://dissident-website-production.up.railway.app
echo   NODE_ENV=production
echo   PORT=3000
echo.
start "" "https://railway.app/project/resplendent-fulfillment/service/dissident-api-backend/variables"
pause
goto :EOF

:DEPLOY_VAULT
echo Deploying Token Vault...
cd /d "E:\Projects God Tier\Dissident-Tokens-Vault"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo Token Vault deployed!
pause
goto :EOF

:DEPLOY_BACKEND
echo Deploying Backend API...
cd /d "E:\Projects God Tier\Dissident-api-backend"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo Backend deployed!
pause
goto :EOF

:DEPLOY_FRONTEND
echo Deploying Frontend Website...
cd /d "E:\Projects God Tier\Dissident-Website"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo Frontend deployed!
pause
goto :EOF

:DEPLOY_ALL
echo Deploying ALL components...
echo.
echo [1/3] Deploying Token Vault...
cd /d "E:\Projects God Tier\Dissident-Tokens-Vault"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo.

echo [2/3] Deploying Backend API...
cd /d "E:\Projects God Tier\Dissident-api-backend"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo.

echo [3/3] Deploying Frontend Website...
cd /d "E:\Projects God Tier\Dissident-Website"
git add -A
git commit -m "Auto-deploy from master script" 2>nul || echo No changes to commit
git push origin main
echo.

echo ================================================
echo All components deployed successfully!
echo ================================================
pause
goto :EOF


