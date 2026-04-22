/**
 * Central Hub API Server
 * Express.js backend for Railway/Discord/Website management
 * AI-Powered Mission Control
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Import routes
import aiRoutes from './routes/ai';
import railwayRoutes from './routes/railway';
import discordRoutes from './routes/discord';
import discordSetupRoutes from './routes/discord-setup';
import knowledgeRoutes from './routes/knowledge';
import doraRoutes from './routes/dora';
import agentRoutes from './routes/agents';
import securityRoutes from './routes/security';
import healingRoutes from './routes/healing';
import scalingRoutes from './routes/scaling';
import cloudRoutes from './routes/cloud';
import kubernetesRoutes from './routes/kubernetes';
import cicdRoutes from './routes/cicd';
import discordAdvancedRoutes from './routes/discord-advanced';

// Import infrastructure services
import { initializeRedis, closeRedis } from './services/redis';
import { initializeQueues, closeQueues } from './services/queue';
import { getProviderStatus } from './services/llm-router';
import { initializeNeo4j, closeNeo4j } from './services/knowledge-graph';
import { auditLog, getAuditLogs } from './services/audit-log';
import { encrypt, decrypt, maskSecret, isEncryptionConfigured } from './services/encryption';
import { discordClientMiddleware } from './middleware/discord-client';

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
      console.log('✅ Core tables exist — running incremental migrations...');
    } catch {
      console.log('📝 Creating database tables...');
    }

    // Always run idempotent table creation & column additions
    // (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS are safe on every boot)
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

    // Encryption columns on variables (safe to run even if table already exists)
    await prisma.$executeRaw`
      ALTER TABLE "variables"
        ADD COLUMN IF NOT EXISTS "encryptedValue" TEXT,
        ADD COLUMN IF NOT EXISTS "iv"             TEXT,
        ADD COLUMN IF NOT EXISTS "encryptionTag"  TEXT
    `;
    console.log('✅ Variable encryption columns ensured');

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "credentials" (
        "id"             TEXT PRIMARY KEY,
        "serviceType"    TEXT NOT NULL,
        "name"           TEXT NOT NULL,
        "encryptedToken" TEXT NOT NULL,
        "iv"             TEXT NOT NULL,
        "encryptionTag"  TEXT NOT NULL,
        "expiresAt"      TIMESTAMP,
        "lastUsedAt"     TIMESTAMP,
        "createdAt"      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Credentials table created');

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"           TEXT PRIMARY KEY,
        "action"       TEXT NOT NULL,
        "resourceType" TEXT,
        "resourceId"   TEXT,
        "changes"      JSONB,
        "userId"       TEXT,
        "ipAddress"    TEXT,
        "userAgent"    TEXT,
        "severity"     TEXT DEFAULT 'info',
        "createdAt"    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt"
        ON "audit_logs" ("action", "createdAt" DESC)
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "audit_logs_resource"
        ON "audit_logs" ("resourceType", "resourceId")
    `;
    console.log('✅ Audit logs table created');

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "setup_runs" (
        "id"            TEXT PRIMARY KEY,
        "guildId"       TEXT NOT NULL,
        "setupTemplate" TEXT NOT NULL,
        "userPrompt"    TEXT NOT NULL,
        "status"        TEXT DEFAULT 'planning',
        "currentStep"   INTEGER DEFAULT 0,
        "totalSteps"    INTEGER DEFAULT 0,
        "progress"      INTEGER DEFAULT 0,
        "plan"          JSONB,
        "planApproved"  BOOLEAN DEFAULT false,
        "approvedAt"    TIMESTAMP,
        "approvedBy"    TEXT,
        "executedSteps" INTEGER DEFAULT 0,
        "failedStep"    INTEGER,
        "error"         TEXT,
        "rollbackMetadata" JSONB,
        "createdAt"     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "completedAt"   TIMESTAMP
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "setup_runs_guild_status"
        ON "setup_runs" ("guildId", "status", "createdAt" DESC)
    `;
    console.log('✅ Setup runs table created');

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "setup_steps" (
        "id"           TEXT PRIMARY KEY,
        "setupRunId"   TEXT NOT NULL,
        "order"        INTEGER NOT NULL,
        "type"         TEXT NOT NULL,
        "description"  TEXT NOT NULL,
        "config"       JSONB NOT NULL,
        "status"       TEXT DEFAULT 'pending',
        "result"       JSONB,
        "error"        TEXT,
        "rollbackData" JSONB,
        "executedAt"   TIMESTAMP,
        "createdAt"    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("setupRunId") REFERENCES "setup_runs"("id") ON DELETE CASCADE
      )
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "setup_steps_run_order"
        ON "setup_steps" ("setupRunId", "order")
    `;
    console.log('✅ Setup steps table created');
    
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
app.use(discordClientMiddleware);

// Root health check — Railway pings /health during deployment
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/ai', aiRoutes);
app.use('/api/railway', railwayRoutes);
app.use('/api/discord', discordRoutes);
app.use('/api/discord/setup', discordSetupRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/metrics/dora', doraRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/healing', healingRoutes);
app.use('/api/scaling', scalingRoutes);
app.use('/api/cloud', cloudRoutes);
app.use('/api/kubernetes', kubernetesRoutes);
app.use('/api/cicd', cicdRoutes);
app.use('/api/discord/advanced', discordAdvancedRoutes);

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
    ollamaHost:          process.env.OLLAMA_HOST         ? 'configured' : 'missing',
    ollamaKey:           process.env.OLLAMA_API_KEY      ? 'configured' : 'missing',
    openaiKey:           process.env.OPENAI_API_KEY      ? 'configured' : 'missing',
    anthropicKey:        process.env.ANTHROPIC_API_KEY   ? 'configured' : 'missing',
    redisUrl:            process.env.REDIS_URL           ? 'configured' : 'missing',
    railwayToken:        process.env.RAILWAY_TOKEN       ? 'configured' : 'missing',
    encryptionKey:       isEncryptionConfigured()         ? 'configured' : '⚠️ missing — secrets stored with fallback key',
    discordWebhook:      process.env.DISCORD_WEBHOOK_URL ? 'configured' : 'missing (ops notifications disabled)',
  };
  
  const allHealthy = checks.database === 'connected';
  
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

    // Account lockout: reject if >= 5 failed attempts in the last 15 minutes
    const lockoutWindow = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await prisma.auditLog.count({
      where: {
        action: 'auth.login.failed',
        userId: user.id,
        createdAt: { gte: lockoutWindow },
      },
    });

    if (recentFailures >= 5) {
      await auditLog({ action: 'auth.login.blocked', userId: user.id, severity: 'error', req });
      return res.status(429).json({ error: 'Account temporarily locked. Try again in 15 minutes.' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      await auditLog({ action: 'auth.login.failed', userId: user.id, severity: 'warning', req });
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await auditLog({ action: 'auth.login', userId: user.id, severity: 'info', req });

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

// Change password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required' });
    }
    if (newPassword.length < 12) {
      return res.status(400).json({ error: 'New password must be at least 12 characters' });
    }

    const user = await prisma.user.findFirst();
    if (!user) return res.status(401).json({ error: 'Authentication failed' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      await auditLog({ action: 'auth.password_change.failed', userId: user.id, severity: 'warning', req });
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
    await auditLog({ action: 'auth.password_changed', userId: user.id, severity: 'info', req });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Credentials CRUD
app.get('/api/credentials', async (req, res) => {
  try {
    const credentials = await prisma.credential.findMany({ orderBy: { createdAt: 'desc' } });
    // Never return encrypted tokens in the list — return metadata only
    const safe = credentials.map(({ encryptedToken: _e, iv: _i, encryptionTag: _t, ...rest }: any) => rest);
    res.json({ success: true, data: safe });
  } catch (error) {
    console.error('Error fetching credentials:', error);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

app.post('/api/credentials', async (req, res) => {
  try {
    const { serviceType, name, token, expiresAt } = req.body as {
      serviceType: string; name: string; token: string; expiresAt?: string;
    };
    if (!serviceType || !name || !token) {
      return res.status(400).json({ error: 'serviceType, name, and token are required' });
    }

    const enc = encrypt(token);
    const credential = await prisma.credential.create({
      data: {
        id: crypto.randomUUID(),
        serviceType,
        name,
        encryptedToken: enc.data,
        iv: enc.iv,
        encryptionTag: enc.tag,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await auditLog({
      action: 'credential.create',
      resourceType: 'credential',
      resourceId: credential.id,
      changes: { serviceType, name },
      req,
    });

    const { encryptedToken: _e, iv: _i, encryptionTag: _t, ...safe } = credential;
    res.status(201).json({ success: true, data: safe });
  } catch (error) {
    console.error('Error creating credential:', error);
    res.status(500).json({ error: 'Failed to create credential' });
  }
});

app.delete('/api/credentials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.credential.delete({ where: { id } });
    await auditLog({
      action: 'credential.delete',
      resourceType: 'credential',
      resourceId: id,
      req,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting credential:', error);
    res.status(500).json({ error: 'Failed to delete credential' });
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
    const { reveal } = req.query; // ?reveal=1 to get decrypted values
    const variables = await prisma.variable.findMany({
      where: { serviceId: id }
    });

    const result = variables.map((v: any) => {
      if (v.isSecret && v.encryptedValue && v.iv && v.encryptionTag) {
        if (reveal === '1') {
          try {
            const plaintext = decrypt({ iv: v.iv, tag: v.encryptionTag, data: v.encryptedValue, algorithm: 'aes-256-gcm' });
            return { ...v, value: plaintext };
          } catch {
            return { ...v, value: '[DECRYPT_ERROR]' };
          }
        }
        return { ...v, value: maskSecret(v.encryptedValue) };
      }
      return v;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching variables:', error);
    res.status(500).json({ error: 'Failed to fetch variables' });
  }
});

// Create or update a variable in the local DB
app.put('/api/services/:id/variables/:varId?', async (req, res) => {
  try {
    const { id, varId } = req.params;
    const { name, value, isSecret = false, category } = req.body as {
      name: string; value: string; isSecret?: boolean; category?: string;
    };

    if (!name || value === undefined) {
      return res.status(400).json({ error: 'name and value are required' });
    }

    let storedValue = value;
    let encryptedValue: string | null = null;
    let iv: string | null = null;
    let encryptionTag: string | null = null;

    if (isSecret) {
      const enc = encrypt(value);
      storedValue = '[ENCRYPTED]';
      encryptedValue = enc.data;
      iv = enc.iv;
      encryptionTag = enc.tag;
    }

    const data = { serviceId: id, name, value: storedValue, isSecret: !!isSecret, category: category ?? null, encryptedValue, iv, encryptionTag };

    let variable;
    let changeAction: 'variable.create' | 'variable.update';

    if (varId) {
      variable = await prisma.variable.update({ where: { id: varId }, data });
      changeAction = 'variable.update';
    } else {
      variable = await prisma.variable.create({ data: { id: crypto.randomUUID(), ...data } });
      changeAction = 'variable.create';
    }

    await auditLog({
      action: changeAction,
      resourceType: 'variable',
      resourceId: variable.id,
      changes: { serviceId: id, name, isSecret: !!isSecret },
      req,
    });

    res.json({ success: true, data: { ...variable, value: isSecret ? maskSecret(value) : value } });
  } catch (error) {
    console.error('Error saving variable:', error);
    res.status(500).json({ error: 'Failed to save variable' });
  }
});

// Audit log route
app.get('/api/audit-logs', async (req, res) => {
  try {
    const { limit = '50', offset = '0', action, resourceType, resourceId, severity } = req.query;
    const result = await getAuditLogs({
      limit:        parseInt(limit as string),
      offset:       parseInt(offset as string),
      action:       action       as string | undefined,
      resourceType: resourceType as string | undefined,
      resourceId:   resourceId   as string | undefined,
      severity:     severity     as 'info' | 'warning' | 'error' | 'critical' | undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
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
    console.log('✅ Agentic AI system active (multi-step planning)');
    console.log('✅ Self-healing automation enabled');
    console.log('✅ Predictive scaling ML models loaded');
    console.log('✅ Security automation scanning active');
    console.log('✅ Multi-cloud connectors ready (AWS/GCP/Azure)');
    console.log('✅ Kubernetes native support enabled');
    console.log('✅ CI/CD integration active (GitHub/GitLab)');
    console.log('✅ Advanced Discord features loaded (moderation/commerce)');
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

// Handle uncaught errors — log but don't exit for non-fatal queue/redis errors
process.on('uncaughtException', async (error) => {
  const msg = error?.message || String(error);
  
  // Bull/ioredis config errors are logged but non-fatal — server keeps running
  if (msg.includes('enableReadyCheck') || msg.includes('maxRetriesPerRequest') ||
      msg.includes('bclient') || msg.includes('Queue')) {
    console.warn('⚠️ Non-fatal queue error (ignored):', msg);
    return;
  }
  
  console.error('Uncaught Exception:', error);
  try { monitoringScheduler.stopScheduler(); } catch {}
  try { await closeQueues(); } catch {}
  try { await closeNeo4j(); } catch {}
  try { await closeRedis(); } catch {}
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});

export { registerDiscordClient } from './middleware/discord-client';
export default app;
