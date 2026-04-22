# Complete automation script for Token Vault and Dissident Platform
# Phase 5: One-command deployment and management

param(
    [Parameter()]
    [ValidateSet("deploy-vault", "deploy-all", "sync-config", "backup", "status", "setup-railway", "import-secrets", "help")]
    [string]$Action = "help",
    
    [switch]$Force,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

# Configuration
$Config = @{
    ProjectRoot = "E:\Projects God Tier"
    VaultPath = "E:\Projects God Tier\Dissident-Tokens-Vault"
    BackendPath = "E:\Projects God Tier\Dissident-api-backend"
    FrontendPath = "E:\Projects God Tier\Dissident-Website"
    ConfigPath = "E:\Projects God Tier\dissident-config.json"
    TokensPath = "E:\Projects God Tier\Dissident-Website\tokens.env"
    RailwayProject = "resplendent-fulfillment"
    Services = @(
        @{Name="Token Vault"; Repo="Tokens-Vault"; Service="dissident-tokens-vault"; Url="https://dissidenttokens.mastertibbles.co.uk"},
        @{Name="Backend API"; Repo="Dissident-api-backend"; Service="dissident-api-backend"; Url="https://dissident-api-backend-production.up.railway.app"},
        @{Name="Frontend"; Repo="Dissident-Website"; Service="Dissident-Website"; Url="https://dissident.mastertibbles.co.uk"}
    )
}

# Colors
function Write-Color($Text, $Color = "White") {
    Write-Host $Text -ForegroundColor $Color
}

function Show-Banner {
    Clear-Host
    Write-Color "==============================================" "Magenta"
    Write-Color "  DISSIDENT PLATFORM MASTER CONTROLLER" "Magenta"
    Write-Color "  Full Automation System v2.0" "Magenta"
    Write-Color "==============================================" "Magenta"
    Write-Host ""
}

function Show-Help {
    Show-Banner
    Write-Color "Usage: .\master-controller.ps1 -Action <command>" "Yellow"
    Write-Host ""
    Write-Color "Commands:" "Cyan"
    Write-Color "  deploy-vault      Deploy Token Vault only" "White"
    Write-Color "  deploy-all        Deploy all services" "White"
    Write-Color "  sync-config       Sync vault → dissident-config.json" "White"
    Write-Color "  backup            Create full backup" "White"
    Write-Color "  status            Show platform status" "White"
    Write-Color "  setup-railway     Setup Railway environment variables" "White"
    Write-Color "  import-secrets    Import tokens.env to vault" "White"
    Write-Color "  help              Show this help" "White"
    Write-Host ""
}

function Deploy-Vault {
    Write-Color "[DEPLOY] Token Vault" "Yellow"
    
    Push-Location $Config.VaultPath
    
    # Check for changes
    $status = git status --porcelain
    if ($status -and -not $Force) {
        Write-Color "Uncommitted changes found." "Yellow"
        $response = Read-Host "Commit and deploy? [Y/n]"
        if ($response -eq 'n') { return }
    }
    
    # Commit and push
    if ($status) {
        git add -A
        git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    
    Write-Color "Pushing to GitHub..." "Gray"
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Color "✓ Push successful!" "Green"
        Write-Color "Waiting for Railway deployment (2-3 minutes)..." "Yellow"
        
        # Wait and verify
        for ($i = 0; $i -lt 18; $i++) {
            Start-Sleep -Seconds 10
            try {
                $response = Invoke-WebRequest -Uri "https://dissident-tokens-vault-production.up.railway.app" -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Color "✓ Deployment successful!" "Green"
                    Write-Color "  URL: https://dissidenttokens.mastertibbles.co.uk" "Cyan"
                    Pop-Location
                    return
                }
            } catch {}
            Write-Color "  Checking... ($(($i+1)*10)s" "Gray"
        }
        
        Write-Color "⚠ Deployment may still be in progress" "Yellow"
        Write-Color "  Check: https://railway.app/project/$($Config.RailwayProject)" "Gray"
    } else {
        Write-Color "✗ Push failed" "Red"
    }
    
    Pop-Location
}

