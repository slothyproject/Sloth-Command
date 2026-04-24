# Dissident Platform - Current Status

## 📦 Components

### ✅ 1. Token Vault (COMPLETE)
- **Location**: `E:\Projects God Tier\Dissident-Tokens-Vault`
- **Repository**: https://github.com/slothyproject/Tokens-Vault
- **Features**:
  - ✅ Client-side AES-256 encryption
  - ✅ Secure token storage with CryptoJS
  - ✅ Export/import encrypted backups
  - ✅ Auto-generate `.env` config files
  - ✅ Dockerfile for containerized deployment
  - ✅ Railway.toml configured
  - ✅ GitHub Actions auto-deploy workflow

### ✅ 2. Backend API (READY FOR ENV SETUP)
- **Location**: `E:\Projects God Tier\Dissident-api-backend`
- **Repository**: https://github.com/slothyproject/Dissident-api-backend
- **Features**:
  - ✅ Express.js server
  - ✅ Discord OAuth integration
  - ✅ JWT authentication
  - ✅ Bot.js integration
  - ✅ Dockerfile fixed (npm install)
  - ✅ Railway.toml configured
  - ✅ GitHub Actions auto-deploy workflow
- **⚠️ NEEDS**: Environment variables set in Railway dashboard

### ✅ 3. Frontend Website (COMPLETE)
- **Location**: `E:\Projects God Tier\Dissident-Website`
- **Repository**: https://github.com/slothyproject/Dissident-Website
- **Features**:
  - ✅ Static HTML/CSS/JS
  - ✅ OAuth login integration
  - ✅ Dashboard UI
  - ✅ Multiple feature pages

## 🚀 Quick Commands

```powershell
# Check status of all components
.\dissident-deploy.ps1 -Action status

# Setup Railway environment variables
.\dissident-deploy.ps1 -Action setup-railway

# Deploy specific component
.\dissident-deploy.ps1 -Action backend
.\dissident-deploy.ps1 -Action vault
.\dissident-deploy.ps1 -Action frontend

# Deploy all components
.\dissident-deploy.ps1 -Action all
```

## 🔐 Environment Variables (REQUIRED)

The backend needs these set in Railway:

```bash
DISCORD_CLIENT_ID=1493639167526174830
DISCORD_CLIENT_SECRET=REPLACE_WITH_DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN=REPLACE_WITH_DISCORD_BOT_TOKEN
JWT_SECRET=REPLACE_WITH_JWT_SECRET
FRONTEND_URL=https://dissident-website-production.up.railway.app
NODE_ENV=production
PORT=3000
```

**Manual Setup**: See `RAILWAY_ENV_SETUP.env` for detailed instructions.

## 📡 Deployment URLs

| Component | URL | Status |
|-----------|-----|--------|
| Frontend | https://dissident.mastertibbles.co.uk | ✅ Live |
| Backend | https://dissident-api-backend-production.up.railway.app | ⏳ Needs env vars |
| Token Vault | https://dissidenttokens.mastertibbles.co.uk | ⏳ Needs Railway service |
| Discord App | https://discord.com/developers/applications/1493639167526174830 | ✅ Configured |

## 🎯 Next Steps

1. **Set Railway Environment Variables** (Critical)
   - Run: `.\dissident-deploy.ps1 -Action setup-railway`
   - Or open: https://railway.app/project/resplendent-fulfillment

2. **Add Token Vault Service to Railway**
   - Connect GitHub repo: `slothyproject/Tokens-Vault`
   - Railway will auto-detect Dockerfile

3. **Test OAuth Flow**
   - Try logging in via frontend
   - Verify callback works

4. **Configure Discord OAuth Redirect**
   - Add to Discord Developer Portal:
   - `https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback`

## 🛠️ Automation Files

- `dissident-deploy.ps1` - Master deployment controller
- `dissident-config.json` - Central configuration
- `RAILWAY_ENV_SETUP.env` - Environment variable reference
- `RAILWAY_CLI_COMMANDS.ps1` - CLI commands (auto-generated)

## 📝 Configuration

All configuration is centralized in `dissident-config.json`:
- Repository URLs
- Deployment settings
- Railway project/service IDs
- Domain mappings

---

**Last Updated**: 2026-04-17
**Version**: 2.0.0


