/**
 * Railway API Service
 * Integrates with Railway's GraphQL API to manage services
 * Provides full CRUD operations for Railway services
 */

import { PrismaClient, Service, Variable, Deployment } from '@prisma/client';

const prisma = new PrismaClient();

// Railway GraphQL API configuration
const RAILWAY_API_URL = 'https://backboard.railway.app/graphql';
const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN;

// GraphQL client for Railway
async function railwayGraphQLQuery(query: string, variables?: Record<string, any>): Promise<any> {
  if (!RAILWAY_TOKEN) {
    throw new Error('RAILWAY_TOKEN not configured');
  }

  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Railway API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`Railway GraphQL error: ${data.errors.map((e: any) => e.message).join(', ')}`);
  }

  return data.data;
}

/**
 * Sync Railway services to Central Hub database
 */
export async function syncServices(): Promise<Service[]> {
  try {
    // Query Railway for all services
    const query = `
      query GetServices {
        me {
          projects {
            edges {
              node {
                id
                name
                services {
                  edges {
                    node {
                      id
                      name
                      source {
                        image
                        repo
                      }
                      deployments {
                        edges {
                          node {
                            id
                            status
                            createdAt
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await railwayGraphQLQuery(query);
    const projects = data.me.projects.edges;

    const syncedServices: Service[] = [];

    for (const projectEdge of projects) {
      const project = projectEdge.node;
      
      for (const serviceEdge of project.services.edges) {
        const railwayService = serviceEdge.node;
        
        // Check if service already exists in our DB
        let service = await prisma.service.findFirst({
          where: { externalId: railwayService.id },
        });

        const latestDeployment = railwayService.deployments.edges[0]?.node;

        if (!service) {
          // Create new service record
          service = await prisma.service.create({
            data: {
              name: railwayService.name,
              platform: 'railway',
              externalId: railwayService.id,
              status: mapRailwayStatus(latestDeployment?.status || 'unknown'),
              repositoryUrl: railwayService.source?.repo,
              lastDeploy: latestDeployment?.createdAt,
              config: {
                railwayProjectId: project.id,
                railwayProjectName: project.name,
                sourceImage: railwayService.source?.image,
              },
            },
          });
        } else {
          // Update existing service
          service = await prisma.service.update({
            where: { id: service.id },
            data: {
              name: railwayService.name,
              status: mapRailwayStatus(latestDeployment?.status || service.status),
              lastDeploy: latestDeployment?.createdAt || service.lastDeploy,
              config: {
                ...service.config as any,
                railwayProjectName: project.name,
              },
            },
          });
        }

        syncedServices.push(service);
      }
    }

    console.log(`✅ Synced ${syncedServices.length} Railway services`);
    return syncedServices;
  } catch (error) {
    console.error('❌ Railway sync failed:', error);
    throw error;
  }
}

/**
 * Get detailed service metrics from Railway
 */
export async function getServiceMetrics(serviceId: string): Promise<{
  cpu: number;
  memory: number;
  disk: number;
  network: { in: number; out: number };
}> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    const query = `
      query GetMetrics($serviceId: String!) {
        service(id: $serviceId) {
          id
          instances {
            edges {
              node {
                id
                metrics {
                  cpu
                  memory
                  disk
                  network {
                    in
                    out
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await railwayGraphQLQuery(query, { serviceId: service.externalId });
    
    // Aggregate metrics from all instances
    const instances = data.service.instances.edges;
    if (instances.length === 0) {
      return { cpu: 0, memory: 0, disk: 0, network: { in: 0, out: 0 } };
    }

    const totals = instances.reduce((acc: any, edge: any) => {
      const m = edge.node.metrics;
      return {
        cpu: acc.cpu + (m.cpu || 0),
        memory: acc.memory + (m.memory || 0),
        disk: acc.disk + (m.disk || 0),
        network: {
          in: acc.network.in + (m.network?.in || 0),
          out: acc.network.out + (m.network?.out || 0),
        },
      };
    }, { cpu: 0, memory: 0, disk: 0, network: { in: 0, out: 0 } });

    // Average across instances
    return {
      cpu: totals.cpu / instances.length,
      memory: totals.memory / instances.length,
      disk: totals.disk / instances.length,
      network: {
        in: totals.network.in / instances.length,
        out: totals.network.out / instances.length,
      },
    };
  } catch (error) {
    console.error('Failed to get metrics:', error);
    throw error;
  }
}

/**
 * Deploy a service
 */
export async function deployService(serviceId: string): Promise<Deployment> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    const mutation = `
      mutation DeployService($serviceId: String!) {
        serviceInstanceDeploy(serviceId: $serviceId) {
          id
          status
          createdAt
        }
      }
    `;

    const data = await railwayGraphQLQuery(mutation, { serviceId: service.externalId });
    const deployment = data.serviceInstanceDeploy;

    // Record deployment in our DB
    const dbDeployment = await prisma.deployment.create({
      data: {
        serviceId,
        status: mapRailwayStatus(deployment.status),
        deployedBy: 'user',
      },
    });

    // Update service last deploy
    await prisma.service.update({
      where: { id: serviceId },
      data: { lastDeploy: new Date() },
    });

    console.log(`✅ Deployed service ${service.name}`);
    return dbDeployment;
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    
    // Record failed deployment
    return prisma.deployment.create({
      data: {
        serviceId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        deployedBy: 'user',
      },
    });
  }
}

/**
 * Restart a service
 */
export async function restartService(serviceId: string): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    const mutation = `
      mutation RestartService($serviceId: String!) {
        serviceInstanceRestart(serviceId: $serviceId)
      }
    `;

    await railwayGraphQLQuery(mutation, { serviceId: service.externalId });
    
    console.log(`✅ Restarted service ${service.name}`);
    return true;
  } catch (error) {
    console.error('❌ Restart failed:', error);
    return false;
  }
}

/**
 * Update environment variables
 */
export async function updateVariables(
  serviceId: string,
  variables: Record<string, string>
): Promise<Variable[]> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
    include: { variables: true },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  const results: Variable[] = [];

  for (const [key, value] of Object.entries(variables)) {
    try {
      // Update in Railway
      const mutation = `
        mutation UpdateVariable($serviceId: String!, $name: String!, $value: String!) {
          variableUpsert(
            serviceId: $serviceId
            name: $name
            value: $value
          ) {
            id
            name
            value
          }
        }
      `;

      await railwayGraphQLQuery(mutation, {
        serviceId: service.externalId,
        name: key,
        value,
      });

      // Update in our DB
      const existingVar = service.variables.find(v => v.name === key);
      
      if (existingVar) {
        const updated = await prisma.variable.update({
          where: { id: existingVar.id },
          data: { value },
        });
        results.push(updated);
      } else {
        const created = await prisma.variable.create({
          data: {
            serviceId,
            name: key,
            value,
            isSecret: key.toLowerCase().includes('secret') || 
                      key.toLowerCase().includes('password') ||
                      key.toLowerCase().includes('token') ||
                      key.toLowerCase().includes('key'),
          },
        });
        results.push(created);
      }
    } catch (error) {
      console.error(`❌ Failed to update variable ${key}:`, error);
    }
  }

  console.log(`✅ Updated ${results.length} variables for ${service.name}`);
  return results;
}

/**
 * Get service logs
 */
export async function getLogs(
  serviceId: string,
  limit: number = 100
): Promise<string[]> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    const query = `
      query GetLogs($serviceId: String!, $limit: Int!) {
        service(id: $serviceId) {
          deployments(last: 1) {
            edges {
              node {
                logs(limit: $limit)
              }
            }
          }
        }
      }
    `;

    const data = await railwayGraphQLQuery(query, {
      serviceId: service.externalId,
      limit,
    });

    const logs = data.service.deployments.edges[0]?.node?.logs || [];
    return logs;
  } catch (error) {
    console.error('Failed to get logs:', error);
    return [];
  }
}

