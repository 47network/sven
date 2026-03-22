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
  const dagContract = read('services/gateway-api/src/__tests__/workflow-dag-completion-invariants-contract.test.ts');
  const transitionGuardContract = read('services/gateway-api/src/__tests__/workflow-run-transition-guard-contract.test.ts');
  const preflightFailureContract = read('services/gateway-api/src/__tests__/workflow-executor-preflight-terminal-failure-contract.test.ts');
  const edgeIntegrityContract = read('services/gateway-api/src/__tests__/workflow-executor-edge-reference-integrity-contract.test.ts');
  const matrixSource = read('docs/parity/wave4-framework-absorption-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'framework_w04_graph_definition_guardrails_present',
    workflowsRoute.includes('function validateWorkflowDefinition(') &&
      workflowsRoute.includes('edge references unknown step id') &&
      workflowsRoute.includes('workflow edges must form an acyclic graph') &&
      workflowsRoute.includes('const graphValidation = validateWorkflowDefinition(normalizedSteps, normalizedEdges);') &&
      workflowsRoute.includes('const graphValidation = validateWorkflowDefinition(mergedSteps, mergedEdges);'),
    'workflow route enforces DAG/state-definition guardrails on create/update',
  );

  add(
    'framework_w04_run_transition_fail_closed_guards_present',
    workflowsRoute.includes('async function getScopedRunStatus(runId: string, orgId: string): Promise<string | null>') &&
      workflowsRoute.includes("const cancellable = new Set(['pending', 'running', 'paused']);") &&
      workflowsRoute.includes("wr.status = ANY($5::text[])") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to cancelled") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to paused") &&
      workflowsRoute.includes("Run cannot transition from ${currentStatus} to running"),
    'workflow run status transitions are explicitly scoped and fail-closed',
  );

  add(
    'framework_w04_executor_terminal_fail_closed_controls_present',
    workflowExecutor.includes("throw new Error('workflow edges must form an acyclic graph over declared steps');") &&
      workflowExecutor.includes('workflow step missing for dependency graph node') &&
      workflowExecutor.includes('private async markRunFailed(') &&
      workflowExecutor.includes("'__executor_failure'") &&
      workflowExecutor.includes('private async publishWorkflowDeadLetter(') &&
      workflowExecutor.includes("'runtime.dispatch.dead_letter'"),
    'executor keeps terminal fail-closed graph checks and dead-letter diagnostics',
  );

  add(
    'framework_w04_contract_suite_bound',
    dagContract.includes("describe('workflow DAG completion invariants contract'") &&
      transitionGuardContract.includes("describe('workflow run transition guard contract'") &&
      preflightFailureContract.includes("describe('workflow executor preflight terminal failure contract'") &&
      edgeIntegrityContract.includes("describe('workflow executor edge reference integrity contract'"),
    'graph-state guardrails are anchored by dedicated workflow contract suites',
  );

  add(
    'framework_w04_matrix_binding_present',
    matrixSource.includes('| FW-W04 | Graph-state orchestration guardrails (state transitions + fail-closed checks) | implemented |') &&
      matrixSource.includes('framework_parity_w04_graph_state_guardrails_contract'),
    'Wave 4 matrix binds FW-W04 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'framework-w04-graph-state-latest.json');
  const outMd = path.join(outDir, 'framework-w04-graph-state-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# Framework W04 Graph-State Guardrails Status',
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
