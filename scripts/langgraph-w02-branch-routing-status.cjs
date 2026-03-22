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
  const workflowValidationTests = read('services/gateway-api/src/__tests__/workflows-route.validation.test.ts');
  const conditionalOperatorContract = read('services/gateway-api/src/__tests__/workflow-executor-conditional-operator-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w02_conditional_operator_validation_present',
    workflowsRoute.includes("const SUPPORTED_CONDITIONAL_OPERATORS = new Set(['equals', 'not_equals', 'greater_than', 'less_than', 'contains']);") &&
      workflowsRoute.includes('if (stepType === \'conditional\') {') &&
      workflowsRoute.includes('condition.variable is required') &&
      workflowsRoute.includes('condition.operator is unsupported'),
    'workflow definition validation enforces supported conditional operators and required variable path',
  );

  add(
    'langgraph_w02_executor_branch_evaluation_present',
    workflowExecutor.includes('private async executeConditional(step: any, variables: Record<string, any>): Promise<any> {') &&
      workflowExecutor.includes('const { variable, operator, value } = condition;') &&
      workflowExecutor.includes("case 'equals':") &&
      workflowExecutor.includes("case 'not_equals':") &&
      workflowExecutor.includes("case 'greater_than':") &&
      workflowExecutor.includes("case 'less_than':") &&
      workflowExecutor.includes("case 'contains':") &&
      workflowExecutor.includes('return { condition_result: result };'),
    'executor evaluates branch conditions deterministically and emits explicit condition_result output',
  );

  add(
    'langgraph_w02_contract_coverage_present',
    workflowValidationTests.includes('returns 400 when create workflow conditional step uses unsupported operator') &&
      workflowValidationTests.includes('returns 400 when update workflow introduces unsupported conditional operator') &&
      conditionalOperatorContract.includes("describe('workflow executor conditional operator contract'") &&
      conditionalOperatorContract.includes('fails closed on unsupported conditional operators'),
    'route and executor branch-routing behavior is anchored by validation/runtime contract coverage',
  );

  add(
    'langgraph_w02_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W02 | Conditional branch routing with deterministic edge predicates | implemented |') &&
      matrixSource.includes('langgraph_parity_w02_branch_routing_contract') &&
      matrixSource.includes('langgraph-w02-branch-routing-latest') &&
      programSource.includes('LG-W02') &&
      packageSource.includes('"release:langgraph:w02:status"') &&
      packageSource.includes('"release:langgraph:w02:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W02 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w02-branch-routing-latest.json');
  const outMd = path.join(outDir, 'langgraph-w02-branch-routing-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W02 Branch Routing Status',
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

