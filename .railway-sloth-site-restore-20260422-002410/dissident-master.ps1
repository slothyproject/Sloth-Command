#!/usr/bin/env pwsh
#Requires -Version 7.0

<#
.SYNOPSIS
    Dissident Complete Automation System
    
.DESCRIPTION
    Master script that automates setup, configuration, and deployment
    of all Dissident components: Frontend Website, Backend API, and Discord Bot
    
.EXAMPLE
    .\dissident-master.ps1 -Action setup
    .\dissident-master.ps1 -Action deploy
    .\dissident-master.ps1 -Action status
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("setup", "deploy", "status", "logs", "env", "test", "full-reset")]
    [string]$Action,
    
    [Parameter()]
    [ValidateSet("all", "frontend", "backend", "bot")]
    [string]$Component = "all",
    
    [Parameter()]
    [switch]$AutoApprove,
    
    [Parameter()]
    [string]$ConfigPath = "$PSScriptRoot\dissident-config.json"
)

# Error handling
$ErrorActionPreference = "Stop"

# Colors for output
$colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Debug = "Gray"
}

function Write-Status($Message, $Level = "Info") {
    $color = $colors[$Level]
    Write-Host "[$Level] $Message" -ForegroundColor $color
}

function Write-Header($Title) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Read-Config($Path) {
    if (-not (Test-Path $Path)) {
        throw "Configuration file not found: $Path"
    }
    
    $content = Get-Content $Path -Raw
    return $content | ConvertFrom-Json
}

function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    $prereqs = @(
        @{ Name = "Git"; Command = "git --version"; Required = $true },
        @{ Name = "Node.js"; Command = "node --version"; Required = $true },
        @{ Name = "npm"; Command = "npm --version"; Required = $true },
        @{ Name = "Railway CLI"; Command = "railway --version"; Required = $false }
    )
    
    foreach ($prereq in $prereqs) {
        try {
            $output = Invoke-Expression $prereq.Command 2>$null
            Write-Status "$($prereq.Name): $output" "Success"
        } catch {
            if ($prereq.Required) {
                Write-Status "$($prereq.Name): NOT FOUND (Required)" "Error"
                return $false
            } else {
                Write-Status "$($prereq.Name): NOT FOUND (Optional)" "Warning"
            }
        }
    }
    
    return $true
}

function Invoke-Setup {
    param($Config, $Component)
    
    Write-Header "Setting up Dissident Project"
    
    # Load or prompt for secrets
    $secrets = Get-OrCreateSecrets
    
    # Setup Frontend
    if ($Component -eq "all" -or $Component -eq "frontend") {
        Setup-Frontend -Config $Config -Secrets $secrets
    }
    
    # Setup Backend
    if ($Component -eq "all" -or $Component -eq "backend") {
        Setup-Backend -Config $Config -Secrets $secrets
    }
    
    # Setup Bot (part of backend)
    if ($Component -eq "all" -or $Component -eq "bot") {
        Write-Status "Bot is configured as part of backend" "Info"
    }
    
    # Save configuration
    Save-DeploymentState -Config $Config -Secrets $secrets
    
    Write-Header "Setup Complete!"
    Show-NextSteps
}

function Get-OrCreateSecrets {
    Write-Status "Loading secrets..." "Info"
    
    $secretsFile = "$PSScriptRoot\secrets.json"
    
    if (Test-Path $secretsFile) {
        $secrets = Get-Content $secretsFile -Raw | ConvertFrom-Json
        Write-Status "Loaded existing secrets" "Success"
    } else {
        Write-Status "Creating new secrets file..." "Warning"
        
        # Generate secrets
        $secrets = @{
            jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
            apiKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
            created = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        }
        
        # Prompt for required secrets
        Write-Host ""
        Write-Host "Please provide your Discord credentials:" -ForegroundColor Yellow
        Write-Host "(Get these from https://discord.com/developers/applications)" -ForegroundColor Gray
        Write-Host ""
        
        $secrets.discordClientId = Read-Host "Discord Client ID"
        $secrets.discordClientSecret = Read-Host "Discord Client Secret" -AsSecureString | ConvertFrom-SecureString
        $secrets.discordBotToken = Read-Host "Discord Bot Token" -AsSecureString | ConvertFrom-SecureString
        $secrets.railwayToken = Read-Host "Railway Token (from tokens.env)" -AsSecureString | ConvertFrom-SecureString
        
        # Save secrets
        $secrets | ConvertTo-Json | Out-File $secretsFile
        Write-Status "Secrets saved to secrets.json" "Success"
    }
    
    return $secrets
}

