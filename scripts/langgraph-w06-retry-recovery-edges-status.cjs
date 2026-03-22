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
  const workflowsRoute = read('services/gateway-api/src/routes/admin/workflows.ts');
  const workflowExecutor = read('services/workflow-executor/src/index.ts');
  const retryPolicyContract = read('services/gateway-api/src/__tests__/workflow-executor-step-retry-policy-contract.test.ts');
  const retryStepContract = read('services/gateway-api/src/__tests__/workflow-executor-retry-step-contract.test.ts');
  const adminRetryStepContract = read('services/gateway-api/src/__tests__/admin-workflows-retry-step-contract.test.ts');
  const retryTelemetryContract = read('services/gateway-api/src/__tests__/workflow-runs-retry-telemetry-exposure-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w06_executor_bounded_retry_loop_present',
    workflowExecutor.includes('resolveStepRetryPolicy(') &&
      workflowExecutor.includes('computeStepRetryDelayMs(') &&
      workflowExecutor.includes('while (attempt <= retryPolicy.maxRetries + 1)') &&
      workflowExecutor.includes('retry_delay_ms = $2') &&
      workflowExecutor.includes('next_retry_at = $3') &&
      workflowExecutor.includes("'runtime.dispatch.dead_letter'"),
    'executor keeps bounded retry/backoff loops and terminal dead-letter safety edge',
  );

  add(
    'langgraph_w06_control_plane_retry_step_present',
    workflowsRoute.includes("'/workflow-runs/:run_id/steps/:step_id/retry'") &&
      workflowsRoute.includes('Step retry is allowed only for failed, paused, or cancelled runs') &&
      workflowsRoute.includes("kind: 'workflow.retry_step'") &&
      workflowsRoute.includes("status: 'retry_queued'") &&
      workflowExecutor.includes("if (data.kind === 'workflow.retry_step')"),
    'control-plane exposes explicit retry-step edge and executor consumes retry dispatch deterministically',
  );

  add(
    'langgraph_w06_retry_telemetry_persistence_present',
    workflowExecutor.includes('attempt_number, max_retries') &&
      workflowExecutor.includes('retry_delay_ms = NULL') &&
      workflowExecutor.includes('next_retry_at = NULL') &&
      workflowExecutor.includes('step_results[step_id] = {') &&
      workflowExecutor.includes('max_retries: retryPolicy.maxRetries'),
    'retry attempts, budgets, and recovery state persist in step telemetry with bounded reset semantics',
  );

  add(
    'langgraph_w06_contract_coverage_present',
    retryPolicyContract.includes("describe('workflow executor step retry policy contract'") &&
      retryStepContract.includes("describe('workflow executor retry-step contract'") &&
      adminRetryStepContract.includes("describe('admin workflows retry-step contract'") &&
      retryTelemetryContract.includes("describe('workflow run retry telemetry exposure contract'"),
    'retry recovery edges are anchored by dedicated control-plane/executor/telemetry contract suites',
  );

  add(
    'langgraph_w06_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W06 | Retry policies and bounded error recovery edges | implemented |') &&
      matrixSource.includes('langgraph_parity_w06_retry_recovery_edges_contract') &&
      matrixSource.includes('langgraph-w06-retry-recovery-edges-latest') &&
      programSource.includes('LG-W06') &&
      packageSource.includes('"release:langgraph:w06:status"') &&
      packageSource.includes('"release:langgraph:w06:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W06 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w06-retry-recovery-edges-latest.json');
  const outMd = path.join(outDir, 'langgraph-w06-retry-recovery-edges-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W06 Retry Recovery Edges Status',
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

