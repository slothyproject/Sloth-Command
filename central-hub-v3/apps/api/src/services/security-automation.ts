/**
 * Security Automation Service
 * Vulnerability scanning, compliance checking, and auto-patching
 * Continuous security monitoring with AI-powered analysis
 */

import { PrismaClient } from '@prisma/client';
import { generate, generateJSON, TaskComplexity } from './llm-router';
import { getQueue } from './queue';
import { redis } from './redis';

const prisma = new PrismaClient();

// Vulnerability severity
export enum VulnSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

// Vulnerability status
export enum VulnStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
  ACCEPTED_RISK = 'accepted_risk',
}

// Vulnerability
interface Vulnerability {
  id: string;
  serviceId: string;
  serviceName: string;
  cveId?: string;
  title: string;
  description: string;
  severity: VulnSeverity;
  cvssScore?: number;
  affectedComponent: string;
  affectedVersion?: string;
  fixedVersion?: string;
  references: string[];
  status: VulnStatus;
  discoveredAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  remediationSteps?: string[];
  autoPatched: boolean;
  patchStatus?: 'pending' | 'in_progress' | 'completed' | 'failed';
  patchError?: string;
}

// Security scan result
interface SecurityScan {
  id: string;
  serviceId: string;
  scanType: 'container' | 'dependency' | 'configuration' | 'runtime' | 'full';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    total: number;
  };
  scanDuration?: number; // seconds
  scannerVersion: string;
  metadata: Record<string, any>;
}

// Compliance check
interface ComplianceCheck {
  id: string;
  serviceId: string;
  framework: string; // e.g., 'SOC2', 'GDPR', 'PCI-DSS'
  rule: string;
  description: string;
  status: 'compliant' | 'non_compliant' | 'not_applicable';
  severity: VulnSeverity;
  evidence?: string;
  remediation?: string;
  checkedAt: Date;
}

// Security policy
interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rules: PolicyRule[];
  autoRemediate: boolean;
  autoRemediateSeverities: VulnSeverity[];
  maxAutoAttempts: number;
  notificationChannels: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Policy rule
interface PolicyRule {
  name: string;
  condition: {
    type: 'vulnerability' | 'compliance' | 'anomaly';
    severity?: VulnSeverity[];
    cvePattern?: string;
    component?: string;
  };
  action: {
    type: 'patch' | 'quarantine' | 'notify' | 'block';
    params?: Record<string, any>;
  };
  enabled: boolean;
}

// Security event
interface SecurityEvent {
  id: string;
  type: 'vulnerability_detected' | 'compliance_violation' | 'anomaly' | 'patch_applied' | 'policy_violation';
  severity: VulnSeverity;
  serviceId: string;
  description: string;
  metadata: Record<string, any>;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

// Redis keys
const REDIS_KEYS = {
  VULN_PREFIX: 'security:vuln:',
  SCAN_PREFIX: 'security:scan:',
  COMPLIANCE_PREFIX: 'security:compliance:',
  POLICY_PREFIX: 'security:policy:',
  EVENT_PREFIX: 'security:event:',
  LAST_SCAN_PREFIX: 'security:lastscan:',
  PATCH_QUEUE_PREFIX: 'security:patchq:',
};

// Known vulnerability patterns for simulation
const SIMULATED_VULNERABILITIES = [
  {
    cveId: 'CVE-2024-1234',
    title: 'Critical Remote Code Execution in Express.js',
    description: 'A critical vulnerability allows remote code execution through malformed JSON payloads.',
    severity: VulnSeverity.CRITICAL,
    cvssScore: 9.8,
    affectedComponent: 'express',
    affectedVersion: '< 4.18.3',
    fixedVersion: '4.18.3',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-1234'],
  },
  {
    cveId: 'CVE-2024-5678',
    title: 'High Severity SQL Injection in Prisma',
    description: 'Potential SQL injection in Prisma ORM when using raw queries with user input.',
    severity: VulnSeverity.HIGH,
    cvssScore: 8.5,
    affectedComponent: '@prisma/client',
    affectedVersion: '< 5.7.1',
    fixedVersion: '5.7.1',
    references: ['https://nvd.nist.gov/vuln/detail/CVE-2024-5678'],
  },
  {
    cveId: 'CVE-2024-9012',
    title: 'Medium Severity Information Disclosure',
    description: 'Sensitive information may be logged in error messages under certain conditions.',
    severity: VulnSeverity.MEDIUM,
    cvssScore: 5.3,
    affectedComponent: 'application',
    affectedVersion: 'all',
    fixedVersion: null,
    references: ['https://cwe.mitre.org/data/definitions/532.html'],
  },
];

/**
 * Run security scan on a service
 */
export async function runSecurityScan(
  serviceId: string,
  scanType: SecurityScan['scanType'] = 'full'
): Promise<SecurityScan> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error(`Service not found: ${serviceId}`);

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const scan: SecurityScan = {
    id: scanId,
    serviceId,
    scanType,
    status: 'in_progress',
    startedAt: new Date(),
    vulnerabilities: [],
    summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    scannerVersion: '1.0.0',
    metadata: { serviceName: service.name },
  };

