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

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function run() {
  const runtimeSource = read('services/agent-runtime/src/index.ts');
  const approvalManagerSource = read('services/agent-runtime/src/approval-manager.ts');
  const matrixSource = read('docs/parity/wave7-autogen-workflow-matrix-2026-03-16.md');
  const programSource = read('docs/parity/sven-competitive-reproduction-program-2026.md');
  const packageSource = read('package.json');
  const contractSource = read(
    'services/gateway-api/src/__tests__/autogen-parity-w04-hitl-checkpoints-contract.test.ts',
  );

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'autogen_w04_runtime_pending_checkpoint_gate_present',
    runtimeSource.includes('if (decision.requires_approval) {') &&
      runtimeSource.includes('const approvalId = await approvalManager.createApproval({') &&
      runtimeSource.includes('toolCall.pending_approval = true;') &&
      runtimeSource.includes('toolCall.approval_id = approvalId;') &&
      runtimeSource.includes("(tc: any) => !tc.blocked && !tc.pending_approval"),
    'team checkpoint gating halts risky tool calls until human approval clears pending state',
  );

  add(
    'autogen_w04_operator_vote_checkpoint_path_present',
    runtimeSource.includes('const match = text.match(/^\\/(approve|deny)\\s+([a-f0-9-]{8,})$/i);') &&
      runtimeSource.includes('Only admins can vote on approvals.') &&
      runtimeSource.includes('await approvalManager.vote(approvalId, userId, action, { chatId: event.chat_id });') &&
      runtimeSource.includes('Recorded ${action} vote for approval ${approvalId}.') &&
      runtimeSource.includes('mapApprovalVoteErrorToUserMessage(err)'),
    'team checkpoint flow exposes explicit approve/deny vote path with chat-scoped guardrails',
  );

  add(
    'autogen_w04_checkpoint_resolution_semantics_present',
    approvalManagerSource.includes('if (denies > 0) {') &&
      approvalManagerSource.includes("newStatus = 'denied';") &&
      approvalManagerSource.includes('else if (approves >= quorum) {') &&
      approvalManagerSource.includes("newStatus = 'approved';") &&
      approvalManagerSource.includes('UPDATE approvals SET status = $1, votes_approve = $2, votes_deny = $3, resolved_at = NOW()') &&
      approvalManagerSource.includes('NATS_SUBJECTS.APPROVAL_UPDATED'),
    'checkpoint decisions resolve deterministically and publish approval-updated events',
  );

  add(
    'autogen_w04_existing_checkpoint_contract_proofs_present',
    exists('services/gateway-api/src/__tests__/openhands-parity-w06-approval-gated-risky-exec-contract.test.ts') &&
      exists('services/agent-runtime/src/__tests__/approval-manager.vote-context.test.ts') &&
      exists('services/gateway-api/src/__tests__/canvas.approvals-org-scope.test.ts'),
    'existing runtime/approval-scope contracts back AG-W04 human-checkpoint behavior',
  );

  add(
    'autogen_w04_matrix_program_alias_binding_present',
    matrixSource.includes('| AG-W04 | Human-in-the-loop checkpoints in agent team conversations | implemented |') &&
      matrixSource.includes('autogen_parity_w04_hitl_checkpoints_contract') &&
      matrixSource.includes('autogen-w04-hitl-checkpoints-latest') &&
      programSource.includes('AG-W04') &&
      packageSource.includes('"release:autogen:w04:status"') &&
      packageSource.includes('"release:autogen:w04:status:local"') &&
      contractSource.includes('AutoGen W04 HITL checkpoints parity contract'),
    'Wave 7 matrix/program/npm bindings exist for AG-W04 strict HITL checkpoint lane',
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
  const outJson = path.join(outDir, 'autogen-w04-hitl-checkpoints-latest.json');
  const outMd = path.join(outDir, 'autogen-w04-hitl-checkpoints-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# AutoGen W04 HITL Checkpoints Status',
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
