# Setup Complete! Next Steps

## What I've Automated For You:

### Backend Repository (NEW)
✅ Created: https://github.com/slothyproject/Dissident-api-backend
✅ Files included:
   - server.js (API with Discord OAuth)
   - bot.js (Discord bot)
   - package.json (dependencies)
   - Dockerfile (container config)
   - railway.toml (Railway deployment config)
   - .github/workflows/deploy.yml (auto-deployment)
   - deploy.ps1 (verification script)

### Frontend Repository (UPDATED)
✅ Updated: af78bb.html login page
✅ Changed Discord OAuth URL to point to new backend

## Your Next Steps:

### Step 1: Deploy Backend to Railway (MANUAL)

1. Go to https://railway.com/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose: **slothyproject/Dissident-api-backend**
5. Click **"Add"**

### Step 2: Add Environment Variables

In Railway dashboard, click **Variables** tab and add:

| Variable | Value | Where to get it |
|----------|-------|-----------------|
| `DISCORD_CLIENT_ID` | `1493639167526174830` | Already know this |
| `DISCORD_CLIENT_SECRET` | **YOUR_SECRET** | Discord Developer Portal → Reset Secret |
| `DISCORD_REDIRECT_URI` | **AUTO_GENERATED** | Will be: `https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback` |
| `JWT_SECRET` | **RANDOM_STRING** | Generate random 64-character string |
| `FRONTEND_URL` | `https://dissident.mastertibbles.co.uk` | Your frontend domain |
| `DATABASE_URL` | **AUTO_ADDED** | Railway will add if you have PostgreSQL |
| `DISCORD_BOT_TOKEN` | **YOUR_BOT_TOKEN** | Discord Developer Portal |
| `NODE_ENV` | `production` | Fixed value |

### Step 3: Update Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Select your Dissident Bot
3. Go to **OAuth2 → General**
4. Add this Redirect URI:
   ```
   https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback
   ```
5. Click **Save Changes**

### Step 4: Update Frontend (if URL is different)

If Railway gives you a different URL, update:
- File: `E:\Projects God Tier\Dissident-Website\af78bb.html`
- Line 85: Change the Discord OAuth URL

### Step 5: Test

1. Go to your login page
2. Click "Continue with Discord"
3. Should work! 🎉

## Repository URLs:

- **Frontend**: https://github.com/slothyproject/Dissident-Website
- **Backend**: https://github.com/slothyproject/Dissident-api-backend

## Troubleshooting:

If deployment fails:
1. Check Railway logs for errors
2. Verify all environment variables are set
3. Ensure Discord redirect URI matches exactly

Run the verification script:
```powershell
cd "E:\Projects God Tier\Dissident-api-backend"
.\deploy.ps1
```