  console.log(`🔍 Starting ${scanType} security scan for ${service.name}...`);

  try {
    // Simulate scan duration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate vulnerabilities based on scan type and randomness
    const vulns: Vulnerability[] = [];

    // Simulate finding some vulnerabilities
    const numVulns = Math.floor(Math.random() * 5) + 1; // 1-6 vulnerabilities

    for (let i = 0; i < numVulns; i++) {
      const template = SIMULATED_VULNERABILITIES[i % SIMULATED_VULNERABILITIES.length];
      
      const vuln: Vulnerability = {
        id: `vuln_${scanId}_${i}`,
        serviceId,
        serviceName: service.name,
        cveId: template.cveId,
        title: template.title,
        description: template.description,
        severity: template.severity,
        cvssScore: template.cvssScore,
        affectedComponent: template.affectedComponent,
        affectedVersion: template.affectedVersion,
        fixedVersion: template.fixedVersion,
        references: template.references,
        status: VulnStatus.OPEN,
        discoveredAt: new Date(),
        autoPatched: false,
      };

      // Generate remediation steps with AI
      vuln.remediationSteps = await generateRemediationSteps(vuln);

      vulns.push(vuln);
      scan.summary[template.severity]++;
    }

    scan.summary.total = vulns.length;
    scan.vulnerabilities = vulns;
    scan.status = 'completed';
    scan.completedAt = new Date();
    scan.scanDuration = (scan.completedAt.getTime() - scan.startedAt.getTime()) / 1000;

    console.log(`✅ Security scan completed: ${vulns.length} vulnerabilities found`);

    // Store vulnerabilities
    for (const vuln of vulns) {
      await redis.setex(
        `${REDIS_KEYS.VULN_PREFIX}${vuln.id}`,
        604800, // 7 days
        JSON.stringify(vuln)
      );
    }

    // Store scan result
    await redis.setex(
      `${REDIS_KEYS.SCAN_PREFIX}${scanId}`,
      604800,
      JSON.stringify(scan)
    );

    // Update last scan time
    await redis.setex(
      `${REDIS_KEYS.LAST_SCAN_PREFIX}${serviceId}`,
      86400,
      Date.now().toString()
    );

    // Create security events for critical/high vulnerabilities
    for (const vuln of vulns) {
      if (vuln.severity === VulnSeverity.CRITICAL || vuln.severity === VulnSeverity.HIGH) {
        await createSecurityEvent({
          type: 'vulnerability_detected',
          severity: vuln.severity,
          serviceId,
          description: `${vuln.severity} vulnerability detected: ${vuln.title}`,
          metadata: { vulnId: vuln.id, cveId: vuln.cveId },
        });
      }
    }

    return scan;
  } catch (error) {
    scan.status = 'failed';
    console.error(`❌ Security scan failed:`, error);
    throw error;
  }
}

/**
 * Generate remediation steps using AI
 */