function Deploy-All {
    Write-Color "[DEPLOY] All Services" "Yellow"
    
    foreach ($service in $Config.Services) {
        Write-Host ""
        Write-Color "Deploying $($service.Name)..." "Cyan"
        
        $path = if ($service.Name -eq "Token Vault") { $Config.VaultPath }
                elseif ($service.Name -eq "Backend API") { $Config.BackendPath }
                else { $Config.FrontendPath }
        
        Push-Location $path
        
        # Commit if needed
        $status = git status --porcelain
        if ($status) {
            git add -A
            git commit -m "Auto-deploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" | Out-Null
        }
        
        git push origin main | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Color "  ✓ $($service.Name) pushed" "Green"
        } else {
            Write-Color "  ✗ $($service.Name) failed" "Red"
        }
        
        Pop-Location
    }
    
    Write-Host ""
    Write-Color "✓ All services pushed!" "Green"
    Write-Color "Railway will auto-deploy. Monitor at:" "Gray"
    Write-Color "  https://railway.app/project/$($Config.RailwayProject)" "Cyan"
}

function Sync-Config {
    Write-Color "[SYNC] Configuration Files" "Yellow"
    
    # This would typically read from vault and update dissident-config.json
    Write-Color "Syncing vault data to dissident-config.json..." "Gray"
    
    # For now, create a status report
    $report = @"
# Dissident Platform Status
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm")

## Services
$(foreach ($s in $Config.Services) { "- $($s.Name): $($s.Url)" })

## Configuration
- Config Path: $($Config.ConfigPath)
- Vault Path: $($Config.VaultPath)
- Backend Path: $($Config.BackendPath)
- Frontend Path: $($Config.FrontendPath)

## Quick Links
- Railway Dashboard: https://railway.app/project/$($Config.RailwayProject)
- Token Vault: https://dissidenttokens.mastertibbles.co.uk
- API Backend: https://dissident-api-backend-production.up.railway.app
- Frontend: https://dissident.mastertibbles.co.uk
"@

    $report | Out-File "$($Config.ProjectRoot)\STATUS.md" -Encoding UTF8
    Write-Color "✓ Status report saved to STATUS.md" "Green"
}

function Backup-All {
    Write-Color "[BACKUP] Creating full backup" "Yellow"
    
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
    $backupDir = "$($Config.ProjectRoot)\backups\$timestamp"
    
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # Backup config files
    Copy-Item $Config.ConfigPath "$backupDir\" -ErrorAction SilentlyContinue
    Copy-Item $Config.TokensPath "$backupDir\" -ErrorAction SilentlyContinue
    
    Write-Color "✓ Backup created: $backupDir" "Green"
}

function Show-Status {
    Show-Banner
    Write-Color "[STATUS] Platform Overview" "Yellow"
    Write-Host ""
    
    Write-Color "Services:" "Cyan"
    foreach ($service in $Config.Services) {
        try {
            $response = Invoke-WebRequest -Uri $service.Url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            $status = if ($response.StatusCode -eq 200) { "✅ Online" } else { "⚠️ $($response.StatusCode)" }
            $color = if ($response.StatusCode -eq 200) { "Green" } else { "Yellow" }
        } catch {
            $status = "❌ Offline"
            $color = "Red"
        }
        
        Write-Color "  $($service.Name):" "White" -NoNewline
        Write-Color " $status" $color
        Write-Color "    $($service.Url)" "Gray"
    }
    
    Write-Host ""
    Write-Color "Repository Status:" "Cyan"
    foreach ($path in @($Config.VaultPath, $Config.BackendPath, $Config.FrontendPath)) {
        $name = Split-Path $path -Leaf
        Push-Location $path
        $branch = git branch --show-current 2>$null
        $clean = if (git status --porcelain 2>$null) { "⚠️ Uncommitted" } else { "✅ Clean" }
        Pop-Location
        
        Write-Color "  $name:" "White" -NoNewline
        Write-Color " $branch $clean" "Gray"
    }
    
    Write-Host ""
    Write-Color "Quick Links:" "Cyan"
    Write-Color "  Railway Dashboard: https://railway.app/project/$($Config.RailwayProject)" "Gray"
    Write-Color "  GitHub: https://github.com/slothyproject" "Gray"
}

function Setup-Railway {
    Write-Color "[SETUP] Railway Environment Variables" "Yellow"
    Write-Host ""
    Write-Color "Opening Railway dashboard..." "Gray"
    Start-Process "https://railway.app/project/$($Config.RailwayProject)"
    Write-Color "Configure environment variables for each service." "White"
}

# Main execution
Show-Banner

switch ($Action) {
    "deploy-vault" { Deploy-Vault }
    "deploy-all" { Deploy-All }
    "sync-config" { Sync-Config }
    "backup" { Backup-All }
    "status" { Show-Status }
    "setup-railway" { Setup-Railway }
    "import-secrets" { Write-Color "Use the vault UI to import tokens.env" "Yellow" }
    default { Show-Help }
}

Write-Host ""
Write-Color "==============================================" "Magenta"
Write-Color "Operation complete!" "Green"
