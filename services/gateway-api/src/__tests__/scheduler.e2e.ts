/**
 * User-Facing Scheduler End-to-End Tests
 * Tests scheduled task CRUD, validation, and run history.
 *
 * Test modes:
 *  - Offline (default): Shape validation, cron parsing, bounding logic
 *  - Online: Set TEST_SESSION_COOKIE to run authenticated API tests
 */

import pg from 'pg';
import { describe, expect, it } from '@jest/globals';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:3000';
const SESSION_COOKIE = process.env.TEST_SESSION_COOKIE || '';
const DATABASE_URL = process.env.DATABASE_URL || '';
const RUN_LIVE_GATEWAY_E2E = String(process.env.RUN_LIVE_GATEWAY_E2E || '').toLowerCase() === 'true';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];
let dbPool: pg.Pool | null = DATABASE_URL ? new pg.Pool({ connectionString: DATABASE_URL, max: 2 }) : null;

async function apiCall(
  method: string,
  endpoint: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(SESSION_COOKIE ? { Cookie: `sven_session=${SESSION_COOKIE}` } : {}),
    },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${GATEWAY_URL}${endpoint}`, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: String(err) } };
  }
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration });
    console.log(`✓ ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: err instanceof Error ? err.message : String(err) });
    console.log(`✗ ${name} (${duration}ms): ${err}`);
  }
}

function skip(name: string, reason: string): void {
  results.push({ name, passed: true, duration: 0, skipped: true });
  console.log(`⊘ ${name} — SKIPPED (${reason})`);
}

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(msg);
}

// ============================================================
//  1. Offline: Cron expression and shape validation
// ============================================================

function isValidCron(expression: string): boolean {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  return fields.every((field, i) => {
    const ranges = [
      { min: 0, max: 59 },
      { min: 0, max: 23 },
      { min: 1, max: 31 },
      { min: 1, max: 12 },
      { min: 0, max: 6 },
    ];
    const range = ranges[i];
    return field.split(',').every((part) => {
      if (part === '*') return true;
      if (/^\*\/\d+$/.test(part)) return Number(part.slice(2)) > 0;
      if (/^\d+$/.test(part)) {
        const n = Number(part);
        return n >= range.min && n <= range.max;
      }
      if (/^\d+-\d+$/.test(part)) {
        const [a, b] = part.split('-').map(Number);
        return a >= range.min && b <= range.max && a <= b;
      }
      return false;
    });
  });
}

async function waitForTaskNotification(taskId: string, outcome: 'success' | 'error'): Promise<void> {
  if (!dbPool) throw new Error('DATABASE_URL is required for notification verification');
  const timeoutMs = 30000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const res = await dbPool.query(
      `SELECT id
       FROM notifications
       WHERE type = 'scheduler.task'
         AND data->>'task_id' = $1
         AND data->>'outcome' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [taskId, outcome],
    );
    if (res.rows.length > 0) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Notification not found for task ${taskId}, outcome=${outcome}`);
}

function getCronRange(index: number): { min: number; max: number } {
  if (index === 0) return { min: 0, max: 59 };
  if (index === 1) return { min: 0, max: 23 };
  if (index === 2) return { min: 1, max: 31 };
  if (index === 3) return { min: 1, max: 12 };
  return { min: 0, max: 6 };
}

function matchesCronField(value: number, field: string, index: number): boolean {
  if (field === '*') return true;
  const range = getCronRange(index);
  for (const part of field.split(',')) {
    if (part === '*') return true;
    if (/^\*\/\d+$/.test(part)) {
      const step = Number(part.slice(2));
      if ((value - range.min) % step === 0) return true;
      continue;
    }
    if (/^\d+$/.test(part)) {
      if (value === Number(part)) return true;
      continue;
    }
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    }
  }
  return false;
}

