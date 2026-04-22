# Dissident Master Deployment Script
# One-command deployment for the entire Dissident platform

param(
    [Parameter()]
    [ValidateSet("all", "backend", "frontend", "vault", "status", "setup-railway")]
    [string]$Action = "status",
    
    [Parameter()]
    [switch]$Force,
    
    [Parameter()]
    [switch]$ShowLogs
)

# Configuration
$ConfigPath = "E:\Projects God Tier\dissident-config.json"
$LogPath = "E:\Projects God Tier\dissident-deploy.log"

# Colors
$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Header = "Magenta"
}

function Write-ColorMessage {
    param($Message, $Color = "White", [switch]$NoNewline)
    if ($NoNewline) {
        Write-Host $Message -ForegroundColor $Colors[$Color] -NoNewline
    } else {
        Write-Host $Message -ForegroundColor $Colors[$Color]
    }
}

function Log-Message {
    param($Message, $Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp [$Level] $Message" | Out-File -FilePath $LogPath -Append
}

# Load configuration
function Load-Config {
    if (Test-Path $ConfigPath) {
        return Get-Content $ConfigPath | ConvertFrom-Json
    }
    Write-ColorMessage "Configuration not found at $ConfigPath" "Error"
    exit 1
}

# Display banner
function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-ColorMessage "══════════════════════════════════════════════════════════" "Header"
    Write-ColorMessage "         DISSIDENT PLATFORM MASTER CONTROLLER" "Header"
    Write-ColorMessage "            Discord Bot Management System" "Header"
    Write-ColorMessage "══════════════════════════════════════════════════════════" "Header"
    Write-Host ""
    Write-ColorMessage "Version: 2.0.0 | Status: " "Info" -NoNewline
    Write-ColorMessage "PRODUCTION READY" "Success"
    Write-Host ""
    Write-ColorMessage "──────────────────────────────────────────────────────────" "Info"
    Write-Host ""
}

# Show status
function Show-Status {
    param($Config)
    
    Write-ColorMessage "DISSIDENT PLATFORM STATUS" "Header"
    Write-Host ""
    
    # Frontend
    Write-ColorMessage "Frontend Website" "Header"
    Write-ColorMessage "  Repository: $($Config.components.frontend.repo)" "Info"
    Write-ColorMessage "  Deploy URL: $($Config.components.frontend.deployUrl)" "Info"
    if (Test-Path $Config.components.frontend.path) {
        Push-Location $Config.components.frontend.path
        $branch = git branch --show-current 2>$null
        $dirty = if (git status --porcelain 2>$null) { " (uncommitted changes)" } else { "" }
        Pop-Location
        Write-ColorMessage "  Status: Clean (branch: $branch)$dirty" "Success"
    } else {
        Write-ColorMessage "  Status: Path not found" "Error"
    }
    Write-Host ""
    
    # Backend
    Write-ColorMessage "Backend API" "Header"
    Write-ColorMessage "  Repository: $($Config.components.backend.repo)" "Info"
    Write-ColorMessage "  Deploy URL: $($Config.components.backend.deployUrl)" "Info"
    if (Test-Path $Config.components.backend.path) {
        Push-Location $Config.components.backend.path
        $branch = git branch --show-current 2>$null
        $dirty = if (git status --porcelain 2>$null) { " (uncommitted changes)" } else { "" }
        Pop-Location
        Write-ColorMessage "  Status: Clean (branch: $branch)$dirty" "Success"
    } else {
        Write-ColorMessage "  Status: Path not found" "Error"
    }
    Write-Host ""
    
    # Vault
    Write-ColorMessage "Token Vault" "Header"
    Write-ColorMessage "  Repository: $($Config.components.vault.repo)" "Info"
    Write-ColorMessage "  Deploy URL: $($Config.components.vault.deployUrl)" "Info"
    if (Test-Path $Config.components.vault.path) {
        Push-Location $Config.components.vault.path
        $branch = git branch --show-current 2>$null
        $dirty = if (git status --porcelain 2>$null) { " (uncommitted changes)" } else { "" }
        Pop-Location
        Write-ColorMessage "  Status: Clean (branch: $branch)$dirty" "Success"
    } else {
        Write-ColorMessage "  Status: Path not found" "Error"
    }
    Write-Host ""
    
    Write-ColorMessage "Quick Links:" "Header"
    Write-ColorMessage "  Discord App: https://discord.com/developers/applications/$($Config.discord.applicationId)" "Info"
    Write-ColorMessage "  Railway: https://railway.app/project/$($Config.railway.projectId)" "Info"
    Write-ColorMessage "  Backend Health: $($Config.components.backend.deployUrl)/api/health" "Info"
}

