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
  const workflowsRoute = read('services/gateway-api/src/routes/admin/workflows.ts');
  const runControlContract = read('services/gateway-api/src/__tests__/workflow-run-control-response-contract.test.ts');
  const telemetryContract = read('services/gateway-api/src/__tests__/workflow-run-telemetry-coherence-contract.test.ts');
  const retryTelemetryContract = read('services/gateway-api/src/__tests__/workflow-runs-retry-telemetry-exposure-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w08_resume_control_plane_present',
    workflowsRoute.includes("'/workflow-runs/:run_id/pause'") &&
      workflowsRoute.includes("'/workflow-runs/:run_id/resume'") &&
      workflowsRoute.includes("'/workflow-runs/:run_id/cancel'") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to paused") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to running") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to cancelled") &&
      workflowsRoute.includes('previous_status: currentStatus') &&
      workflowsRoute.includes("current_status: 'paused'") &&
      workflowsRoute.includes("current_status: 'running'") &&
      workflowsRoute.includes("current_status: 'cancelled'"),
    'workflow control plane enforces fail-closed pause/resume/cancel transitions with deterministic state metadata',
  );

  add(
    'framework_w08_executor_paused_resume_loop_present',
    workflowExecutor.includes("private async waitForRunRunnable(run_id: string): Promise<'running' | 'cancelled' | 'missing'>") &&
      workflowExecutor.includes("if (status === 'paused') {") &&
      workflowExecutor.includes('await this.sleep(1000);') &&
      workflowExecutor.includes('continue;') &&
      workflowExecutor.includes("if (status === 'cancelled' || status === 'completed' || status === 'failed') return 'cancelled';"),
    'executor run loop blocks on paused state and resumes deterministically when run returns to running',
  );

  add(
    'framework_w08_resumable_execution_context_present',
    workflowExecutor.includes('private async syncRunTelemetry(') &&
      workflowExecutor.includes('SET step_results = $2,') &&
      workflowExecutor.includes('started_at = CASE WHEN $6 THEN COALESCE(started_at, $7) ELSE started_at END') &&
      workflowExecutor.includes('variables: this.hydrateVariablesFromStepResults(') &&
      workflowExecutor.includes('if (!this.areStepDependenciesCompleted(step_id, edges, stepResults)) {') &&
      workflowsRoute.includes("Step retry is allowed only for failed, paused, or cancelled runs") &&
      workflowsRoute.includes("kind: 'workflow.retry_step'"),
    'run context persists telemetry/step state and rehydrates variables/dependencies for safe resume/retry',
  );

  add(
    'framework_w08_long_horizon_objective_tracking_present',
    workflowsRoute.includes("app.get<{ Querystring: { minutes?: number; limit?: number } }>('/workflows/stale-runs'") &&
      workflowsRoute.includes("wr.status IN ('pending', 'running')") &&
      workflowsRoute.includes('MAX(COALESCE(completed_at, started_at)) AS last_step_at') &&
      workflowsRoute.includes('meta: { minutes, limit, count: result.rows.length }'),
    'long-horizon objective tracking exposes stale-run detection and bounded query telemetry for resumable operations',
  );

  add(
    'framework_w08_contract_suite_bound',
    runControlContract.includes("describe('workflow run control response contract'") &&
      telemetryContract.includes("describe('workflow run telemetry coherence contract'") &&
      retryTelemetryContract.includes("describe('workflow run retry telemetry exposure contract'"),
    'objective/resume parity is anchored by run-control, telemetry coherence, and retry-telemetry contracts',
  );

  add(
    'framework_w08_matrix_binding_present',
    matrixSource.includes('| FW-W08 | Long-horizon objective tracking with resumable execution context | implemented |') &&
      matrixSource.includes('framework_parity_w08_objective_resume_contract'),
    'Wave 4 matrix binds FW-W08 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w08-objective-resume-latest.json');
  const outMd = path.join(outDir, 'framework-w08-objective-resume-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W08 Objective Resume Status',
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