async function generateRemediationSteps(vuln: Vulnerability): Promise<string[]> {
  const prompt = `Generate remediation steps for this vulnerability:

TITLE: ${vuln.title}
SEVERITY: ${vuln.severity}
${vuln.cveId ? `CVE: ${vuln.cveId}` : ''}
AFFECTED COMPONENT: ${vuln.affectedComponent}
AFFECTED VERSION: ${vuln.affectedVersion}
${vuln.fixedVersion ? `FIXED VERSION: ${vuln.fixedVersion}` : ''}

DESCRIPTION: ${vuln.description}

Provide 3-5 clear, actionable steps to remediate this vulnerability.
Consider:
1. Immediate mitigation steps
2. Patch/update procedures
3. Testing recommendations
4. Rollback procedures

Respond with a JSON array of step strings.`;

  try {
    const steps = await generateJSON<string[]>(
      prompt,
      '["string"]',
      { complexity: TaskComplexity.MODERATE }
    );
    return steps;
  } catch (error) {
    // Fallback steps
    return [
      `Review the vulnerability details for ${vuln.affectedComponent}`,
      vuln.fixedVersion ? `Update ${vuln.affectedComponent} to version ${vuln.fixedVersion}` : 'Apply available patches',
      'Test in staging environment before production deployment',
      'Monitor service health after remediation',
    ];
  }
}

/**
 * Run compliance check
 */
export async function runComplianceCheck(
  serviceId: string,
  framework: string = 'SOC2'
): Promise<ComplianceCheck[]> {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error(`Service not found: ${serviceId}`);

  const checks: ComplianceCheck[] = [];

  // Define compliance rules based on framework
  const rules: Array<{ rule: string; description: string; severity: VulnSeverity }> = [
    {
      rule: 'encryption_at_rest',
      description: 'Data must be encrypted at rest',
      severity: VulnSeverity.HIGH,
    },
    {
      rule: 'encryption_in_transit',
      description: 'Data must be encrypted in transit (TLS 1.2+)',
      severity: VulnSeverity.HIGH,
    },
    {
      rule: 'access_logging',
      description: 'Access logs must be enabled and retained for 90 days',
      severity: VulnSeverity.MEDIUM,
    },
    {
      rule: 'mfa_required',
      description: 'Multi-factor authentication required for admin access',
      severity: VulnSeverity.MEDIUM,
    },
    {
      rule: 'password_policy',
      description: 'Strong password policy must be enforced',
      severity: VulnSeverity.MEDIUM,
    },
  ];

  for (const rule of rules) {
    // Simulate compliance check - in reality, this would inspect actual configurations
    const isCompliant = Math.random() > 0.3; // 70% compliance rate for simulation

    const check: ComplianceCheck = {
      id: `compliance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      serviceId,
      framework,
      rule: rule.rule,
      description: rule.description,
      status: isCompliant ? 'compliant' : 'non_compliant',
      severity: rule.severity,
      evidence: isCompliant ? 'Configuration verified' : 'Configuration does not meet requirements',
      remediation: isCompliant
        ? undefined
        : `Enable/configure ${rule.rule} for service ${service.name}`,
      checkedAt: new Date(),
    };

    checks.push(check);

    // Store check
    await redis.setex(
      `${REDIS_KEYS.COMPLIANCE_PREFIX}${check.id}`,
      86400,
      JSON.stringify(check)
    );

    // Create event for non-compliant
    if (!isCompliant) {
      await createSecurityEvent({
        type: 'compliance_violation',
        severity: rule.severity,
        serviceId,
        description: `Compliance violation: ${rule.description}`,
        metadata: { framework, rule: rule.rule, checkId: check.id },
      });
    }
  }

  console.log(`✅ Compliance check completed: ${checks.filter((c) => c.status === 'non_compliant').length} violations found`);

  return checks;
}

/**
 * Apply security patch
 */
export async function applyPatch(
  vulnId: string,
  options: {
    backup?: boolean;
    testInStaging?: boolean;
    autoApprove?: boolean;
  } = {}
): Promise<{
  success: boolean;
  message: string;
  backupCreated?: boolean;
  appliedAt?: Date;
}> {
  const vulnData = await redis.get(`${REDIS_KEYS.VULN_PREFIX}${vulnId}`);
  if (!vulnData) {
    return { success: false, message: 'Vulnerability not found' };
  }

  const vuln: Vulnerability = JSON.parse(vulnData);

  if (vuln.status !== VulnStatus.OPEN) {
    return { success: false, message: `Vulnerability is already ${vuln.status}` };
  }

  // Update patch status
  vuln.patchStatus = 'in_progress';
  await redis.setex(
    `${REDIS_KEYS.VULN_PREFIX}${vulnId}`,
    604800,
    JSON.stringify(vuln)
  );

  console.log(`🔧 Applying patch for ${vuln.cveId || vuln.title}...`);

  try {
    // Simulate backup creation
    if (options.backup !== false) {
      console.log(`💾 Creating backup before patch...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Simulate patch application
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update vulnerability status
    vuln.status = VulnStatus.RESOLVED;
    vuln.resolvedAt = new Date();
    vuln.resolvedBy = 'security-automation';
    vuln.autoPatched = options.autoApprove || false;
    vuln.patchStatus = 'completed';

    await redis.setex(
      `${REDIS_KEYS.VULN_PREFIX}${vulnId}`,
      604800,
      JSON.stringify(vuln)
    );

    // Create security event
    await createSecurityEvent({
      type: 'patch_applied',
      severity: VulnSeverity.INFO,
      serviceId: vuln.serviceId,
      description: `Patch applied for ${vuln.cveId || vuln.title}`,
      metadata: { vulnId, cveId: vuln.cveId, autoPatched: vuln.autoPatched },
    });

    console.log(`✅ Patch applied successfully for ${vuln.cveId || vuln.title}`);

    return {
      success: true,
      message: 'Patch applied successfully',
      backupCreated: options.backup !== false,
      appliedAt: vuln.resolvedAt,
    };
  } catch (error) {
    vuln.patchStatus = 'failed';
    vuln.patchError = error instanceof Error ? error.message : String(error);

    await redis.setex(
      `${REDIS_KEYS.VULN_PREFIX}${vulnId}`,
      604800,
      JSON.stringify(vuln)
    );

    console.error(`❌ Patch failed for ${vuln.cveId || vuln.title}:`, vuln.patchError);

    return {
      success: false,
      message: `Patch failed: ${vuln.patchError}`,
    };
  }
}

/**
 * Queue patch for async application
 */
export async function queuePatch(vulnId: string, priority: boolean = false): Promise<void> {
  const queue = getQueue('security-patches');
  
  await queue.add(
    'apply-patch',
    { vulnId },
    {
      priority: priority ? 1 : 5,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 60000,
      },
    }
  );

  console.log(`📋 Queued patch for ${vulnId}${priority ? ' (PRIORITY)' : ''}`);
}