/**
 * Scale service instances
 */
export async function scaleService(
  serviceId: string,
  replicas: number
): Promise<boolean> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    // Note: Railway's scaling is typically done through the dashboard
    // or by setting the RAILWAY_REPLICA_COUNT environment variable
    await updateVariables(serviceId, {
      RAILWAY_REPLICA_COUNT: replicas.toString(),
    });

    console.log(`✅ Scaled ${service.name} to ${replicas} replicas`);
    return true;
  } catch (error) {
    console.error('❌ Scaling failed:', error);
    return false;
  }
}

/**
 * Get all Railway services
 */
export async function getRailwayServices(): Promise<Partial<Service>[]> {
  try {
    const query = `
      query GetAllServices {
        me {
          projects {
            edges {
              node {
                services {
                  edges {
                    node {
                      id
                      name
                      source {
                        repo
                        image
                      }
                      deployments(last: 1) {
                        edges {
                          node {
                            status
                            createdAt
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await railwayGraphQLQuery(query);
    const services: Partial<Service>[] = [];

    for (const project of data.me.projects.edges) {
      for (const serviceEdge of project.node.services.edges) {
        const s = serviceEdge.node;
        services.push({
          externalId: s.id,
          name: s.name,
          platform: 'railway',
          status: mapRailwayStatus(s.deployments.edges[0]?.node?.status || 'unknown'),
          lastDeploy: s.deployments.edges[0]?.node?.createdAt,
          repositoryUrl: s.source?.repo,
        });
      }
    }

    return services;
  } catch (error) {
    console.error('Failed to get Railway services:', error);
    return [];
  }
}

/**
 * Helper: Map Railway status to our status
 */
function mapRailwayStatus(railwayStatus: string): string {
  const statusMap: Record<string, string> = {
    'SUCCESS': 'healthy',
    'FAILED': 'unhealthy',
    'BUILDING': 'degraded',
    'DEPLOYING': 'degraded',
    'INITIALIZING': 'degraded',
    'UNKNOWN': 'unknown',
    'STOPPED': 'stopped',
  };

  return statusMap[railwayStatus.toUpperCase()] || 'unknown';
}

/**
 * Get Railway environment variables
 */
export async function getRailwayVariables(serviceId: string): Promise<Record<string, string>> {
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });

  if (!service || !service.externalId) {
    throw new Error('Service not found or not linked to Railway');
  }

  try {
    const query = `
      query GetVariables($serviceId: String!) {
        service(id: $serviceId) {
          variables {
            edges {
              node {
                name
                value
              }
            }
          }
        }
      }
    `;

    const data = await railwayGraphQLQuery(query, { serviceId: service.externalId });
    
    const vars: Record<string, string> = {};
    for (const edge of data.service.variables.edges) {
      vars[edge.node.name] = edge.node.value;
    }

    return vars;
  } catch (error) {
    console.error('Failed to get variables:', error);
    return {};
  }
}

// Export service functions
export const railwayService = {
  syncServices,
  getServiceMetrics,
  deployService,
  restartService,
  updateVariables,
  getLogs,
  scaleService,
  getRailwayServices,
  getRailwayVariables,
};

export default railwayService;
