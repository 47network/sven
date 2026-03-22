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
  const approvalVoteContract = read('services/gateway-api/src/__tests__/workflow-executor-approval-vote-model-contract.test.ts');
  const approvalTimeoutContract = read('services/gateway-api/src/__tests__/workflow-approval-timeout-failclosed-contract.test.ts');
  const approvalApproversContract = read('services/gateway-api/src/__tests__/workflow-approval-approvers-validation-contract.test.ts');
  const approvalSchemaContract = read('services/gateway-api/src/__tests__/workflow-approval-schema-contract.test.ts');
  const matrixSource = read('docs/parity/wave3-n8n-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'n8n_w08_approval_node_runtime_present',
    workflowExecutor.includes("case 'approval':") &&
      workflowExecutor.includes('private async executeApproval(') &&
      workflowExecutor.includes('INSERT INTO approvals') &&
      workflowExecutor.includes('FROM approval_votes') &&
      workflowExecutor.includes('const derivedStatus'),
    'workflow executor includes approval step runtime with persisted approval + vote tally reconciliation',
  );

  add(
    'n8n_w08_fail_closed_timeout_present',
    workflowExecutor.includes('const timeoutSec = Number(step?.config?.timeout_seconds || 1200);') &&
      workflowExecutor.includes("throw new Error('Approval denied');") &&
      workflowExecutor.includes("throw new Error('Approval record missing');") &&
      workflowExecutor.includes('throw new Error(`Approval timed out after ${maxAttempts}s`);'),
    'approval nodes fail closed on deny/missing/timeout states',
  );

  add(
    'n8n_w08_authoring_validation_present',
    workflowsRoute.includes("if (stepType === 'approval')") &&
      workflowsRoute.includes('approvers must be an array of user ids') &&
      workflowsRoute.includes('approvers must be unique') &&
      workflowsRoute.includes('quorum_required must be an integer >= 1') &&
      workflowsRoute.includes('quorum_required cannot exceed approvers length'),
    'workflow authoring enforces approver/quorum validation for approval nodes',
  );

  add(
    'n8n_w08_contract_tests_bound',
    approvalVoteContract.includes("describe('workflow executor approval vote-model contract'") &&
      approvalTimeoutContract.includes("describe('workflow approval timeout fail-closed contract'") &&
      approvalApproversContract.includes("describe('workflow approval approvers validation contract'") &&
      approvalSchemaContract.includes("describe('workflow approval schema contract'"),
    'approval node behavior is bound to dedicated gateway contract tests',
  );

  add(
    'n8n_w08_matrix_binding_present',
    matrixSource.includes('| NN-W08 | Human-in-the-loop approval nodes in automation chains | implemented |') &&
      matrixSource.includes('n8n_parity_w08_approval_nodes_contract'),
    'Wave 3 matrix binds NN-W08 to implemented state with contract/evidence IDs',
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
  const outJson = path.join(outDir, 'n8n-w08-approval-nodes-latest.json');
  const outMd = path.join(outDir, 'n8n-w08-approval-nodes-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# n8n W08 Approval Nodes Status',
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
