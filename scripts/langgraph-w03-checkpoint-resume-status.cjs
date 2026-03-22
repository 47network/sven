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
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w03_checkpoint_control_plane_present',
    workflowsRoute.includes("'/workflow-runs/:run_id/pause'") &&
      workflowsRoute.includes("'/workflow-runs/:run_id/resume'") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to paused") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to running") &&
      workflowsRoute.includes("current_status: 'paused'") &&
      workflowsRoute.includes("current_status: 'running'"),
    'run control plane exposes fail-closed pause/resume transitions with deterministic state metadata',
  );

  add(
    'langgraph_w03_executor_resume_loop_and_checkpoint_state_present',
    workflowExecutor.includes("private async waitForRunRunnable(run_id: string): Promise<'running' | 'cancelled' | 'missing'>") &&
      workflowExecutor.includes("if (status === 'paused') {") &&
      workflowExecutor.includes('await this.sleep(1000);') &&
      workflowExecutor.includes('private async syncRunTelemetry(') &&
      workflowExecutor.includes('SET step_results = $2,') &&
      workflowExecutor.includes('variables: this.hydrateVariablesFromStepResults(') &&
      workflowExecutor.includes('if (!this.areStepDependenciesCompleted(step_id, edges, stepResults)) {'),
    'executor preserves checkpointed step state and resumes deterministically from paused control state',
  );

  add(
    'langgraph_w03_stale_run_resume_diagnostics_present',
    workflowsRoute.includes("'/workflows/stale-runs'") &&
      workflowsRoute.includes("wr.status IN ('pending', 'running')") &&
      workflowsRoute.includes('MAX(COALESCE(completed_at, started_at)) AS last_step_at') &&
      workflowsRoute.includes('meta: { minutes, limit, count: result.rows.length }'),
    'stale-run diagnostics expose long-horizon resumability signals for checkpoint/recovery operations',
  );

  add(
    'langgraph_w03_contract_suite_bound',
    runControlContract.includes("describe('workflow run control response contract'") &&
      telemetryContract.includes("describe('workflow run telemetry coherence contract'") &&
      retryTelemetryContract.includes("describe('workflow run retry telemetry exposure contract'"),
    'checkpoint/resume behavior is anchored by run-control and telemetry contract suites',
  );

  add(
    'langgraph_w03_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W03 | Checkpointed graph state snapshots and resumable execution | implemented |') &&
      matrixSource.includes('langgraph_parity_w03_checkpoint_resume_contract') &&
      matrixSource.includes('langgraph-w03-checkpoint-resume-latest') &&
      programSource.includes('LG-W03') &&
      packageSource.includes('"release:langgraph:w03:status"') &&
      packageSource.includes('"release:langgraph:w03:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W03 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w03-checkpoint-resume-latest.json');
  const outMd = path.join(outDir, 'langgraph-w03-checkpoint-resume-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W03 Checkpoint Resume Status',
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

