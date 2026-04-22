/**
 * Knowledge Graph Service
 * Neo4j-powered graph database for infrastructure relationships
 * Enables intelligent AI recommendations and root cause analysis
 */

import neo4j, { Driver, Session } from 'neo4j-driver';

// Neo4j configuration
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

// Neo4j driver instance
let driver: Driver | null = null;

/**
 * Initialize Neo4j connection
 */
export function initializeNeo4j(): Driver {
  if (driver) return driver;

  try {
    driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
      {
        maxConnectionPoolSize: 10,
        connectionAcquisitionTimeout: 30000,
      }
    );

    console.log('✅ Neo4j knowledge graph connected');
    return driver;
  } catch (error) {
    console.error('❌ Failed to initialize Neo4j:', error);
    throw error;
  }
}

/**
 * Get Neo4j driver
 */
export function getDriver(): Driver {
  if (!driver) {
    return initializeNeo4j();
  }
  return driver;
}

/**
 * Get a session for queries
 */
export function getSession(): Session {
  return getDriver().session();
}

/**
 * Create or update a service node
 */
export async function createServiceNode(
  serviceId: string,
  name: string,
  platform: string,
  status: string,
  properties: Record<string, any> = {}
): Promise<void> {
  const session = getSession();
  
  try {
    await session.run(
      `
      MERGE (s:Service {id: $serviceId})
      ON CREATE SET 
        s.createdAt = datetime(),
        s.name = $name,
        s.platform = $platform,
        s.status = $status,
        s.properties = $properties
      ON MATCH SET 
        s.updatedAt = datetime(),
        s.name = $name,
        s.platform = $platform,
        s.status = $status,
        s.properties = $properties
      RETURN s
      `,
      { serviceId, name, platform, status, properties }
    );
    
    console.log(`📝 Knowledge graph: Service node ${name} (${serviceId})`);
  } finally {
    await session.close();
  }
}

/**
 * Create dependency relationship between services
 */
export async function createDependency(
  fromServiceId: string,
  toServiceId: string,
  dependencyType: string = 'depends_on'
): Promise<void> {
  const session = getSession();
  
  try {
    await session.run(
      `
      MATCH (from:Service {id: $fromServiceId})
      MATCH (to:Service {id: $toServiceId})
      MERGE (from)-[r:${dependencyType.toUpperCase()}]->(to)
      ON CREATE SET r.createdAt = datetime()
      ON MATCH SET r.updatedAt = datetime()
      RETURN r
      `,
      { fromServiceId, toServiceId }
    );
    
    console.log(`🔗 Knowledge graph: ${fromServiceId} ${dependencyType} ${toServiceId}`);
  } finally {
    await session.close();
  }
}

/**
 * Get service dependencies (what this service depends on)
 */
