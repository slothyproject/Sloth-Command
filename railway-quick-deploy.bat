@echo off
chcp 65001 > nul
echo ============================================
echo   Railway CLI Quick Commands
echo ============================================
echo.
echo Your tokens are loaded from tokens.env
echo.

REM Set Railway token from tokens.env
for /f "tokens=1,* delims=: " %%a in ('type "E:\Projects God Tier\Dissident-Website\tokens.env" ^| findstr "Railways Token"') do (
    set "RAILWAY_TOKEN=%%b"
)

echo Railway Token: %RAILWAY_TOKEN:~0,8%...
echo.

REM Change to backend directory
cd /d "E:\Projects God Tier\Dissident-api-backend"

echo Available commands:
echo.
echo 1. Login to Railway:
echo    railway login --token %RAILWAY_TOKEN%
echo.
echo 2. Deploy current project:
echo    railway up
echo.
echo 3. View logs:
echo    railway logs
echo.
echo 4. Set environment variables:
echo    railway variables set "KEY=VALUE"
echo.
echo 5. Open dashboard:
echo    railway open
echo.
echo 6. Check status:
echo    railway status
echo.

REM Auto-login and show options
set /p choice="Enter command number (1-6) or 'all' to deploy: "

if "%choice%"=="1" goto login
if "%choice%"=="2" goto deploy
if "%choice%"=="3" goto logs
if "%choice%"=="4" goto setvar
if "%choice%"=="5" goto open
if "%choice%"=="6" goto status
if "%choice%"=="all" goto fulldeploy
goto end

:login
echo Logging in...
railway login --token %RAILWAY_TOKEN%
pause
goto end

:deploy
echo Deploying...
railway up
pause
goto end

:logs
echo Showing logs...
railway logs
pause
goto end

:setvar
echo Set environment variable
echo.
echo From your tokens.env:
echo - DISCORD_CLIENT_ID: 1493639167526174830
echo - DISCORD_CLIENT_SECRET: 9NzuUZN8sDXsZ3xrG5tWcl_ufVTY-6F8
echo - JWT_SECRET: MgpyVa9e01DlHZzKYFrJWsEjMJPlKbJvzDREw3LTRzEwVboZBBiPyHqCWw8GyuKX
echo - DISCORD_BOT_TOKEN: (from line 2 of tokens.env)
echo.
set /p varname="Enter variable name: "
set /p varvalue="Enter variable value: "
railway variables set "%varname%=%varvalue%"
pause
goto end

:open
echo Opening Railway dashboard...
railway open
goto end

:status
echo Checking status...
railway status
pause
goto end

:fulldeploy
echo ============================================
echo Running Full Deployment
echo ============================================
echo.
echo Step 1: Logging in...
railway login --token %RAILWAY_TOKEN%
echo.
echo Step 2: Linking to project...
railway link --project resplendent-fulfillment
echo.
echo Step 3: Setting all variables...

REM Set all variables from tokens.env
for /f "tokens=1,* delims=: " %%a in ('type "E:\Projects God Tier\Dissident-Website\tokens.env"') do (
    if "%%a"=="Client ID" railway variables set "DISCORD_CLIENT_ID=%%b"
    if "%%a"=="Client Secret" railway variables set "DISCORD_CLIENT_SECRET=%%b"
    if "%%a"=="JWT Secret" railway variables set "JWT_SECRET=%%b"
    if "%%a"=="Discord Token" railway variables set "DISCORD_BOT_TOKEN=%%b"
)

railway variables set "NODE_ENV=production"
railway variables set "PORT=3000"
railway variables set "FRONTEND_URL=https://dissident.mastertibbles.co.uk"

echo.
echo Step 4: Deploying...
railway up

echo.
echo ============================================
echo Deployment Complete!
echo ============================================
echo.
echo Check your Railway dashboard for the URL
echo.
pause
goto end

:end
echo.
echo Done!
pause
