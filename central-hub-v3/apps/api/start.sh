#!/bin/sh
set -e

echo "🚀 Central Hub API v1.1 - Starting up..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL is not set!"
    echo "Please configure DATABASE_URL in Railway dashboard."
    exit 1
fi

echo "✅ DATABASE_URL is configured"
echo "📝 Database URL pattern: ${DATABASE_URL%%@*}@***"

# Wait for database to be ready with retry logic
echo "⏳ Waiting for database connection..."
retry_count=0
max_retries=30

while [ $retry_count -lt $max_retries ]; do
    if node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => {
  console.log('connected');
  process.exit(0);
}).catch(() => {
  console.log('not ready');
  process.exit(1);
});
" 2>/dev/null | grep -q "connected"; then
        echo "✅ Database is ready!"
        break
    fi
    
    retry_count=$((retry_count + 1))
    echo "   Attempt $retry_count/$max_retries - waiting..."
    sleep 2
done

if [ $retry_count -eq $max_retries ]; then
    echo "⚠️  Could not confirm database connection, but continuing..."
fi

# Create database tables if they don't exist
echo "📦 Setting up database tables..."
if npx prisma db push --accept-data-loss; then
    echo "✅ Database tables created/updated"
else
    echo "⚠️  Database setup warning - tables may already exist"
fi

# Verify tables exist
echo "🔍 Verifying database setup..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  try {
    const count = await prisma.user.count();
    console.log('✅ Database verified! Users in database:', count);
    if (count === 0) {
      console.log('📝 No users found - default user will be created on first login attempt');
    }
  } catch (err) {
    console.log('❌ Database check failed:', err.message);
  }
}
check().finally(() => prisma.\$disconnect());
"

# Start the server
echo "🔥 Starting server on port ${PORT:-3001}..."
echo "🌐 API will be available at http://localhost:${PORT:-3001}"
exec node dist/index.js