export async function getDependencies(serviceId: string): Promise<Array<{
  id: string;
  name: string;
  platform: string;
  status: string;
  relationship: string;
}>> {
  const session = getSession();
  
  try {
    const result = await session.run(
      `
      MATCH (s:Service {id: $serviceId})-[r]->(dep:Service)
      RETURN dep.id as id, dep.name as name, dep.platform as platform, 
             dep.status as status, type(r) as relationship
      `,
      { serviceId }
    );
    
    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      platform: record.get('platform'),
      status: record.get('status'),
      relationship: record.get('relationship'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get dependents (what depends on this service)
 */
export async function getDependents(serviceId: string): Promise<Array<{
  id: string;
  name: string;
  platform: string;
  status: string;
  relationship: string;
}>> {
  const session = getSession();
  
  try {
    const result = await session.run(
      `
      MATCH (dep:Service)-[r]->(s:Service {id: $serviceId})
      RETURN dep.id as id, dep.name as name, dep.platform as platform, 
             dep.status as status, type(r) as relationship
      `,
      { serviceId }
    );
    
    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      platform: record.get('platform'),
      status: record.get('status'),
      relationship: record.get('relationship'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Find blast radius - all services affected if this service fails
 */
export async function findBlastRadius(
  serviceId: string,
  depth: number = 3
): Promise<Array<{
  id: string;
  name: string;
  platform: string;
  depth: number;
  path: string[];
}>> {
  const session = getSession();
  
  try {
    const result = await session.run(
      `
      MATCH path = (s:Service {id: $serviceId})-[:DEPENDS_ON*1..${depth}]->(affected:Service)
      RETURN affected.id as id, affected.name as name, affected.platform as platform,
             length(path) as depth, [node in nodes(path) | node.name] as path
      `,
      { serviceId }
    );
    
    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      platform: record.get('platform'),
      depth: record.get('depth').toNumber(),
      path: record.get('path'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Find circular dependencies
 */
export async function findCircularDependencies(): Promise<Array<{
  services: string[];
  cycle: string;
}>> {
  const session = getSession();
  
  try {
    const result = await session.run(
      `
      MATCH path = (s:Service)-[:DEPENDS_ON*2..10]->(s)
      RETURN [node in nodes(path) | node.name] as services,
             reduce(acc = "", n in nodes(path) | acc + " -> " + n.name) as cycle
      LIMIT 10
      `
    );
    
    return result.records.map(record => ({
      services: record.get('services'),
      cycle: record.get('cycle'),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Get critical path - most important services (most dependents)
 */
export async function getCriticalServices(): Promise<Array<{
  id: string;
  name: string;
  dependentCount: number;
  blastRadiusScore: number;
}>> {
  const session = getSession();
  
  try {
    const result = await session.run(
      `
      MATCH (s:Service)<-[:DEPENDS_ON*0..5]-(dependent:Service)
      WITH s, count(DISTINCT dependent) as dependentCount,
           count(DISTINCT CASE WHEN dependent.status = 'healthy' THEN dependent END) as healthyCount
      RETURN s.id as id, s.name as name, dependentCount,
             (dependentCount - healthyCount) as blastRadiusScore
      ORDER BY blastRadiusScore DESC, dependentCount DESC
      LIMIT 10
      `
    );
    
    return result.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      dependentCount: record.get('dependentCount').toNumber(),
      blastRadiusScore: record.get('blastRadiusScore').toNumber(),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Create deployment node and link to service
 */
export async function createDeployment(
  deploymentId: string,
  serviceId: string,
  status: string,
  properties: Record<string, any> = {}
): Promise<void> {
  const session = getSession();
  
  try {
    await session.run(
      `
      MATCH (s:Service {id: $serviceId})
      CREATE (d:Deployment {
        id: $deploymentId,
        status: $status,
        createdAt: datetime(),
        properties: $properties
      })
      CREATE (s)-[:HAS_DEPLOYMENT]->(d)
      `,
      { deploymentId, serviceId, status, properties }
    );
  } finally {
    await session.close();
  }
}

/**
 * Sync entire infrastructure from database
 */
export async function syncInfrastructure(
  services: Array<{
    id: string;
    name: string;
    platform: string;
    status: string;
    config?: any;
  }>
): Promise<void> {
  const session = getSession();
  
  try {
    // Clear existing data (optional - use with caution)
    // await session.run('MATCH (n) DETACH DELETE n');
    
    // Create all service nodes
    for (const service of services) {
      await createServiceNode(
        service.id,
        service.name,
        service.platform,
        service.status,
        service.config || {}
      );
    }
    
    console.log(`🔄 Knowledge graph synced: ${services.length} services`);
  } finally {
    await session.close();
  }
}

/**
 * Get topology for visualization
 */
export async function getTopology(): Promise<{
  nodes: Array<{ id: string; name: string; platform: string; status: string }>;
  edges: Array<{ from: string; to: string; type: string }>;
}> {
  const session = getSession();
  
  try {
    // Get all nodes
    const nodesResult = await session.run(
      `
      MATCH (s:Service)
      RETURN s.id as id, s.name as name, s.platform as platform, s.status as status
      `
    );
    
    const nodes = nodesResult.records.map(record => ({
      id: record.get('id'),
      name: record.get('name'),
      platform: record.get('platform'),
      status: record.get('status'),
    }));
    
    // Get all edges
    const edgesResult = await session.run(
      `
      MATCH (from:Service)-[r]->(to:Service)
      RETURN from.id as from, to.id as to, type(r) as type
      `
    );
    
    const edges = edgesResult.records.map(record => ({
      from: record.get('from'),
      to: record.get('to'),
      type: record.get('type'),
    }));
    
    return { nodes, edges };
  } finally {
    await session.close();
  }
}

/**
 * Close Neo4j connection
 */
export async function closeNeo4j(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
    console.log('👋 Neo4j connection closed');
  }
}

/**
 * Health check
 */
export async function checkNeo4jHealth(): Promise<boolean> {
  const session = getSession();
  
  try {
    await session.run('RETURN 1');
    return true;
  } catch (error) {
    return false;
  } finally {
    await session.close();
  }
}

// Export
export default {
  initializeNeo4j,
  getDriver,
  getSession,
  createServiceNode,
  createDependency,
  getDependencies,
  getDependents,
  findBlastRadius,
  findCircularDependencies,
  getCriticalServices,
  createDeployment,
  syncInfrastructure,
  getTopology,
  closeNeo4j,
  checkNeo4jHealth,
};
