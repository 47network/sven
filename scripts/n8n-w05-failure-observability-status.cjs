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
  const workflowRoutes = read('services/gateway-api/src/routes/admin/workflows.ts');
  const failureContract = read('services/gateway-api/src/__tests__/workflow-executor-preflight-terminal-failure-contract.test.ts');
  const staleRunsContract = read('services/gateway-api/src/__tests__/admin-workflows-stale-runs-contract.test.ts');
  const retryTelemetryContract = read('services/gateway-api/src/__tests__/workflow-runs-retry-telemetry-exposure-contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w05_terminal_failure_marking_present',
    workflowExecutor.includes('private async markRunFailed(') &&
      workflowExecutor.includes("'EXECUTION_PRECHECK_FAILED'") &&
      workflowExecutor.includes("'WORKFLOW_NOT_FOUND'"),
    'workflow executor marks terminal preflight/execution failures with deterministic reason codes',
  );

  add(
    'n8n_w05_dead_letter_publication_present',
    workflowExecutor.includes('private async publishWorkflowDeadLetter(') &&
      workflowExecutor.includes("'runtime.dispatch.dead_letter'") &&
      workflowExecutor.includes("'invalid_runtime_dispatch_payload'") &&
      workflowExecutor.includes("'workflow_not_found'"),
    'workflow executor emits dead-letter events for invalid/terminal dispatch failures',
  );

  add(
    'n8n_w05_run_observability_surface_present',
    workflowRoutes.includes("app.get<{ Params: { run_id: string } }>('/workflow-runs/:run_id'") &&
      workflowRoutes.includes('FROM workflow_step_runs') &&
      workflowRoutes.includes('WHERE workflow_run_id = $1') &&
      workflowRoutes.includes('ORDER BY COALESCE(started_at, completed_at) ASC NULLS LAST, id ASC') &&
      workflowRoutes.includes("app.get<{ Querystring: { minutes?: number; limit?: number } }>('/workflows/stale-runs'"),
    'workflow run detail and stale-run observability surfaces are exposed for operator triage',
  );

  add(
    'n8n_w05_contract_tests_bound',
    failureContract.includes("describe('workflow executor preflight terminal failure contract'") &&
      staleRunsContract.includes("describe('workflow stale-run detection contract'") &&
      retryTelemetryContract.includes("describe('workflow run retry telemetry exposure contract'"),
    'failure/dead-letter/stale-run behavior is bound to dedicated gateway contract tests',
  );

  add(
    'n8n_w05_matrix_binding_present',
    matrixSource.includes('| NN-W05 | Failure path and dead-letter style observability | implemented |') &&
      matrixSource.includes('n8n_parity_w05_failure_observability_contract'),
    'Wave 3 matrix binds NN-W05 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w05-failure-observability-latest.json');
  const outMd = path.join(outDir, 'n8n-w05-failure-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W05 Failure Observability Status',
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