# Setup Railway environment variables
function Setup-RailwayEnv {
    param($Config)
    
    Write-ColorMessage "Setting up Railway Environment Variables..." "Header"
    Write-Host ""
    
    # Load tokens
    $tokensPath = "E:\Projects God Tier\Dissident-Website\tokens.env"
    if (-not (Test-Path $tokensPath)) {
        Write-ColorMessage "tokens.env not found at $tokensPath" "Error"
        return
    }
    
    $tokens = @{}
    Get-Content $tokensPath | ForEach-Object {
        if ($_ -match "^(.+?):\s*(.+)$") {
            $tokens[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    
    Write-ColorMessage "Found credentials for:" "Info"
    $tokens.Keys | ForEach-Object { Write-ColorMessage "  - $_" "Info" }
    Write-Host ""
    
    Write-ColorMessage "Environment variables to set in Railway:" "Header"
    Write-ColorMessage "  DISCORD_CLIENT_ID: $($Config.discord.clientId)" "Info"
    Write-ColorMessage "  DISCORD_CLIENT_SECRET: [HIDDEN]" "Info"
    Write-ColorMessage "  DISCORD_BOT_TOKEN: [HIDDEN]" "Info"
    Write-ColorMessage "  JWT_SECRET: [HIDDEN]" "Info"
    Write-ColorMessage "  FRONTEND_URL: $($Config.components.frontend.deployUrl)" "Info"
    Write-ColorMessage "  NODE_ENV: production" "Info"
    Write-ColorMessage "  PORT: 3000" "Info"
    Write-Host ""
    
    Write-ColorMessage "Options:" "Header"
    Write-ColorMessage "1. Open Railway Dashboard (recommended)" "Info"
    Write-ColorMessage "2. Generate Railway CLI commands file" "Info"
    Write-ColorMessage "3. Skip (manual setup)" "Info"
    Write-Host ""
    
    $choice = Read-Host "Select option (1-3)"
    
    switch ($choice) {
        "1" {
            $url = "https://railway.app/project/$($Config.railway.projectId)/service/$($Config.components.backend.railwayService)/variables"
            Start-Process $url
            Write-ColorMessage "Opening Railway dashboard..." "Success"
            Write-ColorMessage "Paste the values from RAILWAY_ENV_SETUP.env" "Info"
        }
        "2" {
            $cliPath = "E:\Projects God Tier\RAILWAY_CLI_COMMANDS.ps1"
            $cliContent = @"
# Railway CLI Commands
railway login
railway link --project $($Config.railway.projectId) --service $($Config.components.backend.railwayService)

railway variables set "DISCORD_CLIENT_ID=$($Config.discord.clientId)"
railway variables set "DISCORD_CLIENT_SECRET=$($tokens['Client Secret'])"
railway variables set "DISCORD_BOT_TOKEN=$($tokens['Discord Token'])"
railway variables set "JWT_SECRET=$($tokens['JWT Secret'])"
railway variables set "FRONTEND_URL=$($Config.components.frontend.deployUrl)"
railway variables set "NODE_ENV=production"
railway variables set "PORT=3000"

Write-Host "Environment variables set successfully!" -ForegroundColor Green
"@
            $cliContent | Out-File $cliPath
            Write-ColorMessage "CLI commands saved to: $cliPath" "Success"
            Write-ColorMessage "Run: powershell -File $cliPath" "Info"
        }
        default {
            Write-ColorMessage "Skipping. See RAILWAY_ENV_SETUP.env for manual setup." "Warning"
        }
    }
}

# Deploy function
function Deploy-Component {
    param($Name, $Path, $Repo)
    
    Write-ColorMessage "Deploying $Name..." "Header"
    Log-Message "Starting deployment of $Name"
    
    Push-Location $Path
    
    # Check for changes
    $status = git status --porcelain
    if ($status -and -not $Force) {
        Write-ColorMessage "Uncommitted changes found. Commit first? [Y/n]: " "Warning" -NoNewline
        $response = Read-Host
        if ($response -ne 'n') {
            $msg = Read-Host "Enter commit message"
            git add -A
            git commit -m $msg
        }
    }
    
    # Push to trigger deployment
    Write-ColorMessage "Pushing to GitHub to trigger deployment..." "Info"
    git push origin HEAD
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage "Push successful! Deployment triggered." "Success"
        Log-Message "$Name deployed successfully"
    } else {
        Write-ColorMessage "Push failed for $Name" "Error"
        Log-Message "$Name deployment failed" "ERROR"
    }
    
    Pop-Location
}

# Main execution
Show-Banner
$config = Load-Config

switch ($Action) {
    "status" {
        Show-Status -Config $config
    }
    "all" {
        Write-ColorMessage "Deploying ALL components..." "Header"
        Write-Host ""
        Deploy-Component -Name "Token Vault" -Path $config.components.vault.path -Repo $config.components.vault.repo
        Deploy-Component -Name "Backend API" -Path $config.components.backend.path -Repo $config.components.backend.repo
        Deploy-Component -Name "Frontend Website" -Path $config.components.frontend.path -Repo $config.components.frontend.repo
        Write-Host ""
        Write-ColorMessage "All deployments triggered!" "Success"
    }
    "backend" {
        Deploy-Component -Name "Backend API" -Path $config.components.backend.path -Repo $config.components.backend.repo
    }
    "frontend" {
        Deploy-Component -Name "Frontend Website" -Path $config.components.frontend.path -Repo $config.components.frontend.repo
    }
    "vault" {
        Deploy-Component -Name "Token Vault" -Path $config.components.vault.path -Repo $config.components.vault.repo
    }
    "setup-railway" {
        Setup-RailwayEnv -Config $config
    }
}

Write-Host ""
Write-ColorMessage "──────────────────────────────────────────────────────────" "Info"
Write-ColorMessage "Log saved to: $LogPath" "Info"
