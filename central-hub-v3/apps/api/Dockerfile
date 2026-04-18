FROM node:20-alpine

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema
COPY src/prisma ./prisma

# Generate Prisma client
RUN npx prisma generate

# Create database tables (using db push for initial setup)
RUN npx prisma db push --accept-data-loss

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "dist/index.js"]
