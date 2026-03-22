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
  const telemetryContract = read('services/gateway-api/src/__tests__/workflow-run-telemetry-coherence-contract.test.ts');
  const stepAuditContract = read('services/gateway-api/src/__tests__/workflow-executor-step-audit-completeness-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w08_step_run_timeline_persistence_present',
    workflowExecutor.includes('INSERT INTO workflow_step_runs') &&
      workflowExecutor.includes('UPDATE workflow_step_runs SET status = $2, output_variables = $3, completed_at = $4, updated_at = $4') &&
      workflowExecutor.includes('UPDATE workflow_step_runs SET status = $2, error_message = $3, completed_at = $4, updated_at = $4') &&
      workflowsRoute.includes('FROM workflow_step_runs'),
    'step lifecycle timeline persists in workflow_step_runs and is exposed through workflow run inspection routes',
  );

  add(
    'langgraph_w08_run_telemetry_counters_present',
    workflowExecutor.includes('private async syncRunTelemetry(') &&
      workflowExecutor.includes('completed_steps = $4') &&
      workflowExecutor.includes('failed_steps = $5') &&
      workflowExecutor.includes('started_at = CASE WHEN $6 THEN COALESCE(started_at, $7) ELSE started_at END'),
    'graph-level telemetry counters and started timestamps are synchronized during execution',
  );

  add(
    'langgraph_w08_step_audit_diagnostics_present',
    workflowExecutor.includes('private async emitWorkflowStepAuditEvent(') &&
      workflowExecutor.includes('INSERT INTO workflow_audit_log') &&
      workflowExecutor.includes("action: 'step_started' | 'step_completed' | 'step_failed'") &&
      workflowExecutor.includes('step_id: params.step_id') &&
      workflowExecutor.includes('step_type: params.step_type'),
    'per-step diagnostics are recorded in workflow audit log with run/step correlation metadata',
  );

  add(
    'langgraph_w08_contract_coverage_present',
    telemetryContract.includes("describe('workflow run telemetry coherence contract'") &&
      stepAuditContract.includes("describe('workflow executor step-audit completeness contract'"),
    'observability invariants are anchored by telemetry coherence and step-audit completeness contracts',
  );

  add(
    'langgraph_w08_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W08 | Graph execution observability timeline + per-node diagnostics | implemented |') &&
      matrixSource.includes('langgraph_parity_w08_graph_observability_contract') &&
      matrixSource.includes('langgraph-w08-graph-observability-latest') &&
      programSource.includes('LG-W08') &&
      packageSource.includes('"release:langgraph:w08:status"') &&
      packageSource.includes('"release:langgraph:w08:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W08 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w08-graph-observability-latest.json');
  const outMd = path.join(outDir, 'langgraph-w08-graph-observability-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W08 Graph Observability Status',
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

