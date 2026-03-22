/**
 * Backups & Disaster Recovery End-to-End Tests
 * Tests backup scheduling, restore operations, snapshots, archives, and DR drills
 */
import { describe, expect, it } from '@jest/globals';

const BASE_URL = `${process.env.GATEWAY_URL || 'http://localhost:3000'}/v1/admin`;
const DEFAULT_CONFIG_ID = 'default-daily-backup';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

const results: TestResult[] = [];

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
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error('API call failed:', error);
    return { status: 0, data: null };
  }
}

async function apiCallRaw(
  method: string,
  endpoint: string,
  body?: any
): Promise<{ status: number; data: ArrayBuffer | null; headers: Headers }> {
  const options: any = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.arrayBuffer();
    return { status: response.status, data, headers: response.headers };
  } catch (error) {
    console.error('API call failed:', error);
    return { status: 0, data: null, headers: new Headers() };
  }
}

/**
 * Run a single test
 */
async function runTest(
  name: string,
  testFn: () => Promise<void>
): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    results.push({
      name,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`✗ ${name} (${duration}ms): ${error}`);
  }
}

// ============== TESTS ==============

async function testBackupStartAndStatus(): Promise<void> {
  const response = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (response.status !== 200 || !response.data?.backup?.id) {
    throw new Error('Failed to start backup');
  }

  const backupId = response.data.backup.id;
  await new Promise((r) => setTimeout(r, 500));

  const statusResponse = await apiCall('GET', `/backup/${backupId}`);
  if (statusResponse.status !== 200) {
    throw new Error('Failed to get backup status');
  }
}

async function testListBackups(): Promise<void> {
  // Start a backup first
  const response = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (response.status !== 200) {
    throw new Error('Failed to start backup');
  }

  await new Promise((r) => setTimeout(r, 500));

  const listResponse = await apiCall('GET', '/backups?limit=50');
  if (listResponse.status !== 200 || !Array.isArray(listResponse.data?.backups)) {
    throw new Error('Failed to list backups');
  }
}

async function testVerifyBackup(): Promise<void> {
  const response = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (response.status !== 200) {
    throw new Error('Failed to start backup');
  }

  const backupId = response.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const verifyResponse = await apiCall('POST', `/backup/${backupId}/verify`);
  if (verifyResponse.status !== 200) {
    throw new Error('Failed to verify backup');
  }
}

async function testCreateSnapshot(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (startResponse.status !== 200) {
    throw new Error('Failed to start backup');
  }

  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const snapshotResponse = await apiCall('POST', '/snapshot', {
    backupJobId: backupId,
    description: 'Test snapshot',
    tags: ['test', 'e2e'],
  });

  if (snapshotResponse.status !== 200 || !snapshotResponse.data?.snapshot?.id) {
    throw new Error('Failed to create snapshot');
  }
}

async function testArchiveBackup(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (startResponse.status !== 200) {
    throw new Error('Failed to start backup');
  }

  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const archiveResponse = await apiCall('POST', '/archive', {
    backupJobId: backupId,
    complianceCategory: 'audit',
    retentionYears: 7,
  });

  if (archiveResponse.status !== 200 || !archiveResponse.data?.archive?.id) {
    throw new Error('Failed to archive backup');
  }
}

async function testListRestorePoints(): Promise<void> {
  const response = await apiCall('GET', '/restore-points?limit=50');
  if (response.status !== 200 || !Array.isArray(response.data?.restorePoints)) {
    throw new Error('Failed to list restore points');
  }
}

async function testInitiateRestore(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (startResponse.status !== 200) {
    throw new Error('Failed to start backup');
  }

  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const restoreResponse = await apiCall('POST', '/restore', {
    backupJobId: backupId,
    targetEnvironment: 'staging',
    reason: 'E2E test',
    userId: 'test-user',
  });

  if (restoreResponse.status !== 200 || !restoreResponse.data?.restore?.id) {
    throw new Error('Failed to initiate restore');
  }
}

async function testGetRestoreStatus(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const restoreResponse = await apiCall('POST', '/restore', {
    backupJobId: backupId,
    targetEnvironment: 'staging',
    reason: 'Test',
  });

  const restoreId = restoreResponse.data.restore.id;
  const statusResponse = await apiCall('GET', `/restore/${restoreId}`);

  if (statusResponse.status !== 200) {
    throw new Error('Failed to get restore status');
  }
}

async function testCalculateRPOMetrics(): Promise<void> {
  const response = await apiCall('GET', '/metrics/rpo');
  if (response.status !== 200 || !response.data?.metrics?.targetRPO) {
    throw new Error('Failed to calculate RPO metrics');
  }
}

async function testCalculateRTOMetrics(): Promise<void> {
  const response = await apiCall('GET', '/metrics/rto');
  if (response.status !== 200 || !response.data?.metrics?.targetRTO) {
    throw new Error('Failed to calculate RTO metrics');
  }
}

async function testGetRestoreStatistics(): Promise<void> {
  const response = await apiCall('GET', '/metrics/restore-stats');
  if (response.status !== 200 || response.data?.stats === undefined) {
    throw new Error('Failed to get restore statistics');
  }
}

async function testGenerateHealthReport(): Promise<void> {
  const response = await apiCall('GET', '/health-report');
  if (response.status !== 200 || !response.data?.report?.overallHealth) {
    throw new Error('Failed to generate health report');
  }
}

async function testGetRestoreProcedure(): Promise<void> {
  const response = await apiCall('GET', '/procedure/restore');
  if (response.status !== 200 || !response.data?.procedure) {
    throw new Error('Failed to get restore procedure');
  }
}

async function testGetSafeRestoreProcedure(): Promise<void> {
  const response = await apiCall('GET', '/procedure/restore-safe');
  if (response.status !== 200 || !response.data?.procedure) {
    throw new Error('Failed to get safe restore procedure');
  }
}

