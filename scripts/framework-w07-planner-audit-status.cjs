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
  const workflowStepAuditContract = read('services/gateway-api/src/__tests__/workflow-executor-step-audit-completeness-contract.test.ts');
  const workflowAtomicityContract = read('services/gateway-api/src/__tests__/admin-workflows-write-atomicity-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w07_tool_augmented_planner_runtime_present',
    workflowExecutor.includes("case 'tool_call':") &&
      workflowExecutor.includes('output = await this.executeTool(step, variables, {') &&
      workflowExecutor.includes('this.nc.publish(\'tool.run.request\', JSONCodec().encode(envelope));') &&
      workflowExecutor.includes('FROM tool_runs') &&
      workflowExecutor.includes('WHERE id = $1'),
    'workflow executor planner runtime dispatches tool_call steps to tool runner and resolves deterministic tool-run outcomes',
  );

  add(
    'framework_w07_step_audit_chain_present',
    workflowExecutor.includes('private async emitWorkflowStepAuditEvent(') &&
      workflowExecutor.includes("action: 'step_started' | 'step_completed' | 'step_failed'") &&
      workflowExecutor.includes("action: 'step_started',") &&
      workflowExecutor.includes("action: 'step_completed',") &&
      workflowExecutor.includes("action: 'step_failed',") &&
      workflowExecutor.includes('step_id: params.step_id') &&
      workflowExecutor.includes('step_type: params.step_type') &&
      workflowExecutor.includes('INSERT INTO workflow_audit_log'),
    'step lifecycle emits run-bound audit entries with step_id/step_type correlation details',
  );

  add(
    'framework_w07_workflow_write_audit_atomicity_present',
    workflowsRoute.includes('await executePoolTransaction(pool, async (client) => {') &&
      workflowsRoute.includes('INSERT INTO workflow_versions') &&
      workflowsRoute.includes('INSERT INTO workflow_runs') &&
      workflowsRoute.includes('INSERT INTO workflow_audit_log') &&
      workflowsRoute.includes('Workflow create transaction invariant failed') &&
      workflowsRoute.includes('Workflow update transaction invariant failed') &&
      workflowsRoute.includes('Workflow run transaction invariant failed'),
    'workflow create/update/execute bundles remain transaction-bound with audit insertion invariants',
  );

  add(
    'framework_w07_contract_suite_bound',
    workflowStepAuditContract.includes("describe('workflow executor step-audit completeness contract'") &&
      workflowAtomicityContract.includes("describe('admin workflows write atomicity contract'"),
    'planner/audit chain parity is anchored by executor step-audit and workflow atomicity contracts',
  );

  add(
    'framework_w07_matrix_binding_present',
    matrixSource.includes('| FW-W07 | Tool-augmented planner runtime with deterministic audit chain | implemented |') &&
      matrixSource.includes('framework_parity_w07_planner_audit_chain_contract'),
    'Wave 4 matrix binds FW-W07 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w07-planner-audit-latest.json');
  const outMd = path.join(outDir, 'framework-w07-planner-audit-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W07 Planner Audit Status',
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
