# 🚀 Deploy Central Hub Backend - 2 MINUTE GUIDE

## **EASIEST METHOD: Railway Template (Recommended)**

### Step 1: Click Deploy Button

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/central-hub)

**Or manually:**
1. Go to: https://railway.app/new/template
2. Enter GitHub URL: `https://github.com/slothyproject/central-hub-v3`
3. Click **Deploy**

### Step 2: Add Database (Auto-offered)
Railway will automatically detect you need PostgreSQL and offer to add it.

**Click: "Add PostgreSQL"**

### Step 3: Set 2 Variables Only

| Variable | What to enter |
|----------|---------------|
| `JWT_SECRET` | Type any random string |
| `DEFAULT_PASSWORD` | Your login password |

**Everything else is auto-configured!**

### Step 4: Done! ✅

Your backend URL will be: `https://central-hub-api-production.up.railway.app`

---

## **MANUAL METHOD (If Template Doesn't Work)**

### Step 1: Create Service
```
Railway Dashboard → New Project → Deploy from GitHub
→ Select: slothyproject/central-hub-v3
```

### Step 2: Configure Build
```
Root Directory: apps/api
Builder: Dockerfile (auto-detected)
```

### Step 3: Add PostgreSQL
```
Click "New" → "Database" → "Add PostgreSQL"
```

### Step 4: Add 2 Variables
```
JWT_SECRET=your-random-secret-string
DEFAULT_PASSWORD=your-login-password
```

### Step 5: Deploy
Click **Deploy** button

---

## **VERIFICATION**

After deployment, test:
```bash
curl https://YOUR-BACKEND.up.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"2025-..."}
```

---

## **FRONTEND CONNECTION**

Once backend works, add this to frontend:

```
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND.up.railway.app
```

---

## **AUTO-DEPLOYMENT (Future Updates)**

Every time you push to GitHub, it auto-deploys!

No manual intervention needed. ✅
