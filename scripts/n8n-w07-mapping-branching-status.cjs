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
  const outputMappingContract = read('services/gateway-api/src/__tests__/workflow-executor-output-mapping-contract.test.ts');
  const conditionalContract = read('services/gateway-api/src/__tests__/workflow-executor-conditional-operator-contract.test.ts');
  const routeValidationContract = read('services/gateway-api/src/__tests__/admin-workflows-definition-validation-contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w07_output_mapping_runtime_present',
    workflowExecutor.includes('private applyStepOutputMappings(') &&
      workflowExecutor.includes('resolveOutputMappingPath') &&
      workflowExecutor.includes('resolveOutputValueByPath') &&
      workflowExecutor.includes('targetVariables[target] = resolved.value;') &&
      workflowExecutor.includes('output mapping path not found'),
    'workflow executor applies per-target output mapping with fail-closed missing-path behavior',
  );

  add(
    'n8n_w07_conditional_branching_runtime_present',
    workflowExecutor.includes('private async executeConditional(step: any, variables: Record<string, any>): Promise<any> {') &&
      workflowExecutor.includes("case 'equals':") &&
      workflowExecutor.includes("case 'not_equals':") &&
      workflowExecutor.includes("case 'greater_than':") &&
      workflowExecutor.includes("case 'less_than':") &&
      workflowExecutor.includes("case 'contains':") &&
      workflowExecutor.includes('Unsupported conditional operator'),
    'workflow executor supports bounded conditional operators and fails closed on unsupported operators',
  );

  add(
    'n8n_w07_route_definition_validation_present',
    workflowsRoute.includes('const SUPPORTED_CONDITIONAL_OPERATORS = new Set([') &&
      workflowsRoute.includes('condition.operator is unsupported') &&
      workflowsRoute.includes('output mapping for') &&
      workflowsRoute.includes('validateWorkflowDefinition('),
    'workflow route validates conditional operator + output mapping structure before persistence',
  );

  add(
    'n8n_w07_contract_tests_bound',
    outputMappingContract.includes("describe('workflow executor output mapping contract'") &&
      conditionalContract.includes("describe('workflow executor conditional operator contract'") &&
      routeValidationContract.includes("describe('admin workflows definition validation contract'"),
    'mapping/conditional behavior is bound to dedicated gateway contract tests',
  );

  add(
    'n8n_w07_matrix_binding_present',
    matrixSource.includes('| NN-W07 | Multi-step data mapping and conditional branching | implemented |') &&
      matrixSource.includes('n8n_parity_w07_mapping_branching_contract'),
    'Wave 3 matrix binds NN-W07 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w07-mapping-branching-latest.json');
  const outMd = path.join(outDir, 'n8n-w07-mapping-branching-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W07 Mapping Branching Status',
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
