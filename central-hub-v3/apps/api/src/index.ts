/**
 * Central Hub API Server
 * Express.js backend for Railway/Discord/Website management
 * AI-Powered Mission Control
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Import routes
import aiRoutes from './routes/ai';
import railwayRoutes from './routes/railway';
import discordRoutes from './routes/discord';
import knowledgeRoutes from './routes/knowledge';
import doraRoutes from './routes/dora';

// Import infrastructure services
import { initializeRedis, closeRedis } from './services/redis';
import { initializeQueues, closeQueues } from './services/queue';
import { getProviderStatus } from './services/llm-router';
import { initializeNeo4j, closeNeo4j } from './services/knowledge-graph';

// Import scheduler
import monitoringScheduler from './scheduler/monitoring';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database initialization with direct SQL
async function initializeDatabase(): Promise<boolean> {
  try {
    console.log('📦 Initializing database...');
    console.log(`🔍 Environment check - DATABASE_URL exists: ${!!process.env.DATABASE_URL}`);
    console.log(`🔍 Environment check - PORT: ${process.env.PORT || '3001 (default)'}`);
    
    // Wait for database to be ready
    console.log('⏳ Waiting 3 seconds for database to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test connection with retry
    let connected = false;
    let connectionAttempts = 0;
    const maxConnectionAttempts = 10;
    
    while (!connected && connectionAttempts < maxConnectionAttempts) {
      connectionAttempts++;
      try {
        await prisma.$connect();
        connected = true;
        console.log(`✅ Database connection established (attempt ${connectionAttempts})`);
      } catch (connError) {
        console.log(`❌ Connection attempt ${connectionAttempts} failed:`, connError instanceof Error ? connError.message : 'Unknown error');
        if (connectionAttempts < maxConnectionAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    if (!connected) {
      console.error('❌ Could not establish database connection after', maxConnectionAttempts, 'attempts');
      return false;
    }
    
    // Check if tables exist by trying to query
    try {
      await prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
      console.log('✅ Tables already exist');
      return true;
    } catch {
      console.log('📝 Creating database tables...');
    }
    
    // Create tables using raw SQL
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "password" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Users table created');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "services" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "platform" TEXT NOT NULL,
        "externalId" TEXT,
        "status" TEXT DEFAULT 'unknown',
        "config" JSONB,
        "url" TEXT,
        "repositoryUrl" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Services table created');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "variables" (
        "id" TEXT PRIMARY KEY,
        "serviceId" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "isSecret" BOOLEAN DEFAULT false,
        "category" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Variables table created');
    
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "deployments" (
        "id" TEXT PRIMARY KEY,
        "serviceId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "url" TEXT,
        "logs" TEXT,
        "error" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Deployments table created');
    
    console.log('✅ All tables created successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Database initialization failed with error:', error);
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    return false;
  }
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// API Routes
app.use('/api/ai', aiRoutes);
app.use('/api/railway', railwayRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/metrics/dora', doraRoutes);

// Health check endpoint - comprehensive status
app.get('/api/health', async (req, res) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
  
  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch (error) {
    checks.database = 'disconnected';
    checks.databaseError = error instanceof Error ? error.message : 'Unknown';
  }
  
  // LLM providers check
  checks.llmProviders = getProviderStatus();
  
  // Environment variables check
  checks.config = {
    ollamaHost: process.env.OLLAMA_HOST ? 'configured' : 'missing',
    ollamaKey: process.env.OLLAMA_API_KEY ? 'configured' : 'missing',
    openaiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
    anthropicKey: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing',
    redisUrl: process.env.REDIS_URL ? 'configured' : 'missing',
    railwayToken: process.env.RAILWAY_TOKEN ? 'configured' : 'missing',
  };
  
  const allHealthy = checks.database === 'connected' && 
    checks.llmProviders.some((p: any) => p.healthy);
  
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    ...checks,
  });
});

// Debug endpoint to check database status
app.get('/api/debug', async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ 
      status: 'ok', 
      database: 'connected',
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
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
  console.log(`🤖 AI Service: ${process.env.OLLAMA_HOST || 'http://localhost:11434'}`);
  console.log(`🛤️  Railway Integration: ${process.env.RAILWAY_TOKEN ? '✅ Configured' : '❌ Missing RAILWAY_TOKEN'}`);
  
  // Initialize database first
  const dbInitialized = await initializeDatabase();
  
  if (dbInitialized) {
    // Then initialize default user
    await initializeDefaultUser();
    
    // Initialize Redis for caching and sessions
    try {
      initializeRedis();
      console.log('✅ Redis initialized for caching and sessions');
    } catch (error) {
      console.error('⚠️  Redis initialization failed (non-critical):', error);
    }
    
    // Initialize job queues for async processing
    try {
      initializeQueues();
      console.log('✅ Job queues initialized for async processing');
    } catch (error) {
      console.error('⚠️  Queue initialization failed (non-critical):', error);
    }
    
    // Initialize Neo4j knowledge graph
    try {
      initializeNeo4j();
      console.log('✅ Neo4j knowledge graph connected');
    } catch (error) {
      console.error('⚠️  Neo4j initialization failed (non-critical):', error);
    }
    
    // Start monitoring scheduler
    monitoringScheduler.startScheduler();
    
    console.log('✅ Server fully initialized and ready');
    console.log('✅ AI-powered monitoring active');
    console.log('✅ Multi-LLM router ready (Ollama → OpenAI → Claude)');
    console.log('✅ Knowledge graph connected (Neo4j)');
    console.log('✅ DORA metrics tracking enabled');
    console.log('✅ Auto-fix agent running (async queue)');
  } else {
    console.error('⚠️  Server running but database initialization failed');
    console.error('⚠️  Login will not work until database is properly set up');
    console.error('⚠️  Check DATABASE_URL and ensure PostgreSQL is accessible');
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  monitoringScheduler.stopScheduler();
  await closeQueues();
  await closeNeo4j();
  await closeRedis();
  await prisma.$disconnect();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', async (error) => {
  console.error('Uncaught Exception:', error);
  monitoringScheduler.stopScheduler();
  await closeQueues();
  await closeNeo4j();
  await closeRedis();
  await prisma.$disconnect();
  process.exit(1);
});

export default app;
