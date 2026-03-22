/**
 * Incident Response & Safety End-to-End Tests
 * Tests kill switch, lockdown, forensics, escalation rules, and emergency notifications
 */
import { describe, expect, it } from '@jest/globals';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const BASE_URL = `${GATEWAY_URL}/v1/admin`;
const INCIDENTS_V1_BASE_URL = `${GATEWAY_URL}/v1`;
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';
const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || '').trim();
const ADMIN_COOKIE = String(process.env.ADMIN_COOKIE || '').trim();

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (ADMIN_TOKEN) headers.authorization = `Bearer ${ADMIN_TOKEN}`;
  if (ADMIN_COOKIE) headers.cookie = ADMIN_COOKIE;
  return headers;
}

function assertLiveAuthContextConfigured(): void {
  if (!RUN_LIVE_GATEWAY_E2E) return;
  if (ADMIN_TOKEN || ADMIN_COOKIE) return;
  throw new Error(
    'Incident live e2e requires explicit admin auth context via ADMIN_TOKEN or ADMIN_COOKIE',
  );
}

/**
 * Helper to make API requests
 */
async function apiCall(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const options: any = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  // Use built-in fetch (Node 18+)
  const response = await (fetch as any)(`${BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

async function apiCallIncidentsV1(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ status: number; data: any }> {
  const options: any = {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await (fetch as any)(`${INCIDENTS_V1_BASE_URL}${endpoint}`, options);
  const data = await response.json();

  return { status: response.status, data };
}

/**
 * Test: Get incident status
 */
async function testGetIncidentStatus(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/status');

    if (status !== 200) {
      throw new Error(`Failed to get incident status: ${JSON.stringify(data)}`);
    }

    if (!data.data) {
      throw new Error('No incident data in response');
    }

    if (data.data.status === undefined) {
      throw new Error('No status field in response');
    }

    return {
      name: 'Get Incident Status',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Incident Status',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Activate kill switch
 */
async function testActivateKillSwitch(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/kill-switch/activate', {
      reason: 'Test security incident',
      severity: 'critical',
    });

    if (status !== 201) {
      throw new Error(`Failed to activate kill switch: ${JSON.stringify(data)}`);
    }

    if (!data.data?.id) {
      throw new Error('No kill switch ID returned');
    }

    // Store for later use
    (global as any).killSwitchId = data.data.id;

    return {
      name: 'Activate Kill Switch',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Activate Kill Switch',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get kill switch status
 */
async function testGetKillSwitchStatus(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/kill-switch/status');

    if (status !== 200) {
      throw new Error(`Failed to get kill switch status: ${JSON.stringify(data)}`);
    }

    if (data.data.active !== true) {
      throw new Error('Kill switch should be active after activation');
    }

    return {
      name: 'Get Kill Switch Status',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Kill Switch Status',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Deactivate kill switch
 */
async function testDeactivateKillSwitch(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/kill-switch/deactivate');

    if (status !== 200) {
      throw new Error(`Failed to deactivate kill switch: ${JSON.stringify(data)}`);
    }

    if (!data.success) {
      throw new Error('Kill switch deactivation not successful');
    }

    return {
      name: 'Deactivate Kill Switch',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Deactivate Kill Switch',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Enable lockdown
 */
async function testEnableLockdown(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/lockdown/enable', {
      reason: 'Potential compromise detected',
      severity: 'high',
    });

    if (status !== 201) {
      throw new Error(`Failed to enable lockdown: ${JSON.stringify(data)}`);
    }

    if (!data.data?.id) {
      throw new Error('No lockdown ID returned');
    }

    // Store for later use
    (global as any).lockdownId = data.data.id;

    return {
      name: 'Enable Lockdown',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Enable Lockdown',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get lockdown status
 */
async function testGetLockdownStatus(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/lockdown/status');

    if (status !== 200) {
      throw new Error(`Failed to get lockdown status: ${JSON.stringify(data)}`);
    }

    if (data.data.active !== true) {
      throw new Error('Lockdown should be active');
    }

    return {
      name: 'Get Lockdown Status',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Lockdown Status',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Disable lockdown
 */
async function testDisableLockdown(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/lockdown/disable');

    if (status !== 200) {
      throw new Error(`Failed to disable lockdown: ${JSON.stringify(data)}`);
    }

    if (!data.success) {
      throw new Error('Lockdown disabling not successful');
    }

    return {
      name: 'Disable Lockdown',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Disable Lockdown',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Enable forensics
 */
async function testEnableForensics(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/forensics/enable', {
      reason: 'Investigation initiated',
      severity: 'critical',
    });

    if (status !== 201) {
      throw new Error(`Failed to enable forensics: ${JSON.stringify(data)}`);
    }

    if (!data.data?.id) {
      throw new Error('No forensics ID returned');
    }

    // Store for later use
    (global as any).forensicsId = data.data.id;

    return {
      name: 'Enable Forensics',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Enable Forensics',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get forensics status
 */
async function testGetForensicsStatus(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/forensics/status');

    if (status !== 200) {
      throw new Error(`Failed to get forensics status: ${JSON.stringify(data)}`);
    }

    if (data.data.active !== true) {
      throw new Error('Forensics should be active');
    }

    return {
      name: 'Get Forensics Status',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Forensics Status',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Disable forensics
 */
async function testDisableForensics(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/forensics/disable');

    if (status !== 200) {
      throw new Error(`Failed to disable forensics: ${JSON.stringify(data)}`);
    }

    if (!data.success) {
      throw new Error('Forensics disabling not successful');
    }

    return {
      name: 'Disable Forensics',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Disable Forensics',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Create escalation rule
 */
async function testCreateEscalationRule(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/escalation-rules', {
      name: 'Auto-deny old approvals',
      approvalAgeMinutes: 60,
      actionType: 'auto_deny',
    });

    if (status !== 201) {
      throw new Error(`Failed to create escalation rule: ${JSON.stringify(data)}`);
    }

    if (!data.data?.id) {
      throw new Error('No rule ID returned');
    }

    // Store for later use
    (global as any).escalationRuleId = data.data.id;

    return {
      name: 'Create Escalation Rule',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Create Escalation Rule',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get escalation rules
 */
async function testGetEscalationRules(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/escalation-rules');

    if (status !== 200) {
      throw new Error(`Failed to get escalation rules: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.data?.rules)) {
      throw new Error('Rules not an array');
    }

    return {
      name: 'Get Escalation Rules',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Escalation Rules',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Send emergency notification
 */
async function testSendEmergencyNotification(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('POST', '/incident/emergency-notify', {
      channel: 'discord',
      recipients: ['channel-id-123', 'admin-id-456'],
      title: 'Security Incident',
      message: 'A security incident has been detected. Kill switch activated.',
      severity: 'critical',
    });

    if (status !== 201) {
      throw new Error(`Failed to send emergency notification: ${JSON.stringify(data)}`);
    }

    if (!data.data?.notificationId) {
      throw new Error('No notification ID returned');
    }

    return {
      name: 'Send Emergency Notification',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Send Emergency Notification',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Get incident history
 */
async function testGetIncidentHistory(): Promise<TestResult> {
  const start = Date.now();
  try {
    const { status, data } = await apiCall('GET', '/incident/history?limit=50');

    if (status !== 200) {
      throw new Error(`Failed to get incident history: ${JSON.stringify(data)}`);
    }

    if (!Array.isArray(data.data?.history)) {
      throw new Error('History not an array');
    }

    return {
      name: 'Get Incident History',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Get Incident History',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  assertLiveAuthContextConfigured();
  console.log('\n🚀 Starting Incident Response & Safety E2E Tests\n');

  results.push(await testGetIncidentStatus());
  results.push(await testActivateKillSwitch());
  results.push(await testGetKillSwitchStatus());
  results.push(await testKillSwitchBlocksRepresentativeAdminWrite());
  results.push(await testDeactivateKillSwitch());
  results.push(await testKillSwitchWriteRecoveryAfterDeactivate());
  results.push(await testEnableLockdown());
  results.push(await testGetLockdownStatus());
  results.push(await testDisableLockdown());
  results.push(await testEnableForensics());
  results.push(await testGetForensicsStatus());
  results.push(await testDisableForensics());
  results.push(await testCreateEscalationRule());
  results.push(await testGetEscalationRules());
  results.push(await testSendEmergencyNotification());
  results.push(await testGetIncidentHistory());
  results.push(await testIncidentsV1ModePathParity());
  results.push(await testIncidentModeCrossPlaneConsistency());

  // Print results
  console.log('\n📊 Test Results:\n');
  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const status = result.passed ? '✅' : '❌';
    const message = result.error ? ` - ${result.error}` : '';
    console.log(`${status} ${result.name} (${result.duration}ms)${message}`);

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests\n`);

  if (failed > 0) {
    throw new Error(`Incident e2e failures: ${failed}`);
  }
}

/**
 * Test: Representative admin write path recovers once kill switch is deactivated
 */
async function testKillSwitchWriteRecoveryAfterDeactivate(): Promise<TestResult> {
  const start = Date.now();
  try {
    const recovered = await apiCall('PUT', '/email/config', {
      'gmail.sender_name': `Incident Recovery ${Date.now()}`,
    });

    if (recovered.status === 423) {
      throw new Error(
        `Write path still blocked after kill switch deactivation: ${JSON.stringify(recovered.data)}`,
      );
    }
    if (recovered.status !== 200) {
      throw new Error(
        `Expected 200 on representative admin write after kill switch deactivation, got ${recovered.status}: ${JSON.stringify(recovered.data)}`,
      );
    }

    return {
      name: 'Kill Switch Write Recovery After Deactivate',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Kill Switch Write Recovery After Deactivate',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: Kill switch blocks representative admin write path
 */
async function testKillSwitchBlocksRepresentativeAdminWrite(): Promise<TestResult> {
  const start = Date.now();
  try {
    const blocked = await apiCall('PUT', '/email/config', {
      'gmail.sender_name': `Incident Guard ${Date.now()}`,
    });

    if (blocked.status !== 423) {
      throw new Error(
        `Expected 423 INCIDENT_WRITE_BLOCKED while kill switch active, got ${blocked.status}: ${JSON.stringify(blocked.data)}`,
      );
    }

    if (blocked.data?.error?.code !== 'INCIDENT_WRITE_BLOCKED') {
      throw new Error(
        `Expected INCIDENT_WRITE_BLOCKED code while kill switch active: ${JSON.stringify(blocked.data)}`,
      );
    }

    return {
      name: 'Kill Switch Blocks Representative Admin Write',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Kill Switch Blocks Representative Admin Write',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: `/v1/incidents/*` writes the runtime incident mode path used by enforcement.
 */
async function testIncidentsV1ModePathParity(): Promise<TestResult> {
  const start = Date.now();
  try {
    const enableKill = await apiCallIncidentsV1('POST', '/incidents/kill-switch', { enabled: true });
    if (enableKill.status !== 200) {
      throw new Error(`Failed to enable v1 kill-switch mode: ${JSON.stringify(enableKill.data)}`);
    }
    const killStatus = await apiCallIncidentsV1('GET', '/incidents/status');
    if (killStatus.status !== 200 || killStatus.data?.data?.mode !== 'kill_switch') {
      throw new Error(`Unexpected v1 kill-switch status: ${JSON.stringify(killStatus.data)}`);
    }

    const disableKill = await apiCallIncidentsV1('POST', '/incidents/kill-switch', { enabled: false });
    if (disableKill.status !== 200) {
      throw new Error(`Failed to disable v1 kill-switch mode: ${JSON.stringify(disableKill.data)}`);
    }

    const enableLockdown = await apiCallIncidentsV1('POST', '/incidents/lockdown', { enabled: true });
    if (enableLockdown.status !== 200) {
      throw new Error(`Failed to enable v1 lockdown mode: ${JSON.stringify(enableLockdown.data)}`);
    }
    const lockdownStatus = await apiCallIncidentsV1('GET', '/incidents/status');
    if (lockdownStatus.status !== 200 || lockdownStatus.data?.data?.mode !== 'lockdown') {
      throw new Error(`Unexpected v1 lockdown status: ${JSON.stringify(lockdownStatus.data)}`);
    }

    const disableLockdown = await apiCallIncidentsV1('POST', '/incidents/lockdown', { enabled: false });
    if (disableLockdown.status !== 200) {
      throw new Error(`Failed to disable v1 lockdown mode: ${JSON.stringify(disableLockdown.data)}`);
    }

    const normalStatus = await apiCallIncidentsV1('GET', '/incidents/status');
    if (normalStatus.status !== 200 || normalStatus.data?.data?.mode !== 'normal') {
      throw new Error(`Unexpected v1 normal status: ${JSON.stringify(normalStatus.data)}`);
    }

    return {
      name: 'Incidents V1 Mode Path Parity',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Incidents V1 Mode Path Parity',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

/**
 * Test: admin incident controls and `/v1/incidents/status` stay in sync on shared global mode source.
 */
async function testIncidentModeCrossPlaneConsistency(): Promise<TestResult> {
  const start = Date.now();
  try {
    const activateKill = await apiCall('POST', '/incident/kill-switch/activate', {
      reason: 'Cross-plane consistency check',
      severity: 'critical',
    });
    if (activateKill.status !== 201) {
      throw new Error(`Failed to activate admin kill-switch: ${JSON.stringify(activateKill.data)}`);
    }

    const v1KillStatus = await apiCallIncidentsV1('GET', '/incidents/status');
    if (v1KillStatus.status !== 200 || v1KillStatus.data?.data?.mode !== 'kill_switch') {
      throw new Error(`Unexpected v1 mode after admin kill-switch: ${JSON.stringify(v1KillStatus.data)}`);
    }

    const deactivateKill = await apiCall('POST', '/incident/kill-switch/deactivate');
    if (deactivateKill.status !== 200) {
      throw new Error(`Failed to deactivate admin kill-switch: ${JSON.stringify(deactivateKill.data)}`);
    }

    const enableForensicsV1 = await apiCallIncidentsV1('POST', '/incidents/forensics', { enabled: true });
    if (enableForensicsV1.status !== 200) {
      throw new Error(`Failed to enable v1 forensics mode: ${JSON.stringify(enableForensicsV1.data)}`);
    }

    const adminForensicsStatus = await apiCall('GET', '/incident/forensics/status');
    if (adminForensicsStatus.status !== 200 || adminForensicsStatus.data?.data?.active !== true) {
      throw new Error(
        `Unexpected admin forensics status after v1 write: ${JSON.stringify(adminForensicsStatus.data)}`,
      );
    }

    const disableForensicsV1 = await apiCallIncidentsV1('POST', '/incidents/forensics', { enabled: false });
    if (disableForensicsV1.status !== 200) {
      throw new Error(`Failed to disable v1 forensics mode: ${JSON.stringify(disableForensicsV1.data)}`);
    }

    const v1NormalStatus = await apiCallIncidentsV1('GET', '/incidents/status');
    if (v1NormalStatus.status !== 200 || v1NormalStatus.data?.data?.mode !== 'normal') {
      throw new Error(`Unexpected v1 normal mode after disable: ${JSON.stringify(v1NormalStatus.data)}`);
    }

    return {
      name: 'Incident Mode Cross-Plane Consistency',
      passed: true,
      duration: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'Incident Mode Cross-Plane Consistency',
      passed: false,
      duration: Date.now() - start,
      error: (error as Error).message,
    };
  }
}

describe('Incident Response E2E', () => {
  it('offline guard', () => {
    expect(BASE_URL.includes('/v1/admin')).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('runs incident response workflow', async () => {
    await runAllTests();
    expect(results.length).toBeGreaterThan(0);
  }, 180000);
});

if (!process.env.JEST_WORKER_ID) {
  runAllTests().catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
}
