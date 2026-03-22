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
  const workflowExecutor = read('services/workflow-executor/src/index.ts');
  const retryPolicyContract = read('services/gateway-api/src/__tests__/workflow-executor-step-retry-policy-contract.test.ts');
  const retryStepContract = read('services/gateway-api/src/__tests__/workflow-executor-retry-step-contract.test.ts');
  const routeRetryContract = read('services/gateway-api/src/__tests__/admin-workflows-retry-step-contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w04_step_retry_policy_runtime_present',
    workflowExecutor.includes('type StepRetryPolicy = {') &&
      workflowExecutor.includes('resolveStepRetryPolicy(') &&
      workflowExecutor.includes('computeStepRetryDelayMs(') &&
      workflowExecutor.includes('while (attempt <= retryPolicy.maxRetries + 1)'),
    'workflow executor includes bounded retry policy and retry loop controls',
  );

  add(
    'n8n_w04_retry_telemetry_persistence_present',
    workflowExecutor.includes('attempt_number, max_retries') &&
      workflowExecutor.includes('retry_delay_ms = $2') &&
      workflowExecutor.includes('next_retry_at = $3') &&
      workflowExecutor.includes('Retrying step ${step_id} in ${delayMs}ms'),
    'retry attempts persist telemetry/backoff fields with deterministic delay logging',
  );

  add(
    'n8n_w04_retry_dispatch_route_present',
    workflowExecutor.includes("if (data.kind === 'workflow.retry_step')") &&
      workflowExecutor.includes('processWorkflowRetryStepMessage') &&
      routeRetryContract.includes("/workflow-runs/:run_id/steps/:step_id/retry") &&
      routeRetryContract.includes("kind: 'workflow.retry_step'"),
    'retry-step API + runtime dispatch path exists with failed-step guardrail contract',
  );

  add(
    'n8n_w04_contract_tests_bound',
    retryPolicyContract.includes("describe('workflow executor step retry policy contract'") &&
      retryStepContract.includes("describe('workflow executor retry-step contract'") &&
      routeRetryContract.includes("describe('admin workflows retry-step contract'"),
    'retry/backoff behavior is bound to dedicated gateway contract tests',
  );

  add(
    'n8n_w04_matrix_binding_present',
    matrixSource.includes('| NN-W04 | Retry and backoff policy per step/run | implemented |') &&
      matrixSource.includes('n8n_parity_w04_retry_backoff_contract'),
    'Wave 3 matrix binds NN-W04 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w04-retry-backoff-latest.json');
  const outMd = path.join(outDir, 'n8n-w04-retry-backoff-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W04 Retry Backoff Status',
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
