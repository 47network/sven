#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const strict = process.argv.includes('--strict');
const outDir = path.join(root, 'docs', 'release', 'status');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const selfCorrectionSource = read('services/agent-runtime/src/self-correction.ts');
  const selfCorrectionTests = read('services/agent-runtime/src/__tests__/self-correction.test.ts');
  const crewaiRetryContract = read('services/gateway-api/src/__tests__/crewai-parity-w07-delegated-retry-contract.test.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read('services/gateway-api/src/__tests__/autogen-parity-w07-retry-recovery-contract.test.ts');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w07_bounded_self_correction_retry_policy_present',
    selfCorrectionSource.includes('const MAX_SELF_CORRECTION_RETRIES = 12;') &&
      selfCorrectionSource.includes('const MIN_RETRY_DELAY_MS = 50;') &&
      selfCorrectionSource.includes('const MAX_RETRY_DELAY_MS = 30_000;') &&
      selfCorrectionSource.includes('if (attemptNumber > this.config.maxRetries) {') &&
      selfCorrectionSource.includes('if (attemptNumber > this.config.requireApprovalAfter) {') &&
      selfCorrectionSource.includes('retry_of: originalCall.run_id,') &&
      selfCorrectionSource.includes('retry_chain: chainId,') &&
      selfCorrectionSource.includes('recordToolRetryInDb('),
    'agent-team retry loops are bounded by max retries, backoff bounds, approval thresholds, and retry-chain audit writes',
  );

  add(
    'autogen_w07_infinite_loop_and_fanout_controls_present',
      selfCorrectionSource.includes('if (existingSigs.has(sig) && attemptNumber > 1) {') &&
      selfCorrectionSource.includes('Strategy retry generated identical tool call — aborting') &&
      selfCorrectionSource.includes('Strategy retry fan-out capped for attempt') &&
      selfCorrectionSource.includes('let dispatchedCount = 0;') &&
      selfCorrectionSource.includes('if (dispatchedCount >= STRATEGY_RETRY_MAX_DISPATCH_PER_ATTEMPT) {') &&
      selfCorrectionSource.includes('break;'),
    'recovery loop prevents identical-call recursion and caps strategy fan-out per retry attempt',
  );

  add(
    'autogen_w07_queue_retry_dead_letter_recovery_present',
    runtimeSource.includes('function computeQueueRetryDelaySeconds(attempt: number): number {') &&
      runtimeSource.includes("const status = attemptCount >= maxAttempts ? 'dead_letter' : 'failed';") &&
      runtimeSource.includes('next_retry_at = CASE WHEN $2 = \'failed\' THEN NOW() + ($4 * INTERVAL \'1 second\') ELSE NULL END,') &&
      runtimeSource.includes("AND status IN ('queued', 'failed')") &&
      runtimeSource.includes('AND (next_retry_at IS NULL OR next_retry_at <= NOW())'),
    'team-chat dispatch queue uses bounded retry delay and dead-letter transition when retry budget is exhausted',
  );

  add(
    'autogen_w07_runtime_retry_test_coverage_present',
    selfCorrectionTests.includes('e2e: approval gate fires at retry threshold') &&
      selfCorrectionTests.includes('detects infinite loops in strategy retries') &&
      selfCorrectionTests.includes('caps strategy retry fan-out to one dispatched tool call per attempt') &&
      selfCorrectionTests.includes('suppresses delayed transient retry when self-correction is disabled before timer fires') &&
      selfCorrectionTests.includes('enforces user-scoped retry budget independently per user') &&
      selfCorrectionTests.includes('clamps extreme retry config and schedules bounded finite transient delay'),
    'retry/recovery behavior is backed by adversarial runtime tests for loops, fan-out, budget, and bounded delay',
  );

  add(
    'autogen_w07_cross_wave_retry_foundation_present',
    exists('services/gateway-api/src/__tests__/crewai-parity-w07-delegated-retry-contract.test.ts') &&
      crewaiRetryContract.includes('CrewAI W07 delegated retry parity contract'),
    'cross-wave retry foundations are already contract-anchored and reused for AutoGen retry/recovery parity',
  );

  add(
    'autogen_w07_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W07 | Bounded retry and recovery behavior in multi-agent chat loops | implemented |') &&
      matrixSource.includes('autogen_parity_w07_retry_recovery_contract') &&
      matrixSource.includes('autogen-w07-retry-recovery-latest') &&
      programSource.includes('AG-W07') &&
      packageSource.includes('"release:autogen:w07:status"') &&
      packageSource.includes('"release:autogen:w07:status:local"') &&
      contractSource.includes('AutoGen W07 retry recovery parity contract'),
    'Wave 7 docs and npm bindings include AG-W07 strict evidence lane',
  );

  const passed = checks.filter((check) => check.pass).length;
  const failed = checks.length - passed;
  const status = failed === 0 ? 'pass' : 'fail';
  const generatedAt = new Date().toISOString();

  const report = {
    generated_at: generatedAt,
    status,
    passed,
    failed,
    checks,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const outJson = path.join(outDir, 'autogen-w07-retry-recovery-latest.json');
  const outMd = path.join(outDir, 'autogen-w07-retry-recovery-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W07 Retry Recovery Status',
      '',
      `Generated: ${generatedAt}`,
      `Status: ${status}`,
      `Passed: ${passed}`,
      `Failed: ${failed}`,
      '',
      '## Checks',
      ...checks.map((check) => `- [${check.pass ? 'x' : ' '}] ${check.id}: ${check.detail}`),
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
  if (strict && status !== 'pass') process.exit(2);
}

run();
