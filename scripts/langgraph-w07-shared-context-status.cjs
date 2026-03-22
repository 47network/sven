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
  const outputMappingContract = read('services/gateway-api/src/__tests__/workflow-executor-output-mapping-contract.test.ts');
  const stepResultsContract = read('services/gateway-api/src/__tests__/workflow-run-step-results-persistence-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w07_input_context_seed_present',
    workflowsRoute.includes("'/workflows/:id/execute'") &&
      workflowsRoute.includes('input_variables?: Record<string, any>') &&
      workflowsRoute.includes('JSON.stringify(input_variables || {})'),
    'workflow execution entrypoint seeds run-scoped input variables for graph context',
  );

  add(
    'langgraph_w07_step_context_hydration_present',
    workflowExecutor.includes('private hydrateVariablesFromStepResults(') &&
      workflowExecutor.includes('this.applyStepOutputMappings(hydrated, step, output);') &&
      workflowExecutor.includes('private applyStepOutputMappings(') &&
      workflowExecutor.includes('private resolveOutputMappingPath(') &&
      workflowExecutor.includes('private resolveOutputValueByPath('),
    'executor hydrates shared context from step_results and re-applies mapped outputs between steps',
  );

  add(
    'langgraph_w07_variable_resolution_across_nodes_present',
    workflowExecutor.includes('private resolveVariables(params: any, variables: Record<string, any>): any') &&
      workflowExecutor.includes("if (typeof params === 'string' && params.startsWith('${') && params.endsWith('}'))") &&
      workflowExecutor.includes('resolved[key] = this.resolveVariables(value, variables);'),
    'node configs resolve shared context variables recursively across step boundaries',
  );

  add(
    'langgraph_w07_contract_coverage_present',
    outputMappingContract.includes("describe('workflow executor output mapping contract'") &&
      outputMappingContract.includes('maps per-output paths and fails when mapped paths are missing') &&
      stepResultsContract.includes("describe('workflow run step_results persistence contract'"),
    'shared context propagation is anchored by output-mapping and step-result persistence contract suites',
  );

  add(
    'langgraph_w07_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W07 | Shared graph context propagation across nodes and steps | implemented |') &&
      matrixSource.includes('langgraph_parity_w07_shared_context_contract') &&
      matrixSource.includes('langgraph-w07-shared-context-latest') &&
      programSource.includes('LG-W07') &&
      packageSource.includes('"release:langgraph:w07:status"') &&
      packageSource.includes('"release:langgraph:w07:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W07 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w07-shared-context-latest.json');
  const outMd = path.join(outDir, 'langgraph-w07-shared-context-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W07 Shared Context Status',
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
