#!/bin/sh
set -e

echo "🚀 Starting Central Hub API..."

# Wait a moment for database connection to be ready
sleep 2

# Create database tables if they don't exist
echo "📦 Setting up database..."
npx prisma db push --accept-data-loss || echo "⚠️  Database setup may have already been completed"

# Start the server
echo "🔥 Starting server..."
exec node dist/index.js