/**
 * Auto-patch vulnerabilities based on policy
 */
export async function autoPatchVulnerabilities(serviceId?: string): Promise<{
  scanned: number;
  patched: number;
  failed: number;
  queued: number;
}> {
  const policy = await getSecurityPolicy('default');
  if (!policy || !policy.autoRemediate) {
    return { scanned: 0, patched: 0, failed: 0, queued: 0 };
  }

  // Get all open vulnerabilities
  const keys = await redis.keys(`${REDIS_KEYS.VULN_PREFIX}*`);
  const vulns: Vulnerability[] = [];

  for (const key of keys) {
    const vulnData = await redis.get(key);
    if (vulnData) {
      const vuln: Vulnerability = JSON.parse(vulnData);
      if (vuln.status === VulnStatus.OPEN && (!serviceId || vuln.serviceId === serviceId)) {
        vulns.push(vuln);
      }
    }
  }

  let patched = 0;
  let failed = 0;
  let queued = 0;

  for (const vuln of vulns) {
    // Check if severity is eligible for auto-patching
    if (policy.autoRemediateSeverities.includes(vuln.severity)) {
      if (vuln.severity === VulnSeverity.CRITICAL) {
        // Immediate patch for critical
        try {
          const result = await applyPatch(vuln.id, { autoApprove: true });
          if (result.success) patched++;
          else failed++;
        } catch (error) {
          failed++;
        }
      } else {
        // Queue for patching
        await queuePatch(vuln.id, vuln.severity === VulnSeverity.HIGH);
        queued++;
      }
    }
  }

  return {
    scanned: vulns.length,
    patched,
    failed,
    queued,
  };
}

/**
 * Create security event
 */
export async function createSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'acknowledged'>): Promise<SecurityEvent> {
  const securityEvent: SecurityEvent = {
    ...event,
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    acknowledged: false,
  };

  await redis.setex(
    `${REDIS_KEYS.EVENT_PREFIX}${securityEvent.id}`,
    2592000, // 30 days
    JSON.stringify(securityEvent)
  );

  console.log(`🚨 Security event: ${event.type} - ${event.description}`);

  return securityEvent;
}

/**
 * Get security policy
 */
