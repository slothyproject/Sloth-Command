param(
    [string]$Project = "resplendent-fulfillment",
    [string]$Service = "ollama-service",
    [string]$Environment = "production",
    [string]$Model = "llama3.1:8b"
)

$ErrorActionPreference = "Stop"

Write-Host "== Railway Ollama Deploy ==" -ForegroundColor Cyan

if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "Railway CLI not found. Installing @railway/cli..." -ForegroundColor Yellow
    npm install -g @railway/cli
}

Write-Host "Ensuring Railway auth..." -ForegroundColor Cyan
railway whoami | Out-Null

Write-Host "Linking service..." -ForegroundColor Cyan
railway link --project $Project --service $Service --environment $Environment

Write-Host "Setting Ollama env vars..." -ForegroundColor Cyan
railway variables set "OLLAMA_MODEL=$Model"
railway variables set "OLLAMA_SKIP_PULL=false"

Write-Host "Deploying ollama-railway/railway.json..." -ForegroundColor Cyan
railway up --detach --config "ollama-railway/railway.json"

Write-Host "Done. Open Railway service and copy public URL for Base URL field." -ForegroundColor Green
