# 🚨 EMERGENCY DEPLOYMENT GUIDE

## Problem Summary
Your backend (`central-hub-api`) build is failing because Railway can't find the files.

## Root Cause
The repository structure on GitHub has files nested at:
```
central-hub-v3/central-hub-v3/apps/api/
```

But locally they're at:
```
central-hub-v3/apps/api/
```

## Solution: Update Railway Configuration

### Step 1: Go to Railway Dashboard
https://railway.app/dashboard

### Step 2: Update central-hub-api Service

1. **Click on `central-hub-api` service**
2. **Go to Settings tab**
3. **Update these fields:**

| Field | Current Value | **New Value** |
|-------|---------------|---------------|
| **Root Directory** | `apps/api` | **`apps/api`** |
| **Builder** | (any) | **`Dockerfile`** |
| **Dockerfile Path** | `Dockerfile` | **`Dockerfile`** (keep same) |

4. **Click "Save"**
5. **Click "Redeploy"**

### Step 3: Verify Environment Variables

In `central-hub-api` → **Variables** tab, ensure you have:

```
DATABASE_URL=postgresql://postgres:... (your database URL)
JWT_SECRET=21f9e23281fd19b2341c187b2cdfd9bcfb97fed19821348d08a150fb2c330b40deec74a14b0f0ed7021e6a29970a372535d7fff9e689d5ec3a908c2183b61364
DEFAULT_PASSWORD=central-hub-2025
PORT=3001
```

### Step 4: Wait for Deploy

- Status should change from "Build failed" to "Building..." to "Online"
- This takes 2-5 minutes

### Step 5: Test Backend

Once Online, test with:
```bash
curl https://central-hub-api-production.up.railway.app/api/health
```

Should return: `{"status":"ok","timestamp":"..."}`

### Step 6: Update Frontend Variable

In `central-hub-v3` (frontend) service:

1. **Variables** tab
2. **Add New Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://central-hub-api-production.up.railway.app
   ```
3. **Redeploy frontend**

### Step 7: Test Login

Go to your frontend URL and login with:
- Password: `central-hub-2025`

## Alternative: Run Deploy Script

If you have Railway CLI installed:

```bash
# In terminal, navigate to project
cd "E:\Projects God Tier\central-hub-v3"

# Run deploy script
bash deploy.sh
```

Then follow the manual steps in the script output.

## Need Help?

If still failing:
1. Check Railway deploy logs for specific error
2. Verify GitHub has latest code (commit `69fc859` or later)
3. Ensure PostgreSQL database is connected
4. Contact me with the specific error message
