#!/bin/sh
set -e

echo "🚀 Central Hub API v1.2 - Starting up..."
echo "📂 Working directory: $(pwd)"
echo "📂 Contents: $(ls -la)"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi

echo "✅ DATABASE_URL is configured"

# Check if Prisma schema exists
echo "🔍 Checking Prisma schema..."
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma schema found at prisma/schema.prisma"
    head -5 prisma/schema.prisma
else
    echo "❌ Prisma schema NOT found!"
    echo "📂 prisma directory contents:"
    ls -la prisma/ 2>/dev/null || echo "prisma directory doesn't exist"
    exit 1
fi

# Wait for database
echo "⏳ Waiting for database..."
sleep 5

# Run prisma db push with full output
echo "📦 Running: npx prisma db push --accept-data-loss"
npx prisma db push --accept-data-loss 2>&1 || {
    echo "❌ prisma db push failed!"
    echo "Trying with verbose output..."
    npx prisma db push --accept-data-loss --verbose 2>&1 || true
}

# Verify
echo "🔍 Verifying database..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count().then(c => console.log('Users:', c)).catch(e => console.log('Error:', e.message)).finally(() => prisma.\$disconnect());
"

echo "🔥 Starting server..."
exec node dist/index.js