async function testScheduleDRDrill(): Promise<void> {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const response = await apiCall('POST', '/dr-drill', {
    name: 'Q1 DR Drill',
    description: 'Quarterly DR drill',
    scope: 'full_restore',
    affectedSystems: ['database', 'cache'],
    scheduledDate: futureDate.toISOString(),
  });

  if (response.status !== 200 || !response.data?.drill?.id) {
    throw new Error('Failed to schedule DR drill');
  }
}

async function testStartDRDrill(): Promise<void> {
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const scheduleResponse = await apiCall('POST', '/dr-drill', {
    name: 'Q1 DR Drill',
    description: 'Test',
    scope: 'full_restore',
    affectedSystems: ['database'],
    scheduledDate: futureDate.toISOString(),
  });

  const drillId = scheduleResponse.data.drill.id;

  const startResponse = await apiCall('POST', `/dr-drill/${drillId}/start`, {
    leadPerson: 'test-dba@example.com',
  });

  if (startResponse.status !== 200) {
    throw new Error('Failed to start DR drill');
  }
}

async function testPartialRestore(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const restoreResponse = await apiCall('POST', '/restore-partial', {
    backupJobId: backupId,
    tablesToRestore: ['users', 'chats'],
    targetEnvironment: 'staging',
    userId: 'test-user',
  });

  if (restoreResponse.status !== 200 || restoreResponse.data?.result?.tablesQueued !== 2) {
    throw new Error('Failed to initiate partial restore');
  }
}

async function testListBackupConfigs(): Promise<void> {
  const response = await apiCall('GET', '/backup/configs');
  if (response.status !== 200 || !Array.isArray(response.data?.configs)) {
    throw new Error('Failed to list backup configs');
  }
}

async function testUpdateBackupConfig(): Promise<void> {
  const updateResponse = await apiCall('PUT', `/backup/configs/${DEFAULT_CONFIG_ID}`, {
    scheduleCron: '0 2 * * *',
    enabled: true,
  });
  if (updateResponse.status !== 200 || updateResponse.data?.updated !== true) {
    throw new Error('Failed to update backup config');
  }
}

async function testDownloadAndUploadBackup(): Promise<void> {
  const startResponse = await apiCall('POST', '/backup/start', { configId: DEFAULT_CONFIG_ID });
  if (startResponse.status !== 200) {
    throw new Error('Failed to start backup');
  }
  const backupId = startResponse.data.backup.id;
  await new Promise((r) => setTimeout(r, 2500));

  const download = await apiCallRaw('GET', `/backup/${backupId}/download`);
  if (download.status !== 200 || !download.data) {
    throw new Error('Failed to download backup');
  }

  const base64 = Buffer.from(download.data).toString('base64');
  const uploadResponse = await apiCall('POST', '/backup/upload', {
    fileName: `uploaded-${backupId}.tar.gz`,
    contentBase64: base64,
  });
  if (uploadResponse.status !== 200 || !uploadResponse.data?.backup?.id) {
    throw new Error('Failed to upload backup');
  }
}

// ============== MAIN TEST RUNNER ==============

async function runAllTests(): Promise<void> {
  console.log('Starting Backups & Disaster Recovery E2E Tests...\n');

  // Backup tests
  await runTest('testBackupStartAndStatus', testBackupStartAndStatus);
  await runTest('testListBackups', testListBackups);
  await runTest('testVerifyBackup', testVerifyBackup);
  await runTest('testListBackupConfigs', testListBackupConfigs);
  await runTest('testUpdateBackupConfig', testUpdateBackupConfig);

  // Snapshot tests
  await runTest('testCreateSnapshot', testCreateSnapshot);

  // Archive tests
  await runTest('testArchiveBackup', testArchiveBackup);

  // Restore tests
  await runTest('testListRestorePoints', testListRestorePoints);
  await runTest('testInitiateRestore', testInitiateRestore);
  await runTest('testGetRestoreStatus', testGetRestoreStatus);

  // Metrics tests
  await runTest('testCalculateRPOMetrics', testCalculateRPOMetrics);
  await runTest('testCalculateRTOMetrics', testCalculateRTOMetrics);
  await runTest('testGetRestoreStatistics', testGetRestoreStatistics);

  // Reporting tests
  await runTest('testGenerateHealthReport', testGenerateHealthReport);
  await runTest('testGetRestoreProcedure', testGetRestoreProcedure);
  await runTest('testGetSafeRestoreProcedure', testGetSafeRestoreProcedure);

  // DR drill tests
  await runTest('testScheduleDRDrill', testScheduleDRDrill);
  await runTest('testStartDRDrill', testStartDRDrill);

  // Advanced features
  await runTest('testDownloadAndUploadBackup', testDownloadAndUploadBackup);
  await runTest('testPartialRestore', testPartialRestore);

  // Print summary
  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`Test Results: ${passed}/${total} passed`);

  results.forEach((r) => {
    const status = r.passed ? '✓' : '✗';
    console.log(`${status} ${r.name} (${r.duration}ms)${r.error ? ': ' + r.error : ''}`);
  });

  console.log('='.repeat(60));
}

describe('Backups & DR E2E', () => {
  it('offline guard', () => {
    expect(BASE_URL.includes('/v1/admin')).toBe(true);
    expect(DEFAULT_CONFIG_ID).toBe('default-daily-backup');
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('runs backup + disaster recovery workflow', async () => {
    await runAllTests();
    const failed = results.filter((r) => !r.passed);
    expect(failed).toHaveLength(0);
  }, 300000);
});

if (!process.env.JEST_WORKER_ID) {
  runAllTests().catch(console.error);
}
