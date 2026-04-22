/**
 * Security Automation API Routes
 * /api/security/*
 * Vulnerability management, compliance, and security operations
 */

import { Router } from 'express';
import securityAutomation, { VulnSeverity, VulnStatus } from '../services/security-automation';

const router = Router();

/**
 * GET /api/security/dashboard
 * Get security dashboard overview
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = await securityAutomation.getSecurityDashboard();
    
    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security dashboard',
    });
  }
});

/**
 * GET /api/security/vulnerabilities
 * Get all vulnerabilities with optional filters
 */
router.get('/vulnerabilities', async (req, res) => {
  try {
    const { serviceId, status, severity } = req.query;
    
    const filters: Parameters<typeof securityAutomation.getAllVulnerabilities>[0] = {};
    if (serviceId) filters.serviceId = serviceId as string;
    if (status && Object.values(VulnStatus).includes(status as VulnStatus)) {
      filters.status = status as VulnStatus;
    }
    if (severity && Object.values(VulnSeverity).includes(severity as VulnSeverity)) {
      filters.severity = severity as VulnSeverity;
    }

    const vulnerabilities = await securityAutomation.getAllVulnerabilities(filters);
    
    res.json({
      success: true,
      data: vulnerabilities,
      count: vulnerabilities.length,
    });
  } catch (error) {
    console.error('Get vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vulnerabilities',
    });
  }
});

/**
 * GET /api/security/vulnerabilities/:id
 * Get vulnerability details
 */
router.get('/vulnerabilities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vulnerability = await securityAutomation.getVulnerability(id);
    
    if (!vulnerability) {
      return res.status(404).json({
        success: false,
        error: 'Vulnerability not found',
      });
    }
    
    res.json({
      success: true,
      data: vulnerability,
    });
  } catch (error) {
    console.error('Get vulnerability error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vulnerability',
    });
  }
});

/**
 * POST /api/security/vulnerabilities/:id/patch
 * Apply patch for a vulnerability
 */
router.post('/vulnerabilities/:id/patch', async (req, res) => {
  try {
    const { id } = req.params;
    const { backup = true, testInStaging = true } = req.body;
    
    const result = await securityAutomation.applyPatch(id, {
      backup,
      testInStaging,
    });
    
    res.json({
      success: result.success,
      data: result,
    });
  } catch (error) {
    console.error('Apply patch error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to apply patch',
    });
  }
});

/**
 * GET /api/security/scans
 * Get recent security scans
 */
router.get('/scans', async (req, res) => {
  try {
    const { serviceId, limit = '10' } = req.query;
    
    const scans = await securityAutomation.getRecentScans(
      serviceId as string | undefined,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      data: scans,
    });
  } catch (error) {
    console.error('Get scans error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scans',
    });
  }
});

/**
 * POST /api/security/scans
 * Run a new security scan
 */
router.post('/scans', async (req, res) => {
  try {
    const { serviceId, scanType = 'full' } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: 'serviceId is required',
      });
    }

    const scan = await securityAutomation.runSecurityScan(serviceId, scanType);
    
    res.json({
      success: true,
      data: {
        scanId: scan.id,
        status: scan.status,
        summary: scan.summary,
        startedAt: scan.startedAt,
      },
    });
  } catch (error) {
    console.error('Run scan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run scan',
    });
  }
});

/**
 * GET /api/security/scans/:id
 * Get scan details
 */
router.get('/scans/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scan = await securityAutomation.getSecurityScan(id);
    
    if (!scan) {
      return res.status(404).json({
        success: false,
        error: 'Scan not found',
      });
    }
    
    res.json({
      success: true,
      data: scan,
    });
  } catch (error) {
    console.error('Get scan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get scan',
    });
  }
});

/**
 * POST /api/security/compliance/check
 * Run compliance check
 */
router.post('/compliance/check', async (req, res) => {
  try {
    const { serviceId, framework = 'SOC2' } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: 'serviceId is required',
      });
    }

    const checks = await securityAutomation.runComplianceCheck(serviceId, framework);
    
    const passed = checks.filter((c) => c.status === 'compliant').length;
    const failed = checks.filter((c) => c.status === 'non_compliant').length;
    
    res.json({
      success: true,
      data: {
        serviceId,
        framework,
        total: checks.length,
        passed,
        failed,
        complianceRate: checks.length > 0 ? (passed / checks.length) * 100 : 0,
        checks,
      },
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run compliance check',
    });
  }
});

/**
 * GET /api/security/events
 * Get security events
 */
router.get('/events', async (req, res) => {
  try {
    const { serviceId, type, acknowledged, limit = '50' } = req.query;
    
    const filters: Parameters<typeof securityAutomation.getSecurityEvents>[0] = {};
    if (serviceId) filters.serviceId = serviceId as string;
    if (type) filters.type = type as any;
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';

    const events = await securityAutomation.getSecurityEvents(filters, parseInt(limit as string));
    
    res.json({
      success: true,
      data: events,
      count: events.length,
    });
  } catch (error) {
    console.error('Get security events error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security events',
    });
  }
});

/**
 * POST /api/security/events/:id/acknowledge
 * Acknowledge a security event
 */
router.post('/events/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { acknowledgedBy } = req.body;
    
    if (!acknowledgedBy) {
      return res.status(400).json({
        success: false,
        error: 'acknowledgedBy is required',
      });
    }

    const success = await securityAutomation.acknowledgeEvent(id, acknowledgedBy);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Event not found',
      });
    }
    
    res.json({
      success: true,
      message: `Event ${id} acknowledged by ${acknowledgedBy}`,
    });
  } catch (error) {
    console.error('Acknowledge event error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to acknowledge event',
    });
  }
});

/**
 * POST /api/security/auto-patch
 * Trigger auto-patching
 */
router.post('/auto-patch', async (req, res) => {
  try {
    const { serviceId } = req.body;
    
    const result = await securityAutomation.autoPatchVulnerabilities(serviceId);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Auto-patch error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to auto-patch',
    });
  }
});

/**
 * POST /api/security/scheduled-scan
 * Trigger scheduled scans for all services
 */
router.post('/scheduled-scan', async (req, res) => {
  try {
    const result = await securityAutomation.runScheduledScans();
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Scheduled scan error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to run scheduled scans',
    });
  }
});

export default router;
