# 🚀 Central Hub Backend - Automatic Setup Guide

## Method 1: One-Click Railway Template (Recommended)

### Step 1: Deploy from Template
```bash
# Click this button in Railway or run:
railway login
railway init --template https://github.com/slothyproject/central-hub-v3
```

### Step 2: Add PostgreSQL (Auto-detected)
Railway will automatically offer to add PostgreSQL when it sees `DATABASE_URL` in your code.

### Step 3: Done! ✅
Variables are auto-configured. Just deploy!

---

## Method 2: Manual Steps with Auto-Configuration

### Step 1: Create Backend Service
1. Railway Dashboard → **New Project**
2. **Deploy from GitHub repo**
3. Select: `slothyproject/central-hub-v3`

### Step 2: Configure Service
1. Name: `central-hub-api`
2. **Root Directory**: `apps/api`
3. Click **Deploy**

### Step 3: Auto-Setup (One-time)
The setup script runs automatically:
- ✅ Installs dependencies
- ✅ Generates Prisma client
- ✅ Runs migrations
- ✅ Seeds database with default password

---

## Method 3: Railway CLI (Full Automation)

### One Command Deploy:
```bash
# Install Railway CLI if not already
npm install -g @railway/cli

# Login
railway login

# Create project from template
railway init --template slothyproject/central-hub-v3

# Link to database
railway add --database postgres

# Deploy
railway up

# Done!
```

---

## Required Environment Variables

These are **automatically** set by Railway when you add PostgreSQL:

| Variable | Auto-Set | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection |
| `PORT` | ✅ Yes | Server port (3001) |
| `JWT_SECRET` | ❌ Manual | Create random string |
| `DEFAULT_PASSWORD` | ❌ Manual | Your login password |

### Only 2 Manual Variables!

1. **JWT_SECRET**: Create a random string (e.g., `openssl rand -base64 32`)
2. **DEFAULT_PASSWORD**: Choose your login password

---

## Verification

After deployment, check:

```bash
# Health check
curl https://your-backend.up.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

---

## Troubleshooting

### Issue: "Cannot find module"
**Fix**: The Dockerfile runs `npm ci` automatically. Wait for build to complete.

### Issue: "Database connection failed"
**Fix**: Ensure PostgreSQL is in the same project as your backend.

### Issue: "Port already in use"
**Fix**: Railway auto-assigns port. Don't set PORT manually.

---

## Frontend Configuration

After backend deploys, add to frontend:

```
NEXT_PUBLIC_API_URL=https://your-backend.up.railway.app
```

Replace `your-backend` with your actual Railway URL.

---

## Summary

| Step | Manual Work |
|------|-------------|
| Create service | Click 3 buttons |
| Configure build | 0 (auto-detected) |
| Add database | 1 click |
| Set variables | 2 manual entries |
| Deploy | Automatic |

**Total manual work**: About 2 minutes! 🎉