function Setup-Frontend {
    param($Config, $Secrets)
    
    Write-Header "Setting up Frontend"
    
    $frontend = $Config.components.frontend
    
    Write-Status "Frontend path: $($frontend.path)" "Info"
    
    # Check if directory exists
    if (-not (Test-Path $frontend.path)) {
        Write-Status "Cloning frontend repository..." "Info"
        git clone $frontend.repo $frontend.path
    }
    
    # Navigate to frontend
    Push-Location $frontend.path
    
    try {
        # Check for updates
        Write-Status "Checking for updates..." "Info"
        git fetch origin
        git pull origin main
        
        # Update configuration files
        Update-FrontendConfig -Config $Config
        
        Write-Status "Frontend setup complete" "Success"
    } finally {
        Pop-Location
    }
}

function Setup-Backend {
    param($Config, $Secrets)
    
    Write-Header "Setting up Backend"
    
    $backend = $Config.components.backend
    
    Write-Status "Backend path: $($backend.path)" "Info"
    
    # Check if directory exists
    if (-not (Test-Path $backend.path)) {
        Write-Status "Cloning backend repository..." "Info"
        git clone $backend.repo $backend.path
    }
    
    # Navigate to backend
    Push-Location $backend.path
    
    try {
        # Check for updates
        Write-Status "Checking for updates..." "Info"
        git fetch origin
        git pull origin main
        
        # Create environment file for Railway
        $envContent = @"
# Auto-generated by Dissident Master Script
DISCORD_CLIENT_ID=$($Config.discord.clientId)
DISCORD_CLIENT_SECRET=$($Secrets.discordClientSecret)
DISCORD_REDIRECT_URI=$($Config.discord.oauthRedirectUri)
JWT_SECRET=$($Secrets.jwtSecret)
FRONTEND_URL=$($Config.components.frontend.deployUrl)
DISCORD_BOT_TOKEN=$($Secrets.discordBotToken)
NODE_ENV=production
PORT=3000
"@
        
        $envContent | Out-File ".env.railway" -Encoding UTF8
        Write-Status "Created .env.railway for Railway deployment" "Success"
        
        Write-Status "Backend setup complete" "Success"
    } finally {
        Pop-Location
    }
}

