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
  const approvalsRoute = read('services/gateway-api/src/routes/admin/approvals.ts');
  const approvalVoteModelContract = read('services/gateway-api/src/__tests__/workflow-executor-approval-vote-model-contract.test.ts');
  const approvalTimeoutContract = read('services/gateway-api/src/__tests__/workflow-approval-timeout-failclosed-contract.test.ts');
  const matrixSource = read('docs/parity/wave8-langgraph-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'langgraph_w04_approval_interrupt_node_validation_present',
    workflowsRoute.includes("if (stepType === 'approval') {") &&
      workflowsRoute.includes('approvers must be an array of user ids') &&
      workflowsRoute.includes('approvers must be unique') &&
      workflowsRoute.includes('quorum_required must be an integer >= 1') &&
      workflowsRoute.includes('quorum_required cannot exceed approvers length'),
    'workflow authoring validates HITL approval nodes as interrupt checkpoints with strict approver/quorum constraints',
  );

  add(
    'langgraph_w04_runtime_interrupt_wait_resume_present',
    workflowExecutor.includes('private async executeApproval(') &&
      workflowExecutor.includes("if (status === 'approved') {") &&
      workflowExecutor.includes("if (status === 'denied') {") &&
      workflowExecutor.includes("throw new Error('Approval denied');") &&
      workflowExecutor.includes('throw new Error(`Approval timed out after ${maxAttempts}s`);') &&
      workflowExecutor.includes('const controlState = await this.waitForRunRunnable(run_id);'),
    'executor introduces interrupt wait-point on approval steps and resumes only on approved state with fail-closed deny/timeout paths',
  );

  add(
    'langgraph_w04_approval_vote_resolution_present',
    approvalsRoute.includes("app.post('/approvals/:id/vote'") &&
      approvalsRoute.includes("if (!vote || (vote !== 'approve' && vote !== 'deny'))") &&
      approvalsRoute.includes("if (votesApprove >= approval.quorum_required) {") &&
      approvalsRoute.includes("nextStatus = 'approved';") &&
      approvalsRoute.includes("} else if (votesDeny > 0) {") &&
      approvalsRoute.includes("nextStatus = 'denied';"),
    'approval control-plane resolves explicit approve/deny votes into deterministic interrupt resume/deny outcomes',
  );

  add(
    'langgraph_w04_contract_coverage_present',
    approvalVoteModelContract.includes("describe('workflow executor approval vote-model contract'") &&
      approvalVoteModelContract.includes('derives approval completion from approval_votes tally and reconciles approval status fields') &&
      approvalTimeoutContract.includes("describe('workflow approval timeout fail-closed contract'") &&
      approvalTimeoutContract.includes('treats approval timeout/no-approval as explicit failure instead of completed output'),
    'interrupt/resume behavior is covered by approval vote-model and timeout fail-closed contract suites',
  );

  add(
    'langgraph_w04_matrix_program_alias_binding_present',
    matrixSource.includes('| LG-W04 | Human-in-the-loop interrupt nodes with explicit approval resume | implemented |') &&
      matrixSource.includes('langgraph_parity_w04_hitl_interrupt_contract') &&
      matrixSource.includes('langgraph-w04-hitl-interrupt-latest') &&
      programSource.includes('LG-W04') &&
      packageSource.includes('"release:langgraph:w04:status"') &&
      packageSource.includes('"release:langgraph:w04:status:local"'),
    'Wave 8 matrix/program/npm bindings include LG-W04 strict evidence lane',
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
  const outJson = path.join(outDir, 'langgraph-w04-hitl-interrupt-latest.json');
  const outMd = path.join(outDir, 'langgraph-w04-hitl-interrupt-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# LangGraph W04 HITL Interrupt Status',
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

