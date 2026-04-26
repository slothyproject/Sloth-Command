# DETAILED Manual Railway Deployment Guide
## For Dissident Backend API

---

## Step 1: Access Railway Dashboard

**What to do:**
1. Open your web browser
2. Go to: https://railway.com/dashboard
3. Login with your Railway account
4. You should see your existing project "resplendent-fulfillment"

**Screenshot should show:** Railway dashboard with your project listed

---

## Step 2: Create New Service

**What to do:**
1. Look for the button that says **"New"** or **"+"** (usually top right)
2. Click it
3. Select **"Service"** from the dropdown
4. Choose **"GitHub Repo"**

**OR Alternative:**
1. Click on your project name: **resplendent-fulfillment**
2. Look for **"Create a new service"** or **"New Service"**
3. Click it
4. Select **"Deploy from GitHub repo"**

**What to select:**
- Repository: **slothyproject/Dissident-api-backend**
- Branch: **main**
- Click **"Deploy"** or **"Add Service"**

**Expected:** Railway starts building your service

---

## Step 3: Configure Build Settings (CRITICAL)

**What to do:**
1. Wait for Railway to finish initial deployment attempt (may fail - that's OK)
2. Click on your new service name (will be auto-generated, like "Dissident-api-backend")
3. Click the **"Settings"** tab at the top
4. Look for **"Build"** section

**Configure Build:**
```
Builder: [Dropdown] Select "Dockerfile"
Dockerfile Path: [Text field] Enter "Dockerfile"
Build Context: [Text field] Enter "." (just a period)
```

**Configure Deploy:**
```
Start Command: [Text field] Enter "node server.js"
Healthcheck Path: [Text field] Enter "/api/health"
Healthcheck Timeout: [Number] Enter "30"
Restart Policy: [Dropdown] Select "On Failure"
```

**Click "Save" button**

**Screenshot location:** Settings tab with these fields visible

---

## Step 4: Add Environment Variables (MOST CRITICAL)

**What to do:**
1. In the same Settings page, look for **"Variables"** tab
2. Click **"Variables"**
3. You should see a table/list of variables (probably empty)
4. Click **"New Variable"** or **"+"** button

**Add EACH of these one by one:**

### Variable 1: DISCORD_CLIENT_ID
```
Key: DISCORD_CLIENT_ID
Value: 1493639167526174830
```
Click **"Add"**

### Variable 2: DISCORD_CLIENT_SECRET
```
Key: DISCORD_CLIENT_SECRET
Value: REPLACE_WITH_DISCORD_CLIENT_SECRET
```
(Copy from your tokens.env line 3)
Click **"Add"**

### Variable 3: DISCORD_REDIRECT_URI
```
Key: DISCORD_REDIRECT_URI
Value: https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback
```
(Note: This URL might be slightly different - use the one Railway shows in your service settings)
Click **"Add"**

### Variable 4: JWT_SECRET
```
Key: JWT_SECRET
Value: REPLACE_WITH_JWT_SECRET
```
(Copy from your tokens.env line 5)
Click **"Add"**

### Variable 5: FRONTEND_URL
```
Key: FRONTEND_URL
Value: https://dissident.mastertibbles.co.uk
```
Click **"Add"**

### Variable 6: DISCORD_BOT_TOKEN
```
Key: DISCORD_BOT_TOKEN
Value: REPLACE_WITH_DISCORD_BOT_TOKEN
```
(Copy from your tokens.env line 2 - the long token)
Click **"Add"**

### Variable 7: NODE_ENV
```
Key: NODE_ENV
Value: production
```
Click **"Add"**

### Variable 8: PORT
```
Key: PORT
Value: 3000
```
Click **"Add"**

**Expected result:** 8 variables listed in the table

**Screenshot:** Variables tab showing all 8 variables

---

## Step 5: Deploy the Service

**What to do:**
1. Click **"Deploy"** tab at the top
2. Look for **"Redeploy"** button
3. Click **"Redeploy"**
4. Wait for build to complete (watch the logs streaming)

**Watch for these log messages:**
```
✓ Building Dockerfile
✓ Pushing image
✓ Deploying
✓ Service is live
```

**OR if logs show errors:**
- Check that all variables are entered correctly
- Check Dockerfile path is correct
- Check start command is "node server.js"

---

## Step 6: Get Your Backend URL

**What to do:**
1. After deployment succeeds, click **"Settings"** tab
2. Look for **"Domain"** or **"Public URL"**
3. You should see something like:
   ```
   https://dissident-api-backend-production.up.railway.app
   ```
   OR
   ```
   https://dissident-api-backend-abc123.up.railway.app
   ```

**COPY THIS URL!** You'll need it for the next steps.

**Alternative location:**
- Click on the service name
- Look for "URL" or "Domain" section
- Copy the https:// URL

---

## Step 7: Update Discord Developer Portal

**What to do:**
1. Go to: https://discord.com/developers/applications
2. Find and click on your **"Dissident Bot"** application
3. In the left sidebar, click **"OAuth2"** → **"General"**
4. Scroll to **"Redirects"** section
5. Look for text field that says "Enter redirect URL"
6. **PASTE your Railway URL + "/callback"**
   
   Example:
   ```
   https://dissident-api-backend-production.up.railway.app/api/auth/discord/callback
   ```

7. Click **"+"** or **"Add"** button next to the field
8. Scroll down and click **"Save Changes"** at the bottom

**Expected:** Your redirect URI now appears in the list below the input field

---

## Step 8: Test the Backend

**Test URLs in browser:**

1. **Health Check:**
   ```
   https://YOUR-URL/api/health
   ```
   Should show: `{"status":"ok","discordConnected":true}`

2. **Version Check:**
   ```
   https://YOUR-URL/api/version
   ```
   Should show: `{"version":"...","timestamp":...}`

3. **OAuth Start:**
   ```
   https://YOUR-URL/api/auth/discord
   ```
   Should redirect to Discord login

---

## Step 9: Update Frontend

**If the URL is different from expected:**

1. Go to your frontend repository: `E:\Projects God Tier\Dissident-Website`
2. Open file: `af78bb.html`
3. Find line 85 (search for "discord" or "OAuth")
4. Change the URL from:
   ```
   https://dissident-api-backend-production.up.railway.app
   ```
   To your ACTUAL URL:
   ```
   https://YOUR-ACTUAL-URL.up.railway.app
   ```

5. Save file
6. Commit and push:
   ```powershell
   git add af78bb.html
   git commit -m "Update backend URL"
   git push origin main
   ```

7. Redeploy frontend in Railway (if needed)

---

## Step 10: Final Test

1. Go to your website login page
2. Click **"Continue with Discord"**
3. You should see Discord authorization popup
4. Authorize the app
5. Should redirect back to your dashboard!

**If it works: SUCCESS! 🎉**

**If it fails:**
- Check Railway logs for errors
- Verify Discord redirect URI matches EXACTLY
- Check all environment variables are correct
- Make sure URL in frontend matches backend URL

---

## Quick Reference: Your Tokens

From `E:\Projects God Tier\Dissident-Website\tokens.env`:

| Variable | Value |
|----------|-------|
| Railway Token | REPLACE_WITH_RAILWAY_TOKEN |
| Discord Token | REPLACE_WITH_DISCORD_BOT_TOKEN |
| Client Secret | REPLACE_WITH_DISCORD_CLIENT_SECRET |
| Client ID | 1493639167526174830 |
| JWT Secret | REPLACE_WITH_JWT_SECRET |

---

## Need Help?

**Run the auto-deployment script:**
```powershell
cd "E:\Projects God Tier"
.\auto-deploy-backend.ps1
```

**Or check logs:**
In Railway dashboard → Click your service → Click "Deploy" tab → View logs

**Common errors:**
- "Invalid OAuth2 redirect_uri" = Discord redirect doesn't match
- "Build failed" = Check Dockerfile path in settings
- "Service not starting" = Check environment variables are all set