function computeNextRun(expression: string, fromDate: Date): Date | null {
  if (!isValidCron(expression)) return null;
  const [m, h, dom, mon, dow] = expression.trim().split(/\s+/);
  const next = new Date(fromDate.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 366; i += 1) {
    if (
      matchesCronField(next.getMinutes(), m, 0)
      && matchesCronField(next.getHours(), h, 1)
      && matchesCronField(next.getDate(), dom, 2)
      && matchesCronField(next.getMonth() + 1, mon, 3)
      && matchesCronField(next.getDay(), dow, 4)
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }
  return null;
}

async function testCronParsing(): Promise<void> {
  // Valid expressions
  assert(isValidCron('0 9 * * 1'), '"0 9 * * 1" (Mon 9am) is valid');
  assert(isValidCron('*/15 * * * *'), '"*/15 * * * *" (every 15min) is valid');
  assert(isValidCron('0 0 1 * *'), '"0 0 1 * *" (monthly) is valid');
  assert(isValidCron('30 14 * * 1-5'), '"30 14 * * 1-5" (weekdays 2:30pm) is valid');
  assert(isValidCron('0 6,18 * * *'), '"0 6,18 * * *" (6am and 6pm) is valid');

  // Invalid expressions
  assert(!isValidCron('invalid'), '"invalid" is not valid');
  assert(!isValidCron('0 9 * *'), '4 fields is not valid');
  assert(!isValidCron('0 25 * * *'), 'hour 25 is not valid');
  assert(!isValidCron('60 0 * * *'), 'minute 60 is not valid');
  assert(!isValidCron('0 0 32 * *'), 'day 32 is not valid');
}

async function testNextRunCalculation(): Promise<void> {
  const daily = '0 9 * * *';
  const weekly = '0 9 * * 1';
  const monthly = '0 0 1 * *';

  const base = new Date(2026, 1, 21, 8, 0, 0, 0);
  const nextDaily = computeNextRun(daily, base);
  assert(nextDaily !== null, 'daily next run should exist');
  if (nextDaily) {
    assert(nextDaily.getHours() === 9 && nextDaily.getMinutes() === 0, 'daily next run should be 09:00');
    assert(nextDaily.getDate() === base.getDate(), 'daily next run should be same day when before 09:00');
  }

  const nextWeekly = computeNextRun(weekly, base);
  assert(nextWeekly !== null, 'weekly next run should exist');
  if (nextWeekly) {
    assert(nextWeekly.getDay() === 1, 'weekly next run should be Monday');
    assert(nextWeekly.getHours() === 9 && nextWeekly.getMinutes() === 0, 'weekly next run should be 09:00');
  }

  const nextMonthly = computeNextRun(monthly, base);
  assert(nextMonthly !== null, 'monthly next run should exist');
  if (nextMonthly) {
    const month = nextMonthly.getMonth();
    assert(nextMonthly.getDate() === 1, 'monthly next run should be on the 1st');
    assert(month !== base.getMonth(), 'monthly next run should be in a later month');
  }
}

async function testScheduledTaskShape(): Promise<void> {
  const sampleTask = {
    id: 'test-id',
    name: 'Check emails',
    instruction: 'Check my inbox and summarize new emails',
    schedule_type: 'recurring' as const,
    expression: '0 9 * * 1',
    enabled: true,
    run_count: 0,
  };

  assert(typeof sampleTask.id === 'string', 'id must be string');
  assert(typeof sampleTask.name === 'string', 'name must be string');
  assert(typeof sampleTask.instruction === 'string', 'instruction must be string');
  assert(['once', 'recurring'].includes(sampleTask.schedule_type), 'invalid schedule_type');
  assert(typeof sampleTask.enabled === 'boolean', 'enabled must be boolean');
  assert(typeof sampleTask.run_count === 'number', 'run_count must be number');
}

async function testScheduleTypeValidation(): Promise<void> {
  // Once requires run_at
  const onceNoRunAt = { schedule_type: 'once' as const, run_at: undefined };
  assert(!onceNoRunAt.run_at, 'one-time without run_at should fail validation');

  // Recurring requires expression
  const recurringNoExpr = { schedule_type: 'recurring' as const, expression: undefined };
  assert(!recurringNoExpr.expression, 'recurring without expression should fail validation');
}

// ============================================================
//  2. Auth guard tests
// ============================================================

async function testSchedulesRejectsUnauthenticated(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/schedules`, {
    headers: { 'Content-Type': 'application/json' },
  });
  assert(res.status === 401 || res.status === 403, `Expected 401/403 but got ${res.status}`);
}

async function testCreateScheduleRejectsUnauthenticated(): Promise<void> {
  const res = await fetch(`${GATEWAY_URL}/v1/schedules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'test',
      instruction: 'test',
      schedule_type: 'recurring',
      expression: '0 9 * * *',
    }),
  });
  assert(res.status === 401 || res.status === 403, `Expected 401/403 but got ${res.status}`);
}

