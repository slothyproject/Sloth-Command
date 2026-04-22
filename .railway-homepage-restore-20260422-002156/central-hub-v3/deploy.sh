#!/bin/bash

# Central Hub - Emergency Deployment Script
# Run this to deploy backend to Railway

echo "🚀 Central Hub Emergency Deployment"
echo "===================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔑 Logging into Railway..."
railway login

# Link to project
echo "🔗 Linking to Central Hub project..."
railway link

# Check current services
echo "📋 Current services:"
railway service list

# Deploy API service with correct path
echo "🚀 Deploying central-hub-api with correct root directory..."
echo "Root Directory: central-hub-v3/apps/api"

# Set environment variables if not already set
echo "🔧 Checking environment variables..."

# Note: You'll need to manually set these in Railway Dashboard:
# - DATABASE_URL
# - JWT_SECRET  
# - DEFAULT_PASSWORD
# - PORT

echo ""
echo "⚠️  IMPORTANT MANUAL STEPS:"
echo "1. Go to Railway Dashboard: https://railway.app/dashboard"
echo "2. Click on 'central-hub-api' service"
echo "3. Go to Settings"
echo "4. Set Root Directory to: central-hub-v3/apps/api"
echo "5. Set Builder to: Dockerfile"
echo "6. Click Deploy"
echo ""
echo "Or run this command after setting variables:"
echo "railway up --service central-hub-api"
