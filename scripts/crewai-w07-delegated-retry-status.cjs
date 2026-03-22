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

function run() {
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const selfCorrectionSource = read('services/agent-runtime/src/self-correction.ts');
  const selfCorrectionTests = read('services/agent-runtime/src/__tests__/self-correction.test.ts');
  const openhandsW07Contract = read(
    'services/gateway-api/src/__tests__/openhands-parity-w07-tool-failure-recovery-contract.test.ts',
  );
  const nudgeContract = read('services/gateway-api/src/__tests__/parity-nudge-unstick-wiring-2026-03-12.contract.test.ts');
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w07-delegated-retry-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w07_delegated_worker_recovery_surface_present',
    runtimeSource.includes('const effectiveAgentId = routedAgentId || runtimeAgentId;') &&
      runtimeSource.includes('? await resolveSubagentConfig(pool, event.chat_id, effectiveAgentId)') &&
      runtimeSource.includes('const routedSubagentPolicyResolutionFailed = Boolean(') &&
      runtimeSource.includes('Subagent policy resolution failed; tool execution will be blocked for this routed turn') &&
      runtimeSource.includes('toolCall.block_reason = `Subagent policy scope denied "${toolCall.scope}"`;'),
    'delegated worker turns are routed through subagent policy resolution with explicit fail-closed recovery semantics',
  );

  add(
    'crewai_w07_bounded_retry_backoff_and_chain_audit_present',
    selfCorrectionSource.includes('const MAX_SELF_CORRECTION_RETRIES = 12;') &&
      selfCorrectionSource.includes('const MIN_RETRY_DELAY_MS = 50;') &&
      selfCorrectionSource.includes('const MAX_RETRY_DELAY_MS = 30_000;') &&
      selfCorrectionSource.includes('if (attemptNumber > this.config.maxRetries) {') &&
      selfCorrectionSource.includes('if (attemptNumber > this.config.requireApprovalAfter) {') &&
      selfCorrectionSource.includes('retry_of: originalCall.run_id,') &&
      selfCorrectionSource.includes('retry_chain: chainId,') &&
      selfCorrectionSource.includes('recordToolRetryInDb('),
    'failed delegated tasks use bounded retry/backoff with approval thresholding and retry-chain audit persistence',
  );

  add(
    'crewai_w07_stale_turn_and_dispatch_retry_recovery_present',
    runtimeSource.includes('if (await hasNudgeAdvanced(pool, event.chat_id, turnNudgeNonce)) {') &&
      runtimeSource.includes('Nudge detected after LLM call; skipping stale tool execution') &&
      runtimeSource.includes('Nudge detected; dropping stale assistant output') &&
      runtimeSource.includes('function computeQueueRetryDelaySeconds(attempt: number): number {') &&
      runtimeSource.includes("const status = attemptCount >= maxAttempts ? 'dead_letter' : 'failed';") &&
      runtimeSource.includes("AND status IN ('queued', 'failed')") &&
      runtimeSource.includes('AND (next_retry_at IS NULL OR next_retry_at <= NOW())'),
    'runtime recovers delegated failures via stale-turn suppression plus queue retry/dead-letter dispatch controls',
  );

  add(
    'crewai_w07_runtime_and_contract_coverage_present',
    selfCorrectionTests.includes('e2e: approval gate fires at retry threshold') &&
      selfCorrectionTests.includes('suppresses delayed transient retry when self-correction is disabled before timer fires') &&
      openhandsW07Contract.includes('OpenHands W07 tool-failure recovery parity contract') &&
      nudgeContract.includes('parity nudge unstick wiring 2026-03-12') &&
      contractSource.includes('CrewAI W07 delegated retry parity contract') &&
      contractSource.includes("'crewai_w07_delegated_worker_recovery_surface_present'"),
    'delegated retry/recovery behavior is anchored by runtime retry tests and parity contract coverage',
  );

  add(
    'crewai_w07_matrix_binding_present',
    matrixSource.includes('| CW-W07 | Crew retry/recovery for failed delegated tasks | implemented |') &&
      matrixSource.includes('crewai_parity_w07_delegated_retry_contract') &&
      matrixSource.includes('crewai-w07-delegated-retry-latest'),
    'Wave 5 matrix binds CW-W07 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w07-delegated-retry-latest.json');
  const outMd = path.join(outDir, 'crewai-w07-delegated-retry-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W07 Delegated Retry Recovery Status',
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
