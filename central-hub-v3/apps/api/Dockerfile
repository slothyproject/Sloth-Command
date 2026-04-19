FROM node:20-slim

# Cache-buster: v1.4 - Enhanced database diagnostics and connection retry
LABEL version="1.4"

# Set Prisma binary target for Debian environment
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

# Install OpenSSL for Prisma compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and migrations
COPY src/prisma ./src/prisma
COPY prisma/migrations ./prisma/migrations

# Verify files are in place
RUN ls -la src/prisma/ && ls -la prisma/migrations/

# Generate Prisma client
RUN npx prisma generate --schema=src/prisma/schema.prisma

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server (database initialization happens in application code)
CMD ["node", "dist/index.js"]
