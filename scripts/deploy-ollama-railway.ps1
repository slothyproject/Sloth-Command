param(
    [string]$Project = "resplendent-fulfillment",
    [string]$Service = "ollama-service",
    [string]$Environment = "production",
    [string]$Model = "llama3.1:8b"
)

$ErrorActionPreference = "Stop"

Write-Host "== Railway Ollama Deploy ==" -ForegroundColor Cyan

$UseNpxRailway = $false
$RailwayExecutable = "railway"

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "Railway CLI not found. Installing @railway/cli..." -ForegroundColor Yellow
    npm install -g @railway/cli
    if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
        $UseNpxRailway = $true
    }
}

function Invoke-Railway {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    if ($UseNpxRailway) {
        & npx @railway/cli @Args
    } else {
        & $RailwayExecutable @Args
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Railway command failed: railway $($Args -join ' ')"
    }
}

Write-Host "Ensuring Railway auth..." -ForegroundColor Cyan
Invoke-Railway @("whoami") | Out-Null

Write-Host "Selecting/creating service..." -ForegroundColor Cyan
Invoke-Railway @("service", $Service)

Write-Host "Linking service..." -ForegroundColor Cyan
Invoke-Railway @("link", "--project", $Project, "--service", $Service, "--environment", $Environment)

Write-Host "Setting Ollama env vars..." -ForegroundColor Cyan
Invoke-Railway @("variables", "set", "OLLAMA_MODEL=$Model")
Invoke-Railway @("variables", "set", "OLLAMA_SKIP_PULL=false")

Write-Host "Deploying ollama-railway/railway.json..." -ForegroundColor Cyan
Invoke-Railway @("up", "--detach", "--config", "ollama-railway/railway.json")

Write-Host "Done. Open Railway service and copy public URL for Base URL field." -ForegroundColor Green
