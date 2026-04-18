#!/bin/sh
set -e

echo "🚀 Starting Central Hub API..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
sleep 3

# Create database tables if they don't exist
echo "📦 Setting up database..."
npx prisma db push --accept-data-loss
if [ $? -eq 0 ]; then
    echo "✅ Database setup complete"
else
    echo "⚠️  Database setup encountered issues, but continuing..."
fi

# Verify tables exist by running a quick check
echo "🔍 Verifying database connection..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count().then(count => {
  console.log('✅ Database connected! User count:', count);
  process.exit(0);
}).catch(err => {
  console.log('⚠️  Database check failed:', err.message);
  process.exit(0);
});
"

# Start the server
echo "🔥 Starting server on port ${PORT:-3001}..."
exec node dist/index.js