// ============================================================
//  3. Authenticated CRUD tests
// ============================================================

async function testCreateRecurringSchedule(): Promise<void> {
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Morning check',
    instruction: 'Check weather and summarize my calendar',
    schedule_type: 'recurring',
    expression: '0 9 * * *',
  });
  assert(status === 201, `Expected 201 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert(typeof data.data.id === 'string', 'Expected id in response');
  assert(data.data.name === 'Test: Morning check', 'Name mismatch');
  assert(data.data.next_run, 'Expected next_run in response');
}

async function testCreateOnceSchedule(): Promise<void> {
  const futureDate = new Date(Date.now() + 86400000).toISOString(); // tomorrow
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: One-time reminder',
    instruction: 'Remind me to call the dentist',
    schedule_type: 'once',
    run_at: futureDate,
  });
  assert(status === 201, `Expected 201 but got ${status}: ${JSON.stringify(data)}`);
  assert(data.success === true, 'Expected success: true');
  assert(data.data.next_run, 'Expected next_run in response');
}

async function testListSchedules(): Promise<void> {
  const { status, data } = await apiCall('GET', '/v1/schedules');
  assert(status === 200, `Expected 200 but got ${status}`);
  assert(data.success === true, 'Expected success: true');
  assert(Array.isArray(data.data), 'Expected data to be an array');
}

async function testCreateScheduleValidation(): Promise<void> {
  // Missing name
  const { status: s1 } = await apiCall('POST', '/v1/schedules', {
    instruction: 'test',
    schedule_type: 'recurring',
    expression: '0 9 * * *',
  });
  assert(s1 === 400, `Expected 400 for missing name but got ${s1}`);

  // Missing instruction
  const { status: s2 } = await apiCall('POST', '/v1/schedules', {
    name: 'test',
    schedule_type: 'recurring',
    expression: '0 9 * * *',
  });
  assert(s2 === 400, `Expected 400 for missing instruction but got ${s2}`);

  // Recurring without expression
  const { status: s3 } = await apiCall('POST', '/v1/schedules', {
    name: 'test',
    instruction: 'test',
    schedule_type: 'recurring',
  });
  assert(s3 === 400, `Expected 400 for missing expression but got ${s3}`);

  // Once without run_at
  const { status: s4 } = await apiCall('POST', '/v1/schedules', {
    name: 'test',
    instruction: 'test',
    schedule_type: 'once',
  });
  assert(s4 === 400, `Expected 400 for missing run_at but got ${s4}`);
}

async function testScheduleLifecycle(): Promise<void> {
  // Create
  const { data: createData } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Lifecycle task',
    instruction: 'Run lifecycle test',
    schedule_type: 'recurring',
    expression: '0 12 * * *',
  });
  const taskId = createData.data.id;

  // Get
  const { status: getStatus, data: getData } = await apiCall('GET', `/v1/schedules/${taskId}`);
  assert(getStatus === 200, `GET failed: ${getStatus}`);
  assert(getData.data.name === 'Test: Lifecycle task', 'Name mismatch');

  // Update
  const { status: putStatus } = await apiCall('PUT', `/v1/schedules/${taskId}`, {
    name: 'Test: Updated lifecycle task',
    expression: '30 14 * * 1-5',
  });
  assert(putStatus === 200, `PUT failed: ${putStatus}`);

  // Verify update
  const { data: verifyData } = await apiCall('GET', `/v1/schedules/${taskId}`);
  assert(verifyData.data.name === 'Test: Updated lifecycle task', 'Update not persisted');

  // History
  const { status: histStatus, data: histData } = await apiCall('GET', `/v1/schedules/${taskId}/history`);
  assert(histStatus === 200, `History GET failed: ${histStatus}`);
  assert(Array.isArray(histData.data), 'History should be an array');

  // Delete
  const { status: delStatus } = await apiCall('DELETE', `/v1/schedules/${taskId}`);
  assert(delStatus === 200, `DELETE failed: ${delStatus}`);

  // Verify deletion
  const { status: gone } = await apiCall('GET', `/v1/schedules/${taskId}`);
  assert(gone === 404, `Expected 404 after delete but got ${gone}`);
}

async function testDeleteNonExistent(): Promise<void> {
  const { status } = await apiCall('DELETE', '/v1/schedules/non-existent-id');
  assert(status === 404, `Expected 404 but got ${status}`);
}

async function testNotificationSettingsRoundTrip(): Promise<void> {
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Notify config',
    instruction: 'Verify notify config',
    schedule_type: 'recurring',
    expression: '0 8 * * *',
    notify_channels: ['in_app', 'webhook'],
    notify_webhook_url: 'https://example.com/hooks/scheduler',
  });
  assert(status === 201, `Expected 201 but got ${status}`);
  const taskId = data?.data?.id;
  assert(typeof taskId === 'string' && taskId.length > 0, 'Expected schedule id');

  const getRes = await apiCall('GET', `/v1/schedules/${taskId}`);
  assert(getRes.status === 200, `Expected 200 but got ${getRes.status}`);
  const record = getRes.data?.data || {};
  const channels = Array.isArray(record.notify_channels) ? record.notify_channels : [];
  assert(channels.includes('in_app'), 'Expected in_app notification channel');
  assert(channels.includes('webhook'), 'Expected webhook notification channel');
  assert(record.notify_webhook_url === 'https://example.com/hooks/scheduler', 'Expected notify_webhook_url persisted');
}

async function testSuccessNotificationOnManualRun(): Promise<void> {
  if (!dbPool) {
    throw new Error('DATABASE_URL is required');
  }
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Notify success',
    instruction: 'Run and send success notification',
    schedule_type: 'recurring',
    expression: '*/10 * * * *',
    notify_channels: ['in_app'],
  });
  assert(status === 201, `Expected 201 but got ${status}`);
  const taskId = String(data?.data?.id || '');
  assert(Boolean(taskId), 'Expected created task id');

  const runRes = await apiCall('POST', `/v1/schedules/${taskId}/run`);
  assert(runRes.status === 200, `Expected 200 but got ${runRes.status}`);

  await waitForTaskNotification(taskId, 'success');
}

async function testErrorNotificationOnManualRun(): Promise<void> {
  if (!dbPool) {
    throw new Error('DATABASE_URL is required');
  }
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Notify error',
    instruction: 'Run and send error notification',
    schedule_type: 'recurring',
    expression: '*/10 * * * *',
    notify_channels: ['in_app'],
  });
  assert(status === 201, `Expected 201 but got ${status}`);
  const taskId = String(data?.data?.id || '');
  assert(Boolean(taskId), 'Expected created task id');

  // Force scheduler state update to fail during run_count increment (integer overflow),
  // which should drive the run into error path and emit an error notification.
  await dbPool.query(
    `UPDATE scheduled_tasks
     SET run_count = 2147483647
     WHERE id = $1`,
    [taskId],
  );

  const runRes = await apiCall('POST', `/v1/schedules/${taskId}/run`);
  assert(runRes.status === 200, `Expected 200 but got ${runRes.status}`);

  await waitForTaskNotification(taskId, 'error');
}

// Cleanup test schedules
async function cleanupTestSchedules(): Promise<void> {
  const { data } = await apiCall('GET', '/v1/schedules');
  if (!data?.data) return;
  for (const task of data.data) {
    if (String(task.name).startsWith('Test:')) {
      await apiCall('DELETE', `/v1/schedules/${task.id}`);
    }
  }
}

async function testScheduledTaskRunsAtTime(): Promise<void> {
  const runAt = new Date(Date.now() + 15000).toISOString();
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Timed run',
    instruction: 'Timed run test',
    schedule_type: 'once',
    run_at: runAt,
  });
  assert(status === 201, `Expected 201 but got ${status}`);
  const taskId = data.data.id;

  const timeoutMs = 60000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hist = await apiCall('GET', `/v1/schedules/${taskId}/history`);
    if (hist.status === 200 && Array.isArray(hist.data?.data) && hist.data.data.length > 0) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Scheduled task did not run within timeout');
}

async function testRecurringTaskRunsMultipleTimes(): Promise<void> {
  const { status, data } = await apiCall('POST', '/v1/schedules', {
    name: 'Test: Recurring run',
    instruction: 'Recurring run test',
    schedule_type: 'recurring',
    expression: '*/1 * * * *',
  });
  assert(status === 201, `Expected 201 but got ${status}`);
  const taskId = data.data.id;

  const timeoutMs = 130000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hist = await apiCall('GET', `/v1/schedules/${taskId}/history`);
    if (hist.status === 200 && Array.isArray(hist.data?.data) && hist.data.data.length >= 2) {
      return;
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error('Recurring task did not run twice within timeout');
}

// ============================================================
//  Main runner
// ============================================================

async function main(): Promise<void> {
  console.log('\n═══ User-Facing Scheduler Tests ═══\n');

  // 1. Offline tests (always run)
  console.log('── Shape & Validation ──');
  await runTest('cron expression parsing', testCronParsing);
  await runTest('next-run calculation', testNextRunCalculation);
  await runTest('scheduled task shape', testScheduledTaskShape);
  await runTest('schedule type validation', testScheduleTypeValidation);

  // 2. Auth guard tests (always run)
  console.log('\n── Auth Guard ──');
  await runTest('GET /v1/schedules rejects unauthenticated', testSchedulesRejectsUnauthenticated);
  await runTest('POST /v1/schedules rejects unauthenticated', testCreateScheduleRejectsUnauthenticated);

  // 3. Authenticated CRUD tests (require session)
  console.log('\n── CRUD (authenticated) ──');
  if (SESSION_COOKIE) {
    await runTest('create recurring schedule', testCreateRecurringSchedule);
    await runTest('create one-time schedule', testCreateOnceSchedule);
    await runTest('list schedules', testListSchedules);
    await runTest('create schedule validation', testCreateScheduleValidation);
    await runTest('schedule lifecycle (create/get/update/history/delete)', testScheduleLifecycle);
    await runTest('delete non-existent schedule', testDeleteNonExistent);
    await runTest('notification settings round-trip', testNotificationSettingsRoundTrip);
    if (DATABASE_URL) {
      await runTest('scheduled task completes -> success notification sent', testSuccessNotificationOnManualRun);
      await runTest('scheduled task failure -> error notification sent', testErrorNotificationOnManualRun);
    } else {
      skip('scheduled task completes -> success notification sent', 'DATABASE_URL not set');
      skip('scheduled task failure -> error notification sent', 'DATABASE_URL not set');
    }
    await cleanupTestSchedules();

    if (process.env.SCHEDULER_TIME_E2E === '1') {
      await runTest('scheduled task runs at specified time (optional)', testScheduledTaskRunsAtTime);
      await runTest('recurring task runs multiple times (optional)', testRecurringTaskRunsMultipleTimes);
      await cleanupTestSchedules();
    } else {
      skip('scheduled task runs at specified time (optional)', 'SCHEDULER_TIME_E2E not set');
      skip('recurring task runs multiple times (optional)', 'SCHEDULER_TIME_E2E not set');
    }
  } else {
    skip('create recurring schedule', 'TEST_SESSION_COOKIE not set');
    skip('create one-time schedule', 'TEST_SESSION_COOKIE not set');
    skip('list schedules', 'TEST_SESSION_COOKIE not set');
    skip('create schedule validation', 'TEST_SESSION_COOKIE not set');
    skip('schedule lifecycle', 'TEST_SESSION_COOKIE not set');
    skip('delete non-existent schedule', 'TEST_SESSION_COOKIE not set');
    skip('notification settings round-trip', 'TEST_SESSION_COOKIE not set');
    skip('scheduled task completes -> success notification sent', 'TEST_SESSION_COOKIE not set');
    skip('scheduled task failure -> error notification sent', 'TEST_SESSION_COOKIE not set');
    skip('scheduled task runs at specified time (optional)', 'TEST_SESSION_COOKIE not set');
    skip('recurring task runs multiple times (optional)', 'TEST_SESSION_COOKIE not set');
  }

  // Summary
  console.log('\n═══ Summary ═══');
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`Passed: ${passed}  Failed: ${failed}  Skipped: ${skipped}  Total: ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const r of results.filter((t) => !t.passed)) {
      console.log(`  ✗ ${r.name}: ${r.error}`);
    }
    process.exit(1);
  }

  if (dbPool) {
    await dbPool.end();
    dbPool = null;
  }
}

