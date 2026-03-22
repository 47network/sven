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
  const approvalVoteContextTest = read('services/agent-runtime/src/__tests__/approval-manager.vote-context.test.ts');
  const openhandsApprovalContract = read(
    'services/gateway-api/src/__tests__/openhands-parity-w06-approval-gated-risky-exec-contract.test.ts',
  );
  const contractSource = read('services/gateway-api/src/__tests__/crewai-parity-w06-human-checkpoint-contract.test.ts');
  const matrixSource = read('docs/parity/wave5-crewai-workflow-matrix-2026-03-16.md');

  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass: Boolean(pass), detail: String(detail || '') });

  add(
    'crewai_w06_runtime_pending_checkpoint_gate_present',
    runtimeSource.includes('if (decision.requires_approval) {') &&
      runtimeSource.includes('const approvalId = await approvalManager.createApproval({') &&
      runtimeSource.includes('toolCall.pending_approval = true;') &&
      runtimeSource.includes('toolCall.approval_id = approvalId;') &&
      runtimeSource.includes("(tc: any) => !tc.blocked && !tc.pending_approval"),
    'runtime enforces human checkpoint by halting risky tool execution until approval clears pending state',
  );

  add(
    'crewai_w06_operator_resume_or_deny_command_path_present',
    runtimeSource.includes('const match = text.match(/^\\/(approve|deny)\\s+([a-f0-9-]{8,})$/i);') &&
      runtimeSource.includes('Only admins can vote on approvals.') &&
      runtimeSource.includes('await approvalManager.vote(approvalId, userId, action, { chatId: event.chat_id });') &&
      runtimeSource.includes('Recorded ${action} vote for approval ${approvalId}.') &&
      runtimeSource.includes('mapApprovalVoteErrorToUserMessage(err)'),
    'operator checkpoint commands support explicit approve/deny with chat-scoped vote binding',
  );

  add(
    'crewai_w06_approval_resolution_semantics_present',
    approvalManagerSource.includes('if (denies > 0) {') &&
      approvalManagerSource.includes("newStatus = 'denied';") &&
      approvalManagerSource.includes('else if (approves >= quorum) {') &&
      approvalManagerSource.includes("newStatus = 'approved';") &&
      approvalManagerSource.includes('UPDATE approvals SET status = $1, votes_approve = $2, votes_deny = $3, resolved_at = NOW()') &&
      approvalManagerSource.includes('NATS_SUBJECTS.APPROVAL_UPDATED'),
    'approval manager resolves checkpoints deterministically and emits status updates for resume/deny outcomes',
  );

  add(
    'crewai_w06_runtime_and_contract_coverage_present',
    approvalVoteContextTest.includes('ApprovalManager.vote context binding') &&
      approvalVoteContextTest.includes('rejects cross-chat vote attempts') &&
      approvalVoteContextTest.includes('accepts in-chat pending approval and resolves once quorum is met') &&
      openhandsApprovalContract.includes('OpenHands W06 approval-gated risky execution parity contract') &&
      contractSource.includes('CrewAI W06 human checkpoint parity contract') &&
      contractSource.includes("'crewai_w06_runtime_pending_checkpoint_gate_present'"),
    'checkpoint behavior is anchored by vote-context runtime tests and dedicated parity contracts',
  );

  add(
    'crewai_w06_matrix_binding_present',
    matrixSource.includes('| CW-W06 | Human-in-the-loop checkpoint in crew execution | implemented |') &&
      matrixSource.includes('crewai_parity_w06_human_checkpoint_contract') &&
      matrixSource.includes('crewai-w06-human-checkpoint-latest'),
    'Wave 5 matrix binds CW-W06 to dedicated parity gate and artifact',
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
  const outJson = path.join(outDir, 'crewai-w06-human-checkpoint-latest.json');
  const outMd = path.join(outDir, 'crewai-w06-human-checkpoint-latest.md');
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    outMd,
    [
      '# CrewAI W06 Human Checkpoint Status',
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
