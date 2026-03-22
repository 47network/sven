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
  const workflowRunsPage = read('apps/admin-ui/src/app/workflow-runs/page.tsx');
  const workflowBuilderPage = read('apps/admin-ui/src/app/workflow-builder/page.tsx');
  const hooksSource = read('apps/admin-ui/src/lib/hooks.ts');
  const apiSource = read('apps/admin-ui/src/lib/api.ts');
  const staleRunsContract = read('services/gateway-api/src/__tests__/admin-workflows-stale-runs-contract.test.ts');
  const runControlResponseContract = read('services/gateway-api/src/__tests__/workflow-run-control-response-contract.test.ts');
  const runTransitionGuardContract = read('services/gateway-api/src/__tests__/workflow-run-transition-guard-contract.test.ts');
  const retryStepContract = read('services/gateway-api/src/__tests__/admin-workflows-retry-step-contract.test.ts');
  const executorControlContract = read('services/gateway-api/src/__tests__/workflow-executor-control-enforcement-contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w10_workflow_runs_observability_routes_present',
    workflowsRoute.includes("app.get<{ Params: { run_id: string } }>('/workflow-runs/:run_id'") &&
      workflowsRoute.includes("app.get<{ Querystring: { workflow_id?: string; status?: string; limit?: number } }>('/workflow-runs'") &&
      workflowsRoute.includes("app.get<{ Querystring: { minutes?: number; limit?: number } }>('/workflows/stale-runs'") &&
      workflowsRoute.includes("app.get<{ Params: { id: string }; Querystring: { status?: string; limit?: number } }>('/workflows/:id/runs'"),
    'workflow route surface exposes run detail/list and stale-run operator observability endpoints',
  );

  add(
    'n8n_w10_run_control_routes_present',
    workflowsRoute.includes("app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/cancel'") &&
      workflowsRoute.includes("app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/pause'") &&
      workflowsRoute.includes("app.post<{ Params: { run_id: string } }>('/workflow-runs/:run_id/resume'") &&
      workflowsRoute.includes("/workflow-runs/:run_id/steps/:step_id/retry") &&
      workflowsRoute.includes("kind: 'workflow.retry_step'"),
    'workflow run control routes expose cancel/pause/resume/retry-step control plane actions',
  );

  add(
    'n8n_w10_run_transition_and_response_guards_present',
    workflowsRoute.includes("const cancellable = new Set(['pending', 'running', 'paused']);") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to cancelled") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to paused") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to running") &&
      workflowsRoute.includes('previous_status: currentStatus') &&
      workflowsRoute.includes("current_status: 'cancelled'") &&
      workflowsRoute.includes("current_status: 'paused'") &&
      workflowsRoute.includes("current_status: 'running'"),
    'workflow run control path enforces legal transitions with explicit prior/new status responses',
  );

  add(
    'n8n_w10_admin_ui_workflow_runs_surface_present',
    workflowRunsPage.includes('PageHeader title="Workflow Runs"') &&
      workflowRunsPage.includes('Execution history with step-by-step timeline') &&
      workflowRunsPage.includes("run.steps && run.steps.length > 0") &&
      workflowBuilderPage.includes('Link href={`/workflow-runs?workflow=${wf.id}`}') &&
      hooksSource.includes('export function useWorkflowRuns(workflowId: string)') &&
      apiSource.includes('runs: (workflowId: string) => requestRowsSoft(`/admin/workflows/${workflowId}/runs`)'),
    'admin UI exposes workflow run dashboard/timeline with workflow-to-runs navigation and data hooks',
  );

  add(
    'n8n_w10_contract_tests_bound',
    staleRunsContract.includes("describe('workflow stale-run detection contract'") &&
      runControlResponseContract.includes("describe('workflow run control response contract'") &&
      runTransitionGuardContract.includes("describe('workflow run transition guard contract'") &&
      retryStepContract.includes("describe('admin workflows retry-step contract'") &&
      executorControlContract.includes("describe('workflow executor control enforcement contract'"),
    'workflow ops dashboard/control behaviors are bound to dedicated contract tests',
  );

  add(
    'n8n_w10_matrix_binding_present',
    matrixSource.includes('| NN-W10 | Workflow operations dashboard (runs, stale runs, controls) | implemented |') &&
      matrixSource.includes('n8n_parity_w10_workflow_ops_contract'),
    'Wave 3 matrix binds NN-W10 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w10-workflow-ops-latest.json');
  const outMd = path.join(outDir, 'n8n-w10-workflow-ops-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W10 Workflow Ops Status',
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
