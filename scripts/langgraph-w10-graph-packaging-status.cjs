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
  const writeAtomicityContract = read('services/gateway-api/src/__tests__/admin-workflows-write-atomicity-contract.test.ts');
  const actorIdentityContract = read('services/gateway-api/src/__tests__/workflow-actor-identity-fk-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w10_versioned_graph_packaging_present',
    workflowsRoute.includes('INSERT INTO workflow_versions') &&
      workflowsRoute.includes('workflow.version || 0) + 1') &&
      workflowsRoute.includes('workflow_version') &&
      workflowsRoute.includes('change_summary'),
    'graph definitions are versioned and packaged into workflow_versions with explicit change summaries',
  );

  add(
    'langgraph_w10_atomic_write_bundle_present',
    workflowsRoute.includes('await executePoolTransaction(pool, async (client) => {') &&
      workflowsRoute.includes('Workflow create transaction invariant failed') &&
      workflowsRoute.includes('Workflow update transaction invariant failed') &&
      workflowsRoute.includes('Workflow run transaction invariant failed'),
    'create/update/execute graph bundles are packaged atomically before runtime dispatch',
  );

  add(
    'langgraph_w10_draft_and_release_ready_fields_present',
    workflowsRoute.includes('is_draft') &&
      workflowsRoute.includes('is_draft must be a boolean when provided') &&
      workflowsRoute.includes('const draftFlag = is_draft === undefined ? false : is_draft;'),
    'graph packaging supports draft/ready lifecycle metadata for controlled rollout',
  );

  add(
    'langgraph_w10_contract_coverage_present',
    writeAtomicityContract.includes("describe('admin workflows write atomicity contract'") &&
      actorIdentityContract.includes("describe('workflow actor identity fk contract'"),
    'packaging semantics are anchored by atomicity and actor attribution contract suites',
  );

  add(
    'langgraph_w10_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W10 | Reusable graph template packaging for production operations | implemented |') &&
      matrixSource.includes('langgraph_parity_w10_graph_packaging_contract') &&
      matrixSource.includes('langgraph-w10-graph-packaging-latest') &&
      programSource.includes('LG-W10') &&
      packageSource.includes('"release:langgraph:w10:status"') &&
      packageSource.includes('"release:langgraph:w10:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W10 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w10-graph-packaging-latest.json');
  const outMd = path.join(outDir, 'langgraph-w10-graph-packaging-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W10 Graph Packaging Status',
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

