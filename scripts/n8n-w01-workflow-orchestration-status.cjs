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
  const workflowRoute = read('services/gateway-api/src/routes/admin/workflows.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w01_workflow_crud_surface_present',
    workflowRoute.includes("app.post<{ Body: Partial<Workflow> }>('/workflows'") &&
      workflowRoute.includes("app.put<{ Params: { id: string }; Body: UpdateWorkflowRequest }>('/workflows/:id'") &&
      workflowRoute.includes("app.get<{ Querystring: { workflow_id?: string; status?: string; limit?: number } }>('/workflow-runs'"),
    'workflow create/update/run-list routes are present for orchestration lifecycle',
  );

  add(
    'n8n_w01_graph_validation_present',
    workflowRoute.includes('workflow edges must form an acyclic graph') &&
      workflowRoute.includes('validateWorkflowDefinition('),
    'workflow graph definition is validated (including DAG constraint)',
  );

  add(
    'n8n_w01_execute_dispatch_present',
    workflowRoute.includes("app.post<{ Params: { id: string }; Body: { input_variables?: Record<string, any> } }>('/workflows/:id/execute'") &&
      workflowRoute.includes("kind: 'workflow.execute'") &&
      workflowRoute.includes('NATS_SUBJECTS.RUNTIME_DISPATCH'),
    'workflow execute path persists run and dispatches runtime workflow.execute event',
  );

  add(
    'n8n_w01_step_retry_controls_present',
    workflowRoute.includes("/workflow-runs/:run_id/steps/:step_id/retry") &&
      workflowRoute.includes("kind: 'workflow.retry_step'"),
    'workflow step retry path exists with deterministic runtime dispatch event',
  );

  add(
    'n8n_w01_matrix_binding_present',
    matrixSource.includes('| NN-W01 | Workflow graph execution pipeline (create/update/execute + run visibility) | implemented |') &&
      matrixSource.includes('n8n_parity_w01_workflow_orchestration_contract'),
    'Wave 3 matrix binds NN-W01 to contract test and evidence ID',
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
  const outJson = path.join(outDir, 'n8n-w01-workflow-orchestration-latest.json');
  const outMd = path.join(outDir, 'n8n-w01-workflow-orchestration-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W01 Workflow Orchestration Status',
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
