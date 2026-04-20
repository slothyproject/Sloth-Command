# Dissident Complete Automation System

**One-command setup and deployment for the entire Dissident platform.**

## 🚀 Quick Start

### Option 1: PowerShell Master Script (Recommended)

```powershell
# Setup everything
.\dissident-master.ps1 -Action setup

# Deploy everything
.\dissident-master.ps1 -Action deploy

# Check status
.\dissident-master.ps1 -Action status
```

### Option 2: Component-Specific

```powershell
# Setup only backend
.\dissident-master.ps1 -Action setup -Component backend

# Deploy only frontend
.\dissident-master.ps1 -Action deploy -Component frontend
```

## 📋 Available Actions

| Action | Description |
|--------|-------------|
| `setup` | Configure all components with secrets |
| `deploy` | Push code and trigger deployments |
| `status` | Show status of all components |
| `env` | Create/update environment secrets |
| `test` | Test prerequisites |

## 🏗️ Architecture

```
Dissident Platform
├── Frontend (Website)
│   ├── Repository: Dissident-Website
│   ├── Tech: HTML/CSS/JS + Nginx
│   └── Deploy: Railway (Docker)
│
├── Backend (API + Bot)
│   ├── Repository: Dissident-api-backend
│   ├── Tech: Node.js + Express
│   ├── Database: PostgreSQL
│   └── Deploy: Railway (Docker)
│
└── Discord Bot
    ├── Integrated in Backend
    └── Auto-deployed with API
```

## 🔧 Prerequisites

- Git
- Node.js 18+
- Railway CLI (optional, for manual deploy)
- PowerShell 7+ (for master script)

## 📁 File Structure

```
E:\Projects God Tier\
├── dissident-master.ps1       # Main automation script
├── dissident-config.json      # Project configuration
├── dissident-frontend/        # Frontend repo
├── dissident-backend/         # Backend repo
├── secrets.json               # Generated secrets (auto-created)
└── deployment-state.json      # Deployment tracking
```

## 🎯 Workflow

### Initial Setup

1. **Run setup** (generates secrets, configures repos):
   ```powershell
   .\dissident-master.ps1 -Action setup
   ```

2. **Complete Railway deployment** (manual step):
   - Go to https://railway.com/dashboard
   - Set environment variables
   - Click "Redeploy"

3. **Update Discord OAuth**:
   - Add redirect URIs
   - Save changes

### Regular Deployments

1. **Make changes** to code
2. **Run deploy**:
   ```powershell
   .\dissident-master.ps1 -Action deploy
   ```
3. **Or use GitHub Actions** (auto-deploys on push)

## 🔐 Secrets Management

The system automatically:
- Generates JWT secrets
- Creates secure API keys
- Stores credentials in `secrets.json`
- Never commits secrets to GitHub

## 🛠️ Troubleshooting

### Check Prerequisites
```powershell
.\dissident-master.ps1 -Action test
```

### View Status
```powershell
.\dissident-master.ps1 -Action status
```

### Manual Railway Deployment
If automatic deploy fails:
1. Go to https://railway.com/dashboard
2. Click your service
3. Go to Variables tab
4. Paste variables from output
5. Click Deploy → Redeploy

## 📊 Monitoring

- **Health Check**: `/api/health`
- **Version**: `/api/version`
- **Logs**: Railway dashboard
- **Status**: Run `.\dissident-master.ps1 -Action status`

## 🔄 Automated Workflows

GitHub Actions automatically:
- Deploys on every push to main
- Runs health checks
- Notifies on deployment status

## 📝 Configuration

Edit `dissident-config.json` to customize:
- Repository URLs
- Service names
- Domain names
- Feature flags

## 🎉 Success Indicators

You'll see:
- ✅ "Setup Complete!"
- ✅ "Deployment Complete!"
- ✅ "Health check passed"

## 🆘 Need Help?

1. Check logs: Railway dashboard → Logs tab
2. Test locally: `.\dissident-master.ps1 -Action test`
3. Verify secrets: `.\dissident-master.ps1 -Action env`

## 📚 Next Steps

After setup:
1. Test Discord login on your website
2. Verify bot is online
3. Check all endpoints respond
4. Monitor logs for errors

---

**🚀 Ready to automate? Run:**
```powershell
.\dissident-master.ps1 -Action setup
```
