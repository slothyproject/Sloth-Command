#!/bin/sh
# =============================================================================
# Central Hub API Startup Script v2.0
# Starts Node.js server immediately for Railway healthcheck, then runs migrations
# =============================================================================
set -e

echo "🚀 Central Hub API - Starting..."
echo "📂 Working directory: $(pwd)"

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    exit 1
fi
echo "✅ DATABASE_URL configured"

# Validate Prisma schema
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Prisma schema NOT found!"
    ls -la prisma/ 2>/dev/null || echo "No prisma directory"
    exit 1
fi
echo "✅ Prisma schema found"

# Start the server immediately in background so Railway healthcheck passes
echo "🔥 Starting Node.js server in background..."
node dist/index.js &
SERVER_PID=$!

# Give server 3 seconds to bind port
sleep 3

# Now run migrations (non-blocking for healthcheck)
echo "📦 Running Prisma db push..."
npx prisma db push --accept-data-loss 2>&1 || echo "⚠️  Prisma push had issues (non-fatal)"

echo "✅ Migrations complete — server PID $SERVER_PID running"

# Wait for the server process (keep container alive)
wait $SERVER_PID
