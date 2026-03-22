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
  const selfCorrectionSource = read('services/agent-runtime/src/self-correction.ts');
  const errorClassifierSource = read('services/agent-runtime/src/error-classifier.ts');
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const selfCorrectionTestSource = read('services/agent-runtime/src/__tests__/self-correction.test.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w07-tool-failure-recovery-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w07_bounded_retry_limits_present',
    selfCorrectionSource.includes('const MAX_SELF_CORRECTION_RETRIES = 12;') &&
      selfCorrectionSource.includes('const DEFAULT_MAX_RETRIES = 3;') &&
      selfCorrectionSource.includes('const MIN_RETRY_DELAY_MS = 50;') &&
      selfCorrectionSource.includes('const MAX_RETRY_DELAY_MS = 30_000;') &&
      selfCorrectionSource.includes('if (attemptNumber > this.config.maxRetries) {'),
    'self-correction enforces bounded retry count and bounded backoff delay envelope',
  );

  add(
    'openhands_w07_fail_closed_retry_guardrails_present',
    selfCorrectionSource.includes('if (attemptNumber > this.config.requireApprovalAfter) {') &&
      selfCorrectionSource.includes("outcome: 'aborted'") &&
      selfCorrectionSource.includes("errorAnalysis: `approval gate triggered after attempt ${this.config.requireApprovalAfter}`") &&
      selfCorrectionSource.includes("await this.reportErrorToUser(") &&
      selfCorrectionSource.includes("const budgetOk = await this.checkBudget(originalCall.user_id);") &&
      selfCorrectionSource.includes('if (!budgetOk) {'),
    'retry loop is fail-closed via approval threshold and budget guard before dispatch',
  );

  add(
    'openhands_w07_transient_retry_classification_and_dispatch_present',
    errorClassifierSource.includes("classification: 'transient'") &&
      errorClassifierSource.includes('Exit code 124 (timeout)') &&
      runtimeSource.includes("if (result.status === 'error' || result.status === 'timeout')") &&
      runtimeSource.includes('const handled = await selfCorrection.handleToolResult(result);'),
    'runtime routes tool failures into self-correction with explicit transient classification anchors',
  );

  add(
    'openhands_w07_test_and_contract_coverage_present',
    selfCorrectionTestSource.includes('Set requireApprovalAfter=1, so attempt #2 is approval-gated.') &&
      selfCorrectionTestSource.includes('suppresses delayed transient retry when self-correction is disabled before timer fires') &&
      contractSource.includes('OpenHands W07 tool-failure recovery parity contract') &&
      contractSource.includes("'openhands_w07_bounded_retry_limits_present'"),
    'bounded retry and fail-closed paths are anchored by runtime tests and parity contract',
  );

  add(
    'openhands_w07_matrix_binding_present',
    matrixSource.includes('| OH-W07 | Tool failure recovery with bounded retries | implemented |') &&
      matrixSource.includes('openhands_parity_w07_tool_failure_recovery') &&
      matrixSource.includes('openhands-w07-retry-recovery-latest'),
    'Wave 1 matrix binds OH-W07 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w07-retry-recovery-latest.json');
  const outMd = path.join(outDir, 'openhands-w07-retry-recovery-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W07 Tool Failure Retry Recovery Status',
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
