# 🚀 Central Hub 3.0 Deployment Guide

## Quick Deploy Options

### Option 1: Vercel (Recommended - 2 minutes)

1. **Push to GitHub**
   ```bash
   # Create a new repository on GitHub named "central-hub-v3"
   # Then push the code:
   git remote add origin https://github.com/YOUR_USERNAME/central-hub-v3.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Configure build settings:
     - Framework Preset: Next.js
     - Build Command: `npm run build`
     - Output Directory: `.next`
   - Deploy!

3. **Set Environment Variables**
   - `NEXT_PUBLIC_API_URL`: Your backend API URL

### Option 2: Railway (5 minutes)

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Link**
   ```bash
   railway login
   railway link
   ```

3. **Deploy**
   ```bash
   cd apps/web
   railway up
   ```

### Option 3: Manual Deploy to VPS

1. **Build the Application**
   ```bash
   cd apps/web
   npm install
   npm run build
   ```

2. **Start Production Server**
   ```bash
   npm start
   ```

## 📁 Deployment Package Contents

```
central-hub-v3/
├── apps/
│   └── web/               # Next.js frontend
│       ├── app/           # Application code
│       ├── public/        # Static assets
│       ├── .next/         # Build output (after build)
│       ├── package.json
│       └── next.config.ts
└── README.md
```

## 🔧 Environment Variables

Create `.env.local` file:

```env
# Required
NEXT_PUBLIC_API_URL=https://your-api.com/api

# Optional
NEXT_PUBLIC_WS_URL=wss://your-api.com/ws
```

## 📊 Build Verification

Check these before deploying:

- [ ] `npm run build` completes successfully
- [ ] No TypeScript errors
- [ ] All environment variables set
- [ ] Backend API is running

## 🌐 Production URLs

After deployment, your app will be available at:
- **Vercel**: `https://your-project.vercel.app`
- **Railway**: `https://your-app.railway.app`
- **Custom**: Your configured domain

## 📝 Post-Deployment Checklist

- [ ] Login page loads correctly
- [ ] Dashboard displays services
- [ ] AI Hub loads with charts
- [ ] Analytics shows data
- [ ] Settings page works
- [ ] Keyboard shortcuts functional
- [ ] PWA installable

## 🆘 Troubleshooting

### Build Errors
- Run `npm install` again
- Check Node.js version (18+)
- Clear `.next` cache: `rm -rf .next`

### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` is set
- Check CORS configuration on backend
- Test API endpoints with curl/Postman

### Runtime Errors
- Check browser console for errors
- Verify all environment variables
- Check network tab for failed requests

## 🎉 You're Live!

Once deployed, your Central Hub 3.0 instance is ready:
- **Login URL**: `https://your-domain.com/login`
- **Dashboard**: `https://your-domain.com/dashboard`
- **AI Hub**: `https://your-domain.com/dashboard/ai-hub`

Enjoy your enterprise Railway management platform! 🚀
