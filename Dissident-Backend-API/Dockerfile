# Backend API Dockerfile
# CACHE BUST: 2026-04-17-04 - Force complete rebuild
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Verify server.js was copied and show first 30 lines
RUN echo "=== SERVER.JS FIRST 30 LINES ===" && head -30 server.js && echo "=== END OF PREVIEW ==="

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "server.js"]
