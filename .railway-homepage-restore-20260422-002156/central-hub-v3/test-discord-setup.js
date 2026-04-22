#!/usr/bin/env node

/**
 * Discord Setup Advisor - Example Test Scenario
 * 
 * This script demonstrates the full setup workflow:
 * 1. Generate a setup plan for a Discord server
 * 2. Review and approve the plan  
 * 3. Execute the plan (create roles and channels)
 * 4. Check status and rollback if needed
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const JWT_TOKEN = process.env.JWT_TOKEN || 'your-jwt-token-here';

interface SetupRequest {
  guildId: string;
  userPrompt: string;
  templateId?: string;
}

interface SetupPlan {
  id: string;
  templateId: string;
  steps: Array<{ order: number; type: string; description: string }>;
  summary: string;
}

/**
 * Make authenticated API call
 */
async function apiCall<T>(method: string, path: string, body?: any): Promise<T> {
  const url = `${API_BASE}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${JWT_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data.data || data;
}

/**
 * Step 1: List available templates
 */
async function listTemplates() {
  console.log('\n[1/5] Listing available templates...');
  try {
    const response = await fetch(`${API_BASE}/api/discord/setup/templates`);
    const data = await response.json();
    
    console.log(`[OK] Found ${data.data.length} templates:`);
    data.data.forEach((template: any) => {
      console.log(`  ${template.emoji} ${template.name} - ${template.description}`);
      console.log(`     ${template.roles} roles, ${template.channels} channels`);
    });
    
    return data.data;
  } catch (error) {
    console.error('[ERROR] Failed to list templates:', error);
    throw error;
  }
}

/**
 * Step 2: Generate a setup plan
 */
async function generatePlan(guildId: string, templateId: string): Promise<SetupPlan> {
  console.log('\n[2/5] Generating setup plan...');
  try {
    const request: SetupRequest = {
      guildId,
      userPrompt: 'Setup a standard community server with moderation',
      templateId,
    };

    const plan = await apiCall<SetupPlan>('POST', '/api/discord/setup/generate-plan', request);
    
    console.log(`[OK] Plan generated (ID: ${plan.id})`);
    console.log(`[INFO] Summary: ${plan.summary}`);
    console.log(`[INFO] Steps: ${plan.steps.length}`);
    plan.steps.forEach((step) => {
      console.log(`   ${step.order + 1}. [${step.type}] ${step.description}`);
    });
    
    return plan;
  } catch (error) {
    console.error('[ERROR] Failed to generate plan:', error);
    throw error;
  }
}

/**
 * Step 3: Review and approve plan
 */
async function approvePlan(setupRunId: string): Promise<void> {
  console.log('\n[3/5] Approving plan...');
  try {
    const result = await apiCall('POST', `/api/discord/setup/${setupRunId}/approve`);
    
    console.log('[OK] Plan approved');
    console.log(`   Status: ${result.data.status}`);
    console.log(`   Progress: ${result.data.progress}%`);
  } catch (error) {
    console.error('[ERROR] Failed to approve plan:', error);
    throw error;
  }
}

/**
 * Step 4: Execute the plan
 */
async function executePlan(setupRunId: string): Promise<void> {
  console.log('\n[4/5] Executing plan (this may take a moment)...');
  try {
    const result = await apiCall('POST', `/api/discord/setup/${setupRunId}/execute-all`);
    
    if (result.success) {
      console.log('[OK] Plan executed successfully!');
    } else {
      console.log('[WARN] Plan execution completed with warnings');
    }
    
    console.log(`   Progress: ${result.data.progress}%`);
    console.log(`   Completed steps: ${result.data.completedSteps}/${result.data.totalSteps}`);
    
    if (result.data.results) {
      result.data.results.forEach((stepResult: any, index: number) => {
        if (stepResult.success) {
          console.log(`   [OK] Step ${index + 1}: Success`);
        } else {
          console.log(`   [ERROR] Step ${index + 1}: Failed - ${stepResult.error}`);
        }
      });
    }
  } catch (error) {
    console.error('[ERROR] Failed to execute plan:', error);
    throw error;
  }
}

/**
 * Step 5: Check status
 */
async function checkStatus(setupRunId: string): Promise<void> {
  console.log('\n[5/5] Checking final status...');
  try {
    const status = await apiCall('GET', `/api/discord/setup/${setupRunId}`);
    
    console.log('[OK] Setup status retrieved');
    console.log(`   Status: ${status.status}`);
    console.log(`   Progress: ${status.progress}%`);
    console.log(`   Created at: ${status.createdAt}`);
    if (status.completedAt) {
      console.log(`   Completed at: ${status.completedAt}`);
    }
  } catch (error) {
    console.error('[ERROR] Failed to check status:', error);
    throw error;
  }
}

/**
 * Main test scenario
 */
async function main() {
  console.log('Discord Setup Advisor - Test Scenario');
  console.log('========================================\n');
  console.log(`API Base: ${API_BASE}`);
  console.log(`JWT Token: ${JWT_TOKEN.substring(0, 20)}...`);

  // Example guild ID (replace with your test server)
  const GUILD_ID = process.env.DISCORD_GUILD_ID || '123456789012345678';
  
  console.log(`\nTesting with Guild ID: ${GUILD_ID}`);

  try {
    // Step 1: List templates
    const templates = await listTemplates();
    
    // Step 2: Generate plan using first template
    const templateId = templates[0]?.id || 'community';
    const plan = await generatePlan(GUILD_ID, templateId);
    
    // Step 3: Approve the plan
    await approvePlan(plan.id);
    
    // Give the API a moment to process the approval
    await new Promise(r => setTimeout(r, 1000));
    
    // Step 4: Execute the plan
    await executePlan(plan.id);
    
    // Step 5: Check status
    await checkStatus(plan.id);
    
    console.log('\n[OK] Setup advisor test completed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n[ERROR] Test failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { listTemplates, generatePlan, approvePlan, executePlan, checkStatus };
