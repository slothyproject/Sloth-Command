/**
 * Central Hub API Server
 * Express.js backend for Railway/Discord/Website management
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Get the user (there's only one)
    const user = await prisma.user.findFirst();
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Services routes
app.get('/api/services', async (req, res) => {
  try {
    const services = await prisma.service.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Failed to fetch services' });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const service = await prisma.service.findUnique({
      where: { id }
    });
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    
    res.json({ success: true, data: service });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ error: 'Failed to fetch service' });
  }
});

// Variables routes
app.get('/api/services/:id/variables', async (req, res) => {
  try {
    const { id } = req.params;
    const variables = await prisma.variable.findMany({
      where: { serviceId: id }
    });
    res.json({ success: true, data: variables });
  } catch (error) {
    console.error('Error fetching variables:', error);
    res.status(500).json({ error: 'Failed to fetch variables' });
  }
});

// Deployments routes
app.get('/api/services/:id/deployments', async (req, res) => {
  try {
    const { id } = req.params;
    const deployments = await prisma.deployment.findMany({
      where: { serviceId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: deployments });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Initialize default user on startup
async function initializeDefaultUser() {
  try {
    const userCount = await prisma.user.count();
    
    if (userCount === 0) {
      // Create default user with password
      const defaultPassword = process.env.DEFAULT_PASSWORD || 'central-hub-2025';
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);
      
      await prisma.user.create({
        data: {
          password: hashedPassword
        }
      });
      
      console.log('✅ Default user created with password:', defaultPassword);
    } else {
      console.log('✅ User already exists');
    }
  } catch (error) {
    console.error('Error initializing default user:', error);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Central Hub API running on port ${PORT}`);
  await initializeDefaultUser();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
