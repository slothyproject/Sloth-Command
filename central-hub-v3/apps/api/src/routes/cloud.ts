/**
 * Multi-Cloud API Routes
 * /api/cloud/*
 * AWS, GCP, Azure cloud provider management
 */

import { Router } from 'express';
import multiCloud, { CloudProvider, ResourceType } from '../services/multi-cloud';

const router = Router();

/**
 * GET /api/cloud/status
 * Get multi-cloud system status
 */
router.get('/status', async (req, res) => {
  try {
    const connections = await multiCloud.getConnections();
    const resources = await multiCloud.getAllResources();
    const health = await multiCloud.getProviderHealth();
    const analytics = await multiCloud.getCrossCloudAnalytics();
    
    res.json({
      success: true,
      data: {
        connections: connections.map((c) => ({
          id: c.id,
          provider: c.provider,
          name: c.name,
          status: c.status,
          regions: c.metadata.regions.length,
        })),
        totalResources: resources.length,
        providerHealth: health,
        costSummary: {
          monthly: analytics.totalMonthlyCost,
          byProvider: analytics.byProvider,
        },
      },
    });
  } catch (error) {
    console.error('Cloud status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cloud status',
    });
  }
});

/**
 * GET /api/cloud/providers
 * Get available cloud providers
 */
router.get('/providers', (req, res) => {
  res.json({
    success: true,
    data: Object.values(CloudProvider).map((provider) => ({
      id: provider,
      name: provider.toUpperCase(),
      regions: getRegionsForProvider(provider),
      services: getServicesForProvider(provider),
    })),
  });
});

function getRegionsForProvider(provider: CloudProvider): string[] {
  const regions: Record<CloudProvider, string[]> = {
    [CloudProvider.AWS]: [
      'us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1',
      'ap-southeast-1', 'ap-northeast-1',
    ],
    [CloudProvider.GCP]: [
      'us-central1', 'us-west1', 'europe-west1', 'europe-west4',
      'asia-east1', 'asia-northeast1',
    ],
    [CloudProvider.AZURE]: [
      'East US', 'West US 2', 'West Europe', 'North Europe',
      'Southeast Asia', 'Japan East',
    ],
  };
  return regions[provider];
}

function getServicesForProvider(provider: CloudProvider): string[] {
  const services: Record<CloudProvider, string[]> = {
    [CloudProvider.AWS]: [
      'EC2', 'S3', 'RDS', 'Lambda', 'ECS', 'EKS', 'CloudFront', 'Route53', 'VPC',
    ],
    [CloudProvider.GCP]: [
      'Compute Engine', 'Cloud Storage', 'Cloud SQL', 'Cloud Functions', 'GKE',
    ],
    [CloudProvider.AZURE]: [
      'Virtual Machines', 'Blob Storage', 'Azure SQL', 'Functions', 'AKS',
    ],
  };
  return services[provider];
}

/**
 * GET /api/cloud/connections
 * Get all cloud connections
 */
router.get('/connections', async (req, res) => {
  try {
    const connections = await multiCloud.getConnections();
    
    res.json({
      success: true,
      data: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
        name: c.name,
        status: c.status,
        region: c.credentials.region,
        accountId: c.metadata.accountId,
        regions: c.metadata.regions,
        services: c.metadata.services,
        lastSyncAt: c.lastSyncAt,
        health: c.healthCheck,
      })),
    });
  } catch (error) {
    console.error('Get connections error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connections',
    });
  }
});

/**
 * POST /api/cloud/connections
 * Add a new cloud connection
 */
router.post('/connections', async (req, res) => {
  try {
    const { provider, name, credentials } = req.body;
    
    if (!provider || !name || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'provider, name, and credentials are required',
      });
    }

    if (!Object.values(CloudProvider).includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider',
      });
    }

    const connection = await multiCloud.addConnection(provider, name, credentials);
    
    res.json({
      success: true,
      data: {
        id: connection.id,
        provider: connection.provider,
        name: connection.name,
        status: connection.status,
      },
    });
  } catch (error) {
    console.error('Add connection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add connection',
    });
  }
});

/**
 * GET /api/cloud/connections/:id
 * Get connection details
 */
router.get('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await multiCloud.getConnection(id);
    
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }
    
    res.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    console.error('Get connection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connection',
    });
  }
});

/**
 * DELETE /api/cloud/connections/:id
 * Remove a cloud connection
 */
router.delete('/connections/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await multiCloud.removeConnection(id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Connection removed',
    });
  } catch (error) {
    console.error('Remove connection error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove connection',
    });
  }
});

/**
 * POST /api/cloud/connections/:id/sync
 * Sync resources from connection
 */
router.post('/connections/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await multiCloud.syncResources(id);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Sync resources error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync resources',
    });
  }
});

/**
 * GET /api/cloud/resources
 * Get all cloud resources
 */
router.get('/resources', async (req, res) => {
  try {
    const { provider, type, region, status } = req.query;
    
    const resources = await multiCloud.getAllResources({
      provider: provider as CloudProvider,
      type: type as ResourceType,
      region: region as string,
      status: status as string,
    });
    
    res.json({
      success: true,
      data: resources,
      count: resources.length,
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get resources',
    });
  }
});

/**
 * GET /api/cloud/resources/:id
 * Get resource details
 */
router.get('/resources/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const resource = await multiCloud.getResource(id);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        error: 'Resource not found',
      });
    }
    
    res.json({
      success: true,
      data: resource,
    });
  } catch (error) {
    console.error('Get resource error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get resource',
    });
  }
});

/**
 * GET /api/cloud/connections/:id/costs
 * Get cost data for connection
 */
router.get('/connections/:id/costs', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = '30' } = req.query;
    
    const costData = await multiCloud.getCostData(id, parseInt(days as string));
    
    res.json({
      success: true,
      data: costData,
    });
  } catch (error) {
    console.error('Get costs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get costs',
    });
  }
});

/**
 * GET /api/cloud/analytics
 * Get cross-cloud analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await multiCloud.getCrossCloudAnalytics();
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analytics',
    });
  }
});

/**
 * GET /api/cloud/deployments
 * Get multi-cloud deployments
 */
router.get('/deployments', async (req, res) => {
  try {
    const deployments = await multiCloud.getMultiCloudDeployments();
    
    res.json({
      success: true,
      data: deployments,
    });
  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get deployments',
    });
  }
});

/**
 * POST /api/cloud/deployments
 * Create multi-cloud deployment
 */
router.post('/deployments', async (req, res) => {
  try {
    const { name, strategy, services, autoFailover } = req.body;
    
    if (!name || !strategy || !services) {
      return res.status(400).json({
        success: false,
        error: 'name, strategy, and services are required',
      });
    }

    const deployment = await multiCloud.createMultiCloudDeployment(
      name,
      strategy,
      services,
      { autoFailover }
    );
    
    res.json({
      success: true,
      data: deployment,
    });
  } catch (error) {
    console.error('Create deployment error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create deployment',
    });
  }
});

export default router;
