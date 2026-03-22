#!/usr/bin/env node
/**
 * End-to-End Workflow System Test
 * Tests the full workflow lifecycle: create → execute → monitor
 */

const BASE_URL = 'http://localhost:3000/v1/admin';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-token';

async function request(method, path, body = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ADMIN_TOKEN}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  console.log(`[${method}] ${path}`);
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error(`❌ Error: ${response.status}`, data);
    throw new Error(`API Error: ${response.status}`);
  }

  console.log(`✅ ${response.status}`, data.success ? 'Success' : 'Response');
  return data.data || data;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2ETest() {
  console.log('\n🚀 Starting Workflow E2E Test...\n');

  try {
    // Step 1: Create a test workflow
    console.log('📝 Creating test workflow...');
    const createResponse = await request('POST', '/workflows', {
      chat_id: 'chat_test_001',
      name: 'E2E Test Workflow',
      description: 'Automated end-to-end test workflow',
      steps: [
        {
          id: 'step_1',
          type: 'tool_call',
          config: {
            tool_name: 'test_tool',
            params: {
              input: 'Hello from E2E test',
            },
          },
        },
        {
          id: 'step_2',
          type: 'approval',
          config: {
            title: 'Approve test result',
            description: 'Please approve this test step',
          },
        },
      ],
      edges: [
        { from: 'step_1', to: 'step_2' },
      ],
      is_draft: false,
    });

    const workflowId = createResponse.id;
    console.log(`✅ Workflow created: ${workflowId}\n`);

    // Step 2: Retrieve the workflow
    console.log('🔍 Fetching workflow details...');
    const workflowDetails = await request('GET', `/workflows/${workflowId}`);
    console.log(`✅ Workflow version: ${workflowDetails.version}\n`);

    // Step 3: Execute the workflow
    console.log('▶️  Executing workflow...');
    const executeResponse = await request('POST', `/workflows/${workflowId}/execute`, {
      input_variables: {
        test_input: 'e2e_test_value',
      },
    });

    const runId = executeResponse.run_id;
    console.log(`✅ Workflow execution started: ${runId}\n`);

    // Step 4: Poll for run status
    console.log('⏳ Monitoring workflow execution...');
    let runDetails = null;
    let attempts = 0;
    const maxAttempts = 20; // 20 attempts * 0.5s = 10 seconds max

    while (attempts < maxAttempts) {
      runDetails = await request('GET', `/workflow-runs/${runId}`);
      
      console.log(`   Status: ${runDetails.status}`);
      if (runDetails.steps) {
        console.log(`   Steps completed: ${runDetails.steps.filter(s => s.status === 'completed').length}/${runDetails.steps.length}`);
      }

      if (['completed', 'failed', 'cancelled'].includes(runDetails.status)) {
        break;
      }

      attempts++;
      if (attempts < maxAttempts) {
        await sleep(500);
      }
    }

    console.log(`✅ Workflow execution finished: ${runDetails.status}\n`);

    // Step 5: Verify results
    console.log('📊 Execution Summary:');
    console.log(`   Run ID: ${runDetails.id}`);
    console.log(`   Status: ${runDetails.status}`);
    console.log(`   Started: ${runDetails.started_at || 'N/A'}`);
    console.log(`   Completed: ${runDetails.completed_at || 'N/A'}`);
    
    if (runDetails.steps) {
      console.log(`\n   Step Details:`);
      runDetails.steps.forEach((step, idx) => {
        console.log(`   [${idx + 1}] ${step.step_id}`);
        console.log(`       Status: ${step.status}`);
        console.log(`       Attempts: ${step.attempt_number}`);
        if (step.error_message) {
          console.log(`       Error: ${step.error_message}`);
        }
      });
    }

    // Step 6: Test pause/resume
    console.log('\n⏸️  Testing pause/resume...');
    
    // Create another run to test pause
    const pauseTestResponse = await request('POST', `/workflows/${workflowId}/execute`, {
      input_variables: { test_type: 'pause_resume' },
    });
    const pauseRunId = pauseTestResponse.run_id;

    // Pause immediately
    await request('POST', `/workflow-runs/${pauseRunId}/pause`, {});
    console.log(`✅ Run paused: ${pauseRunId}`);

    // Resume
    await request('POST', `/workflow-runs/${pauseRunId}/resume`, {});
    console.log(`✅ Run resumed: ${pauseRunId}\n`);

    // Step 7: Test cancel
    console.log('🛑 Testing cancel...');
    const cancelTestResponse = await request('POST', `/workflows/${workflowId}/execute`, {
      input_variables: { test_type: 'cancel' },
    });
    const cancelRunId = cancelTestResponse.run_id;

    await request('POST', `/workflow-runs/${cancelRunId}/cancel`, {});
    const cancelledRun = await request('GET', `/workflow-runs/${cancelRunId}`);
    console.log(`✅ Run cancelled: ${cancelledRun.status}\n`);

    // Step 8: List runs
    console.log('📋 Listing workflow runs...');
    const runsList = await request('GET', `/workflow-runs?workflow_id=${workflowId}&limit=10`);
    console.log(`✅ Found ${runsList.length} runs\n`);

    console.log('✅ All E2E tests passed!\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ E2E Test Failed:', error.message);
    process.exit(1);
  }
}

runE2ETest();
