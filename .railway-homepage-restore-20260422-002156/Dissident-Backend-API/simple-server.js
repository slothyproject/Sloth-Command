// Simple Express server for testing - minimal dependencies
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting simple server...');

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Health check - always works
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API is working!',
    env: {
      hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
      hasJwtSecret: !!process.env.JWT_SECRET
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Simple API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
