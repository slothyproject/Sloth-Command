#!/bin/sh
# =============================================================================
# Central Hub API Startup Script v3.0
# The app handles all DB initialization in initializeDatabase()
# No prisma db push needed - uses CREATE TABLE IF NOT EXISTS
# =============================================================================

echo "🚀 Central Hub API - Starting..."
echo "📂 Working directory: $(pwd)"
echo "📂 Contents: $(ls dist/ 2>/dev/null | head -5 || echo 'dist/ not found')"

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi
echo "✅ DATABASE_URL configured"

# Generate Prisma client if needed (should already be built in Docker image)
if [ ! -d "node_modules/.prisma" ]; then
    echo "⚠️  Generating Prisma client..."
    npx prisma generate --schema=src/prisma/schema.prisma 2>&1 || echo "Prisma generate warning (non-fatal)"
fi

echo "🔥 Starting Node.js server..."
exec node dist/index.js
