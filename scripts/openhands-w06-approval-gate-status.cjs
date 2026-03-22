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
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const approvalManagerSource = read('services/agent-runtime/src/approval-manager.ts');
  const contractSource = read(
    'services/gateway-api/src/__tests__/openhands-parity-w06-approval-gated-risky-exec-contract.test.ts',
  );
  const matrixSource = read('docs/parity/wave1-openhands-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'openhands_w06_runtime_pending_approval_gate_present',
    runtimeSource.includes('if (decision.requires_approval) {') &&
      runtimeSource.includes('const approvalId = await approvalManager.createApproval({') &&
      runtimeSource.includes('toolCall.pending_approval = true;') &&
      runtimeSource.includes('toolCall.approval_id = approvalId;'),
    'runtime converts risky policy denies into pending approval tickets',
  );

  add(
    'openhands_w06_runtime_fail_closed_execution_filter_present',
    runtimeSource.includes("(tc: any) => !tc.blocked && !tc.pending_approval") &&
      runtimeSource.includes('approval_id: toolCall.approval_id,'),
    'tool execution path excludes pending approvals and carries approval_id on dispatch',
  );

  add(
    'openhands_w06_operator_approval_ux_present',
    runtimeSource.includes('Only admins can vote on approvals.') &&
      runtimeSource.includes('Recorded ${action} vote for approval ${approvalId}.') &&
      runtimeSource.includes('Voice shortcut requires approval. Approve with /approve ${approvalId} or deny with /deny ${approvalId}.') &&
      approvalManagerSource.includes('Approve: /approve ${id}\\nDeny: /deny ${id}'),
    'operator-facing approval UX provides explicit approve/deny command flow',
  );

  add(
    'openhands_w06_contract_test_coverage',
    contractSource.includes('OpenHands W06 approval-gated risky execution parity contract') &&
      contractSource.includes("'openhands_w06_runtime_pending_approval_gate_present'") &&
      contractSource.includes('openhands-w06-approval-gate-latest.json'),
    'contract test asserts W06 runtime anchors and status artifact production',
  );

  add(
    'openhands_w06_matrix_binding_present',
    matrixSource.includes('| OH-W06 | Approval-gated risky operation (write/exec) | implemented |') &&
      matrixSource.includes('openhands_parity_w06_approval_gated_risky_exec') &&
      matrixSource.includes('openhands-w06-approval-gate-latest'),
    'Wave 1 matrix binds OH-W06 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'openhands-w06-approval-gate-latest.json');
  const outMd = path.join(outDir, 'openhands-w06-approval-gate-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# OpenHands W06 Approval-Gated Risky Execution Status',
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