function Update-FrontendConfig {
    param($Config)
    
    Write-Status "Updating frontend configuration..." "Info"
    
    # Update login page with backend URL
    $loginFile = Join-Path $Config.components.frontend.path "af78bb.html"
    if (Test-Path $loginFile) {
        $content = Get-Content $loginFile -Raw
        $backendUrl = $Config.components.backend.deployUrl
        
        # Replace Discord OAuth URL
        $pattern = 'href="https://[^"]+/api/auth/discord"'
        $replacement = "href=`"$backendUrl/api/auth/discord`""
        $content = $content -replace $pattern, $replacement
        
        $content | Out-File $loginFile -Encoding UTF8
        Write-Status "Updated login page with backend URL: $backendUrl" "Success"
    }
}

function Invoke-Deploy {
    param($Config, $Component)
    
    Write-Header "Deploying Dissident Components"
    
    $secrets = Get-OrCreateSecrets
    
    # Deploy Backend first (required for frontend)
    if ($Component -eq "all" -or $Component -eq "backend") {
        Deploy-Backend -Config $Config -Secrets $secrets
    }
    
    # Deploy Frontend
    if ($Component -eq "all" -or $Component -eq "frontend") {
        Deploy-Frontend -Config $Config -Secrets $secrets
    }
    
    # Bot is part of backend
    if ($Component -eq "bot") {
        Write-Status "Bot is deployed as part of backend" "Info"
    }
    
    Write-Header "Deployment Complete!"
}

function Deploy-Backend {
    param($Config, $Secrets)
    
    Write-Header "Deploying Backend"
    
    $backend = $Config.components.backend
    
    Push-Location $backend.path
    try {
        Write-Status "Pushing code to GitHub..." "Info"
        git add -A 2>$null
        git commit -m "Auto-deployment: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" --no-verify 2>$null
        git push origin main
        
        Write-Status "Code pushed. Now deploy via Railway dashboard." "Warning"
        Write-Host ""
        Write-Host "Manual step required:" -ForegroundColor Yellow
        Write-Host "1. Go to: https://railway.com/dashboard" -ForegroundColor White
        Write-Host "2. Click service: $($backend.railwayService)" -ForegroundColor White
        Write-Host "3. Click 'Deploy' → 'Redeploy'" -ForegroundColor White
        Write-Host ""
        
        # Open Railway dashboard
        Start-Process "https://railway.com/project/$($Config.railway.projectId)"
    } finally {
        Pop-Location
    }
}

function Deploy-Frontend {
    param($Config, $Secrets)
    
    Write-Header "Deploying Frontend"
    
    $frontend = $Config.components.frontend
    
    Push-Location $frontend.path
    try {
        Write-Status "Pushing code to GitHub..." "Info"
        git add -A 2>$null
        git commit -m "Auto-deployment: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" --no-verify 2>$null
        git push origin main
        
        Write-Status "Frontend deployed (GitHub Actions will handle Railway deployment)" "Success"
    } finally {
        Pop-Location
    }
}

function Get-Status {
    param($Config)
    
    Write-Header "Dissident Project Status"
    
    $components = @($Config.components.frontend, $Config.components.backend)
    
    foreach ($comp in $components) {
        Write-Host "`n$($comp.name):" -ForegroundColor Cyan
        Write-Host "  Path: $($comp.path)" -ForegroundColor Gray
        
        # Check if directory exists
        if (Test-Path $comp.path) {
            Write-Host "  Status: EXISTS" -ForegroundColor Green
            
            # Check git status
            Push-Location $comp.path
            try {
                $branch = git rev-parse --abbrev-ref HEAD 2>$null
                $lastCommit = git log -1 --format="%h %s" 2>$null
                Write-Host "  Branch: $branch" -ForegroundColor Gray
                Write-Host "  Last Commit: $lastCommit" -ForegroundColor Gray
            } finally {
                Pop-Location
            }
        } else {
            Write-Host "  Status: NOT FOUND" -ForegroundColor Red
        }
        
        Write-Host "  Deploy URL: $($comp.deployUrl)" -ForegroundColor Gray
    }
    
    Write-Host ""
}

function Save-DeploymentState {
    param($Config, $Secrets)
    
    $state = @{
        timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
        config = $Config
        components = @{
            frontend = Test-Path $Config.components.frontend.path
            backend = Test-Path $Config.components.backend.path
        }
    }
    
    $state | ConvertTo-Json -Depth 10 | Out-File "$PSScriptRoot\deployment-state.json"
    Write-Status "Deployment state saved" "Info"
}

function Show-NextSteps {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  NEXT STEPS" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "1. Complete Railway deployment:" -ForegroundColor White
    Write-Host "   - Go to https://railway.com/dashboard" -ForegroundColor Cyan
    Write-Host "   - Set environment variables" -ForegroundColor Cyan
    Write-Host "   - Redeploy services" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Update Discord OAuth settings:" -ForegroundColor White
    Write-Host "   - Add redirect URIs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Test the application:" -ForegroundColor White
    Write-Host "   - Visit your website" -ForegroundColor Cyan
    Write-Host "   - Test Discord login" -ForegroundColor Cyan
    Write-Host ""
}

# MAIN EXECUTION
Write-Header "Dissident Master Controller v2.0"

# Load configuration
try {
    $config = Read-Config -Path $ConfigPath
    Write-Status "Configuration loaded from $ConfigPath" "Success"
} catch {
    Write-Status "Failed to load configuration: $_" "Error"
    exit 1
}

# Execute requested action
switch ($Action) {
    "setup" {
        if (Test-Prerequisites) {
            Invoke-Setup -Config $config -Component $Component
        }
    }
    "deploy" {
        Invoke-Deploy -Config $config -Component $Component
    }
    "status" {
        Get-Status -Config $config
    }
    "env" {
        Get-OrCreateSecrets
        Write-Status "Environment file created/updated" "Success"
    }
    "test" {
        Test-Prerequisites
    }
    default {
        Write-Status "Unknown action: $Action" "Error"
        exit 1
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
Write-Host ""