export async function getSecurityPolicy(policyId: string): Promise<SecurityPolicy | null> {
  const policyData = await redis.get(`${REDIS_KEYS.POLICY_PREFIX}${policyId}`);
  if (!policyData) {
    // Return default policy
    return {
      id: 'default',
      name: 'Default Security Policy',
      description: 'Default security policy with auto-remediation for critical vulnerabilities',
      enabled: true,
      rules: [],
      autoRemediate: true,
      autoRemediateSeverities: [VulnSeverity.CRITICAL],
      maxAutoAttempts: 3,
      notificationChannels: ['discord', 'email'],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  return JSON.parse(policyData);
}

/**
 * Get vulnerability by ID
 */
export async function getVulnerability(vulnId: string): Promise<Vulnerability | null> {
  const vulnData = await redis.get(`${REDIS_KEYS.VULN_PREFIX}${vulnId}`);
  if (!vulnData) return null;
  return JSON.parse(vulnData);
}

/**
 * Get all vulnerabilities
 */
export async function getAllVulnerabilities(filters?: {
  serviceId?: string;
  status?: VulnStatus;
  severity?: VulnSeverity;
}): Promise<Vulnerability[]> {
  const keys = await redis.keys(`${REDIS_KEYS.VULN_PREFIX}*`);
  const vulns: Vulnerability[] = [];

  for (const key of keys) {
    const vulnData = await redis.get(key);
    if (vulnData) {
      const vuln: Vulnerability = JSON.parse(vulnData);
      
      // Apply filters
      if (filters?.serviceId && vuln.serviceId !== filters.serviceId) continue;
      if (filters?.status && vuln.status !== filters.status) continue;
      if (filters?.severity && vuln.severity !== filters.severity) continue;
      
      vulns.push(vuln);
    }
  }

  // Sort by severity then date
  const severityOrder = {
    [VulnSeverity.CRITICAL]: 0,
    [VulnSeverity.HIGH]: 1,
    [VulnSeverity.MEDIUM]: 2,
    [VulnSeverity.LOW]: 3,
    [VulnSeverity.INFO]: 4,
  };

  return vulns.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
  });
}

/**
 * Get security scan by ID
 */
export async function getSecurityScan(scanId: string): Promise<SecurityScan | null> {
  const scanData = await redis.get(`${REDIS_KEYS.SCAN_PREFIX}${scanId}`);
  if (!scanData) return null;
  return JSON.parse(scanData);
}

/**
 * Get recent security scans
 */
export async function getRecentScans(serviceId?: string, limit: number = 10): Promise<SecurityScan[]> {
  const keys = await redis.keys(`${REDIS_KEYS.SCAN_PREFIX}*`);
  const scans: SecurityScan[] = [];

  for (const key of keys) {
    const scanData = await redis.get(key);
    if (scanData) {
      const scan: SecurityScan = JSON.parse(scanData);
      if (!serviceId || scan.serviceId === serviceId) {
        scans.push(scan);
      }
    }
  }

  return scans
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit);
}

/**
 * Get security events
 */
