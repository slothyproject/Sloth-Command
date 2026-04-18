FROM node:20-slim

# Cache-buster: v1.1 - Force rebuild with new start.sh
LABEL version="1.1"

# Install OpenSSL for Prisma compatibility
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema
COPY src/prisma ./prisma

# Verify schema is in place
RUN ls -la prisma/ && cat prisma/schema.prisma | head -10

# Generate Prisma client
RUN npx prisma generate

# Copy source code and startup script
COPY . .

# Make startup script executable
RUN chmod +x start.sh

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server using startup script (handles database setup)
CMD ["./start.sh"]
