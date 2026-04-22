#!/bin/bash

# Central Hub Backend Auto-Setup Script
# Run this after creating the service in Railway

set -e

echo "🚀 Central Hub Backend Auto-Setup"
echo "================================"

# Check if running in Railway environment
if [ -z "$RAILWAY_ENVIRONMENT" ]; then
    echo "⚠️  Warning: Not running in Railway environment"
    echo "This script is designed to run automatically in Railway"
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations (if DATABASE_URL exists)
if [ -n "$DATABASE_URL" ]; then
    echo "🗄️  Running database migrations..."
    npx prisma migrate deploy || echo "⚠️  Migration may have already run"
    
    # Seed database with default user
    echo "🌱 Seeding database..."
    npx prisma db seed || echo "⚠️  Seed may have already run"
else
    echo "⚠️  DATABASE_URL not set, skipping migrations"
fi

# Build TypeScript
echo "🏗️  Building TypeScript..."
npm run build

echo "✅ Setup complete! Starting server..."
exec npm start