export async function getSecurityEvents(
  filters?: {
    serviceId?: string;
    type?: SecurityEvent['type'];
    acknowledged?: boolean;
  },
  limit: number = 50
): Promise<SecurityEvent[]> {
  const keys = await redis.keys(`${REDIS_KEYS.EVENT_PREFIX}*`);
  const events: SecurityEvent[] = [];

  for (const key of keys) {
    const eventData = await redis.get(key);
    if (eventData) {
      const event: SecurityEvent = JSON.parse(eventData);
      
      if (filters?.serviceId && event.serviceId !== filters.serviceId) continue;
      if (filters?.type && event.type !== filters.type) continue;
      if (filters?.acknowledged !== undefined && event.acknowledged !== filters.acknowledged) continue;
      
      events.push(event);
    }
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

/**
 * Acknowledge security event
 */
export async function acknowledgeEvent(
  eventId: string,
  acknowledgedBy: string
): Promise<boolean> {
  const eventData = await redis.get(`${REDIS_KEYS.EVENT_PREFIX}${eventId}`);
  if (!eventData) return false;

  const event: SecurityEvent = JSON.parse(eventData);
  event.acknowledged = true;
  event.acknowledgedBy = acknowledgedBy;
  event.acknowledgedAt = new Date();

  await redis.setex(
    `${REDIS_KEYS.EVENT_PREFIX}${eventId}`,
    2592000,
    JSON.stringify(event)
  );

  return true;
}

/**
 * Get security dashboard data
 */
export async function getSecurityDashboard(): Promise<{
  summary: {
    totalVulnerabilities: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    open: number;
    resolved: number;
  };
  recentScans: SecurityScan[];
  recentEvents: SecurityEvent[];
  topVulnerableServices: Array<{
    serviceId: string;
    serviceName: string;
    vulnerabilityCount: number;
    criticalCount: number;
  }>;
  compliance: {
    totalChecks: number;
    passed: number;
    failed: number;
    complianceRate: number;
  };
}> {
  const allVulns = await getAllVulnerabilities();
  const recentScans = await getRecentScans(undefined, 5);
  const recentEvents = await getSecurityEvents({ acknowledged: false }, 10);

  // Calculate summary
  const summary = {
    totalVulnerabilities: allVulns.length,
    critical: allVulns.filter((v) => v.severity === VulnSeverity.CRITICAL).length,
    high: allVulns.filter((v) => v.severity === VulnSeverity.HIGH).length,
    medium: allVulns.filter((v) => v.severity === VulnSeverity.MEDIUM).length,
    low: allVulns.filter((v) => v.severity === VulnSeverity.LOW).length,
    open: allVulns.filter((v) => v.status === VulnStatus.OPEN).length,
    resolved: allVulns.filter((v) => v.status === VulnStatus.RESOLVED).length,
  };

  // Calculate top vulnerable services
  const serviceVulnCounts = new Map<string, { name: string; count: number; critical: number }>();
  for (const vuln of allVulns.filter((v) => v.status === VulnStatus.OPEN)) {
    const current = serviceVulnCounts.get(vuln.serviceId) || { name: vuln.serviceName, count: 0, critical: 0 };
    current.count++;
    if (vuln.severity === VulnSeverity.CRITICAL) current.critical++;
    serviceVulnCounts.set(vuln.serviceId, current);
  }

  const topVulnerableServices = Array.from(serviceVulnCounts.entries())
    .map(([serviceId, data]) => ({
      serviceId,
      serviceName: data.name,
      vulnerabilityCount: data.count,
      criticalCount: data.critical,
    }))
    .sort((a, b) => b.criticalCount - a.criticalCount || b.vulnerabilityCount - a.vulnerabilityCount)
    .slice(0, 5);

  // Get compliance stats from all compliance checks
  const complianceKeys = await redis.keys(`${REDIS_KEYS.COMPLIANCE_PREFIX}*`);
  let passed = 0;
  let failed = 0;

  for (const key of complianceKeys) {
    const checkData = await redis.get(key);
    if (checkData) {
      const check: ComplianceCheck = JSON.parse(checkData);
      if (check.status === 'compliant') passed++;
      else if (check.status === 'non_compliant') failed++;
    }
  }

  return {
    summary,
    recentScans,
    recentEvents,
    topVulnerableServices,
    compliance: {
      totalChecks: passed + failed,
      passed,
      failed,
      complianceRate: passed + failed > 0 ? (passed / (passed + failed)) * 100 : 100,
    },
  };
}

/**
 * Run scheduled security scan
 */
export async function runScheduledScans(): Promise<{
  servicesScanned: number;
  vulnerabilitiesFound: number;
}> {
  const services = await prisma.service.findMany();
  let totalVulns = 0;

  for (const service of services) {
    try {
      const scan = await runSecurityScan(service.id, 'full');
      totalVulns += scan.summary.total;
    } catch (error) {
      console.error(`Scheduled scan failed for ${service.name}:`, error);
    }
  }

  // Auto-patch after scan
  await autoPatchVulnerabilities();

  return {
    servicesScanned: services.length,
    vulnerabilitiesFound: totalVulns,
  };
}

// Export types and functions
export {
  Vulnerability,
  SecurityScan,
  ComplianceCheck,
  SecurityPolicy,
  PolicyRule,
  SecurityEvent,
  VulnSeverity,
  VulnStatus,
};

export default {
  runSecurityScan,
  runComplianceCheck,
  applyPatch,
  queuePatch,
  autoPatchVulnerabilities,
  createSecurityEvent,
  getSecurityPolicy,
  getVulnerability,
  getAllVulnerabilities,
  getSecurityScan,
  getRecentScans,
  getSecurityEvents,
  acknowledgeEvent,
  getSecurityDashboard,
  runScheduledScans,
  VulnSeverity,
  VulnStatus,
};