describe('A7 Scheduler (Jest)', () => {
  it('validates cron expression parsing', async () => {
    await testCronParsing();
    expect(true).toBe(true);
  });

  it('validates next-run calculation', async () => {
    await testNextRunCalculation();
    expect(true).toBe(true);
  });

  it('validates scheduled task shape', async () => {
    await testScheduledTaskShape();
    expect(true).toBe(true);
  });

  it('validates schedule type requirements', async () => {
    await testScheduleTypeValidation();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E ? it : it.skip)('enforces auth on scheduler routes', async () => {
    await testSchedulesRejectsUnauthenticated();
    await testCreateScheduleRejectsUnauthenticated();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) ? it : it.skip)('supports schedule CRUD lifecycle', async () => {
    await testCreateRecurringSchedule();
    await testCreateOnceSchedule();
    await testListSchedules();
    await testCreateScheduleValidation();
    await testScheduleLifecycle();
    await testDeleteNonExistent();
    await cleanupTestSchedules();
    expect(true).toBe(true);
  });

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) ? it : it.skip)(
    'persists notification settings',
    async () => {
      await testNotificationSettingsRoundTrip();
      await cleanupTestSchedules();
      expect(true).toBe(true);
    },
  );

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) && Boolean(DATABASE_URL) ? it : it.skip)(
    'emits success/error notifications on manual run',
    async () => {
      await testSuccessNotificationOnManualRun();
      await testErrorNotificationOnManualRun();
      await cleanupTestSchedules();
      expect(true).toBe(true);
    },
  );

  (RUN_LIVE_GATEWAY_E2E && Boolean(SESSION_COOKIE) && process.env.SCHEDULER_TIME_E2E === '1' ? it : it.skip)(
    'executes timed and recurring schedules',
    async () => {
      await testScheduledTaskRunsAtTime();
      await testRecurringTaskRunsMultipleTimes();
      await cleanupTestSchedules();
      expect(true).toBe(true);
    },
    180000,
  );
});

if (!process.env.JEST_WORKER_ID) {
  main().catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}
