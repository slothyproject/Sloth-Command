/**
 * Kubernetes API Routes
 * /api/kubernetes/*
 * K8s cluster management, deployments, and monitoring
 */

import { Router } from 'express';
import kubernetes from '../services/kubernetes';

const router = Router();

/**
 * GET /api/kubernetes/status
 * Get Kubernetes system status
 */
router.get('/status', async (req, res) => {
  try {
    const summary = await kubernetes.getK8sSummary();
    const clusters = await kubernetes.getClusters();
    
    res.json({
      success: true,
      data: {
        ...summary,
        clusters: clusters.map((c) => ({
          id: c.id,
          name: c.name,
          provider: c.provider,
          version: c.version,
          status: c.status,
          nodes: c.nodes.length,
          workloads: c.workloads.length,
          health: c.health.status,
        })),
      },
    });
  } catch (error) {
    console.error('K8s status error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * GET /api/kubernetes/clusters
 * Get all Kubernetes clusters
 */
router.get('/clusters', async (req, res) => {
  try {
    const clusters = await kubernetes.getClusters();
    
    res.json({
      success: true,
      data: clusters.map((c) => ({
        id: c.id,
        name: c.name,
        provider: c.provider,
        version: c.version,
        context: c.context,
        status: c.status,
        nodes: c.nodes.length,
        workloads: c.workloads.length,
        metrics: c.metrics,
        health: c.health,
        lastSyncAt: c.lastSyncAt,
      })),
    });
  } catch (error) {
    console.error('Get clusters error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get clusters',
    });
  }
});

/**
 * POST /api/kubernetes/clusters
 * Add a new Kubernetes cluster
 */
router.post('/clusters', async (req, res) => {
  try {
    const { name, provider, kubeconfig, context } = req.body;
    
    if (!name || !provider || !kubeconfig) {
      return res.status(400).json({
        success: false,
        error: 'name, provider, and kubeconfig are required',
      });
    }

    const cluster = await kubernetes.addCluster(name, provider, kubeconfig, context);
    
    res.json({
      success: true,
      data: {
        id: cluster.id,
        name: cluster.name,
        provider: cluster.provider,
        status: cluster.status,
        version: cluster.version,
      },
    });
  } catch (error) {
    console.error('Add cluster error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add cluster',
    });
  }
});

/**
 * GET /api/kubernetes/clusters/:id
 * Get cluster details
 */
router.get('/clusters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const cluster = await kubernetes.getCluster(id);
    
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found',
      });
    }
    
    res.json({
      success: true,
      data: cluster,
    });
  } catch (error) {
    console.error('Get cluster error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cluster',
    });
  }
});

/**
 * POST /api/kubernetes/clusters/:id/sync
 * Sync cluster data
 */
router.post('/clusters/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await kubernetes.syncCluster(id);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Sync cluster error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync cluster',
    });
  }
});

/**
 * GET /api/kubernetes/clusters/:id/nodes
 * Get cluster nodes
 */
router.get('/clusters/:id/nodes', async (req, res) => {
  try {
    const { id } = req.params;
    const cluster = await kubernetes.getCluster(id);
    
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found',
      });
    }
    
    res.json({
      success: true,
      data: cluster.nodes,
      count: cluster.nodes.length,
    });
  } catch (error) {
    console.error('Get nodes error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get nodes',
    });
  }
});

/**
 * GET /api/kubernetes/clusters/:id/workloads
 * Get cluster workloads
 */
router.get('/clusters/:id/workloads', async (req, res) => {
  try {
    const { id } = req.params;
    const cluster = await kubernetes.getCluster(id);
    
    if (!cluster) {
      return res.status(404).json({
        success: false,
        error: 'Cluster not found',
      });
    }
    
    res.json({
      success: true,
      data: cluster.workloads,
      count: cluster.workloads.length,
    });
  } catch (error) {
    console.error('Get workloads error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get workloads',
    });
  }
});

/**
 * GET /api/kubernetes/clusters/:id/metrics
 * Get cluster metrics
 */
router.get('/clusters/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const metrics = await kubernetes.getClusterMetrics(id);
    
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get metrics',
    });
  }
});

/**
 * POST /api/kubernetes/clusters/:id/deploy
 * Deploy a workload
 */
router.post('/clusters/:id/deploy', async (req, res) => {
  try {
    const { id } = req.params;
    const { manifest, namespace, wait } = req.body;
    
    if (!manifest) {
      return res.status(400).json({
        success: false,
        error: 'manifest is required',
      });
    }

    const result = await kubernetes.deployWorkload(id, manifest, { namespace, wait });
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Deploy error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deploy',
    });
  }
});

/**
 * POST /api/kubernetes/workloads/:workloadId/scale
 * Scale a workload
 */
router.post('/workloads/:workloadId/scale', async (req, res) => {
  try {
    const { workloadId } = req.params;
    const { replicas } = req.body;
    
    if (replicas === undefined) {
      return res.status(400).json({
        success: false,
        error: 'replicas is required',
      });
    }

    const success = await kubernetes.scaleWorkload(workloadId, parseInt(replicas));
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Workload not found',
      });
    }
    
    res.json({
      success: true,
      message: `Workload scaled to ${replicas} replicas`,
    });
  } catch (error) {
    console.error('Scale error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scale workload',
    });
  }
});

/**
 * DELETE /api/kubernetes/workloads/:workloadId
 * Delete a workload
 */
router.delete('/workloads/:workloadId', async (req, res) => {
  try {
    const { workloadId } = req.params;
    const success = await kubernetes.deleteWorkload(workloadId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Workload not found',
      });
    }
    
    res.json({
      success: true,
      message: 'Workload deleted',
    });
  } catch (error) {
    console.error('Delete workload error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete workload',
    });
  }
});

/**
 * GET /api/kubernetes/workloads/:workloadId/logs
 * Get workload logs
 */
router.get('/workloads/:workloadId/logs', async (req, res) => {
  try {
    const { workloadId } = req.params;
    const { lines = '100' } = req.query;
    
    const logs = await kubernetes.getWorkloadLogs(workloadId, { lines: parseInt(lines as string) });
    
    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs',
    });
  }
});

/**
 * GET /api/kubernetes/clusters/:id/helm
 * Get Helm releases
 */
router.get('/clusters/:id/helm', async (req, res) => {
  try {
    const { id } = req.params;
    const releases = await kubernetes.getHelmReleases(id);
    
    res.json({
      success: true,
      data: releases,
      count: releases.length,
    });
  } catch (error) {
    console.error('Get Helm releases error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Helm releases',
    });
  }
});

/**
 * POST /api/kubernetes/clusters/:id/helm/install
 * Install Helm chart
 */
router.post('/clusters/:id/helm/install', async (req, res) => {
  try {
    const { id } = req.params;
    const { chart, releaseName, namespace, version, values } = req.body;
    
    if (!chart || !releaseName) {
      return res.status(400).json({
        success: false,
        error: 'chart and releaseName are required',
      });
    }

    const release = await kubernetes.installHelmChart(id, chart, releaseName, {
      namespace,
      version,
      values,
    });
    
    res.json({
      success: true,
      data: release,
    });
  } catch (error) {
    console.error('Install Helm chart error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to install Helm chart',
    });
  }
});

export default router;
